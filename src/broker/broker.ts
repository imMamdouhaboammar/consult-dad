import { ConsultationStore, ListFilter } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { AdvisorAdapter, AdvisorRun } from "../adapters/adapter";
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

export interface BrokerOptions {
  store: ConsultationStore;
  artifactStore: ArtifactStore;
  defaultAdapter: AdvisorAdapter;
  adapters?: Map<string, AdvisorAdapter>;
}

export class ConsultationBroker {
  private store: ConsultationStore;
  private artifactStore: ArtifactStore;
  private defaultAdapter: AdvisorAdapter;
  private adapters: Map<string, AdvisorAdapter>;
  private queue: ConsultationQueue;
  private activeRuns: Map<string, AdvisorRun> = new Map();

  constructor(options: BrokerOptions) {
    this.store = options.store;
    this.artifactStore = options.artifactStore;
    this.defaultAdapter = options.defaultAdapter;
    this.adapters = options.adapters || new Map();
    this.adapters.set(this.defaultAdapter.id, this.defaultAdapter);
    this.queue = new ConsultationQueue();
  }

  registerAdapter(adapter: AdvisorAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id?: string): AdvisorAdapter {
    if (id) {
      if (this.adapters.has(id)) {
        return this.adapters.get(id)!;
      }
      throw new Error(`advisor_unavailable: Advisor '${id}' is not registered`);
    }
    return this.defaultAdapter;
  }

  async consult(rawRequest: ConsultationRequestInput | ConsultationRequest, contextId?: string, advisorId?: string): Promise<string> {
    const request = ConsultationRequestSchema.parse(rawRequest);

    // Enforce max_depth / prevent recursive consultations
    if (
      request.caller.role.toLowerCase().includes("dad") ||
      request.caller.role.toLowerCase().includes("advisor")
    ) {
      throw new Error("policy_denied: Recursive Dad consultation forbidden (max_depth: 1)");
    }

    const adapter = this.getAdapter(advisorId);
    const id = this.store.create(request, contextId);

    // Save request artifact on disk
    this.artifactStore.writeJson(id, "request.json", request);
    this.store.appendEvent(id, "created", `Consultation requested via adapter: ${adapter.id}`);

    // Update state to queued
    this.store.updateStatus(id, "queued", adapter.id);
    this.store.appendEvent(id, "queued", "Enqueued for execution");

    // Execute via queue
    return this.queue.enqueue(async () => {
      try {
        LifecycleStateMachine.assertTransition("queued", "running");
        this.store.updateStatus(id, "running", adapter.id);
        this.store.appendEvent(id, "running", `Starting advisor: ${adapter.id}`);

        const runRequest: ConsultationRequest = {
          ...request,
          consultation_id: id,
        };

        const run = await adapter.start(runRequest);
        this.activeRuns.set(id, run);

        if (run.status === "completed" && run.answer) {
          this.store.saveAnswer(id, run.answer);
          this.store.appendEvent(id, "completed", "Answer produced and validated");
          this.artifactStore.writeJson(id, "answer.json", run.answer);
        } else if (run.status === "canceled") {
          this.store.updateStatus(id, "canceled");
          this.store.appendEvent(id, "canceled", "Advisor run canceled");
        } else {
          this.store.updateStatus(id, "failed");
          this.store.appendEvent(id, "failed", `Advisor run status: ${run.status}`);
        }

        return id;
      } catch (err: any) {
        this.store.updateStatus(id, "failed");
        this.store.appendEvent(id, "failed", err.message || "Unknown failure");
        this.artifactStore.appendLog(id, "stderr.log", `${err.stack || err}\n`);
        throw err;
      }
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
      throw new Error(`Consultation '${id}' has no completed answer yet (status: ${state.status})`);
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
