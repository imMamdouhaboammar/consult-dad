import { ConsultationStore, ListFilter } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { AdvisorAdapter, AdvisorRun } from "../adapters/adapter";
import { AdvisorRegistry } from "../core/routing";
import {
  ConsultationRequest,
  ConsultationRequestInput,
  ConsultationRequestSchema,
  ConsultationAnswer,
  ConsultationState,
  FollowupRequest,
  Evidence,
} from "../core/protocol";
import { LifecycleStateMachine } from "./lifecycle";
import { ConsultationQueue } from "./queue";
import { EscalationPolicy } from "../core/policy";

export interface BrokerOptions {
  store: ConsultationStore;
  artifactStore: ArtifactStore;
  defaultAdapter?: AdvisorAdapter;
  adapters?: Map<string, AdvisorAdapter>;
  registry?: AdvisorRegistry;
  policy?: EscalationPolicy;
}

export class ConsultationBroker {
  private store: ConsultationStore;
  private artifactStore: ArtifactStore;
  private defaultAdapter?: AdvisorAdapter;
  private adapters: Map<string, AdvisorAdapter>;
  private registry?: AdvisorRegistry;
  private queue: ConsultationQueue;
  private policy: EscalationPolicy;
  private activeRuns: Map<string, AdvisorRun> = new Map();

  constructor(options: BrokerOptions) {
    this.store = options.store;
    this.artifactStore = options.artifactStore;
    this.defaultAdapter = options.defaultAdapter;
    this.registry = options.registry;
    this.adapters = options.adapters || new Map();
    if (this.defaultAdapter) {
      this.adapters.set(this.defaultAdapter.id, this.defaultAdapter);
    }
    this.queue = new ConsultationQueue();
    this.policy = options.policy || new EscalationPolicy();
  }

  registerAdapter(adapter: AdvisorAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id?: string): AdvisorAdapter {
    if (id) {
      if (this.adapters.has(id)) {
        return this.adapters.get(id)!;
      }
      if (this.registry) {
        const registered = this.registry.get(id);
        if (registered) {
          return registered.adapter;
        }
      }
      throw new Error(`advisor_unavailable: Advisor '${id}' is not registered`);
    }

    if (this.defaultAdapter) {
      return this.defaultAdapter;
    }

    if (this.adapters.size > 0) {
      return this.adapters.values().next().value!;
    }

    throw new Error("advisor_unavailable: No default advisor configured in broker");
  }

  async resolveCandidatesForRequest(
    request: ConsultationRequest,
    explicitAdvisorId?: string
  ): Promise<AdvisorAdapter[]> {
    if (explicitAdvisorId) {
      const adapter = this.getAdapter(explicitAdvisorId);
      const probe = await adapter.probe();
      if (!probe.available) {
        throw new Error(`advisor_unavailable: Advisor '${explicitAdvisorId}' is not available`);
      }
      if (!probe.authenticated) {
        throw new Error(`advisor_not_authenticated: Advisor '${explicitAdvisorId}' is not authenticated`);
      }
      return [adapter];
    }

    if (this.registry) {
      try {
        const candidates = await this.registry.resolveCandidates(request);
        if (candidates.length > 0) {
          return candidates;
        }
      } catch (registryError) {
        if (this.defaultAdapter) {
          return [this.defaultAdapter];
        }
        throw registryError;
      }
    }

    return [this.getAdapter()];
  }

  async consult(
    rawRequest: ConsultationRequestInput | ConsultationRequest,
    contextId?: string,
    advisorId?: string
  ): Promise<string> {
    const request = ConsultationRequestSchema.parse(rawRequest);

    const policyResult = this.policy.validate(request);
    if (!policyResult.allowed) {
      throw new Error(policyResult.reason || "policy_denied: Consultation rejected by runtime policy");
    }

    const candidateAdapters = await this.resolveCandidatesForRequest(request, advisorId);
    const initialAdapter = candidateAdapters[0];
    const id = this.store.create(request, contextId);

    // Save request artifact on disk
    this.artifactStore.writeJson(id, "request.json", request);
    this.store.appendEvent(id, "created", `Consultation requested (primary advisor: ${initialAdapter.id})`);

    // Update state to queued
    this.store.updateStatus(id, "queued", initialAdapter.id);
    this.store.appendEvent(id, "queued", "Enqueued for execution");

    // Execute via queue
    return this.queue.enqueue(async () => {
      LifecycleStateMachine.assertTransition("queued", "running");
      this.store.updateStatus(id, "running", initialAdapter.id);

      const runRequest: ConsultationRequest = {
        ...request,
        consultation_id: id,
      };

      let lastError: string | null = null;

      for (let i = 0; i < candidateAdapters.length; i++) {
        const adapter = candidateAdapters[i];
        try {
          this.store.updateStatus(id, "running", adapter.id);
          this.store.appendEvent(id, "running", `Starting advisor: ${adapter.id}`);

          const run = await adapter.start(runRequest);
          this.activeRuns.set(id, run);

          if (run.status === "completed" && run.answer) {
            this.store.saveAnswer(id, run.answer);
            this.store.appendEvent(id, "completed", `Answer produced by ${adapter.id} and validated`);
            this.artifactStore.writeJson(id, "answer.json", run.answer);
            return id;
          }

          if (run.status === "canceled") {
            this.store.updateStatus(id, "canceled");
            this.store.appendEvent(id, "canceled", `Advisor ${adapter.id} run canceled`);
            return id;
          }

          // Advisor failed
          lastError = run.stderr || `Advisor '${adapter.id}' returned status: ${run.status}`;
          this.store.appendEvent(
            id,
            "advisor_failed",
            `Advisor '${adapter.id}' failed: ${lastError}`
          );
          if (run.stderr) {
            this.artifactStore.appendLog(id, "stderr.log", run.stderr + "\n");
          }

          // If there is another candidate, attempt failover
          if (i + 1 < candidateAdapters.length) {
            const nextAdvisor = candidateAdapters[i + 1];
            this.store.appendEvent(
              id,
              "failover",
              `Failing over from '${adapter.id}' to '${nextAdvisor.id}'`
            );
          }
        } catch (err: any) {
          lastError = err.message || "Unknown error";
          this.store.appendEvent(
            id,
            "advisor_error",
            `Advisor '${adapter.id}' threw error: ${lastError}`
          );
          this.artifactStore.appendLog(id, "stderr.log", `${err.stack || err}\n`);

          if (i + 1 < candidateAdapters.length) {
            const nextAdvisor = candidateAdapters[i + 1];
            this.store.appendEvent(
              id,
              "failover",
              `Failing over from '${adapter.id}' to '${nextAdvisor.id}'`
            );
          }
        }
      }

      // If loop finishes without returning, all candidate advisors failed
      this.store.updateStatus(id, "failed");
      this.store.appendEvent(id, "failed", `All candidate advisors failed. Last error: ${lastError}`);
      return id;
    });
  }

  async followup(id: string, message: string, newEvidence?: Evidence): Promise<string> {
    const state = this.store.get(id);
    if (!state) {
      throw new Error(`Consultation '${id}' not found`);
    }

    const adapter = this.getAdapter(state.advisor_id);
    this.store.appendEvent(id, "followup_received", message);
    this.store.updateStatus(id, "running");

    const followupReq: FollowupRequest = {
      consultation_id: id,
      message,
      new_evidence: newEvidence,
    };

    let existingRun: AdvisorRun = this.activeRuns.get(id) || {
      consultation_id: id,
      advisor_id: adapter.id,
      native_session_id: state.native_session_id ?? null,
      status: "running",
      answer: state.answer ?? null,
      stderr: "",
    };

    const run = await adapter.resume(existingRun, followupReq);
    this.activeRuns.set(id, run);

    if (run.answer) {
      this.store.saveAnswer(id, run.answer);
      this.store.appendEvent(id, "completed", "Followup answer generated");
      this.artifactStore.writeJson(id, "answer.json", run.answer);
    }

    return id;
  }

  status(id: string): ConsultationState | null {
    return this.store.get(id);
  }

  async result(id: string): Promise<ConsultationAnswer> {
    const state = this.store.get(id);
    if (!state) {
      throw new Error(`Consultation '${id}' not found`);
    }
    if (!state.answer) {
      const lastEvent = state.events[state.events.length - 1]?.detail || "";
      throw new Error(
        `Consultation '${id}' failed without an answer (status: ${state.status}). ${lastEvent ? `Reason: ${lastEvent}. ` : ""}Run 'dad logs ${id}' for full timeline.`
      );
    }
    return state.answer;
  }

  async cancel(id: string): Promise<void> {
    const state = this.store.get(id);
    if (!state) return;

    const run = this.activeRuns.get(id);
    if (run) {
      const adapter = this.getAdapter(state.advisor_id);
      await adapter.cancel(run);
    }

    this.store.updateStatus(id, "canceled");
    this.store.appendEvent(id, "canceled", "Canceled by caller");
  }

  list(filter?: ListFilter): ConsultationState[] {
    return this.store.list(filter);
  }
}
