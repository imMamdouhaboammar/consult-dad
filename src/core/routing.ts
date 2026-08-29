import { AdvisorAdapter, AdvisorAvailability } from "../adapters/adapter";
import {
  ConsultationRequest,
  ConsultationRequestInput,
  ConsultationRequestSchema,
  ConsultationMode,
} from "./protocol";

export interface RegisteredAdvisor {
  adapter: AdvisorAdapter;
  priority: number;
  capabilities: string[];
  description?: string;
}

export interface AdvisorListItem {
  id: string;
  priority: number;
  capabilities: string[];
  description?: string;
  availability: AdvisorAvailability;
}

export class AdvisorRegistry {
  private entries: Map<string, RegisteredAdvisor> = new Map();

  register(entry: RegisteredAdvisor): void {
    this.entries.set(entry.adapter.id, entry);
  }

  get(id: string): RegisteredAdvisor | undefined {
    return this.entries.get(id);
  }

  async list(): Promise<AdvisorListItem[]> {
    const list: AdvisorListItem[] = [];
    for (const [id, entry] of this.entries.entries()) {
      const avail = await entry.adapter.probe();
      list.push({
        id,
        priority: entry.priority,
        capabilities: entry.capabilities,
        description: entry.description,
        availability: avail,
      });
    }
    return list.sort((a, b) => b.priority - a.priority);
  }

  async resolveCandidates(
    rawRequest: ConsultationRequestInput | ConsultationRequest,
    explicitAdvisorId?: string
  ): Promise<AdvisorAdapter[]> {
    const request = ConsultationRequestSchema.parse(rawRequest);
    if (explicitAdvisorId) {
      const entry = this.entries.get(explicitAdvisorId);
      if (!entry) {
        throw new Error(`Advisor '${explicitAdvisorId}' is not registered`);
      }
      const probe = await entry.adapter.probe();
      if (!probe.available) {
        throw new Error(`Advisor '${explicitAdvisorId}' is registered but unavailable`);
      }
      return [entry.adapter];
    }

    const neededCapabilities = this.inferCapabilities(request.mode, request.question);

    const candidates: Array<{ entry: RegisteredAdvisor; score: number }> = [];
    for (const entry of this.entries.values()) {
      const probe = await entry.adapter.probe();
      if (!probe.available) continue;

      let matchScore = entry.priority;
      for (const cap of neededCapabilities) {
        if (entry.capabilities.includes(cap)) {
          matchScore += 20;
        }
      }
      candidates.push({ entry, score: matchScore });
    }

    if (candidates.length === 0) {
      throw new Error("No available advisor found in registry");
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.map((c) => c.entry.adapter);
  }

  async resolve(
    rawRequest: ConsultationRequestInput | ConsultationRequest,
    explicitAdvisorId?: string
  ): Promise<AdvisorAdapter> {
    const candidates = await this.resolveCandidates(rawRequest, explicitAdvisorId);
    return candidates[0];
  }

  async explain(rawRequest: ConsultationRequestInput | ConsultationRequest): Promise<string> {
    const request = ConsultationRequestSchema.parse(rawRequest);
    const needed = this.inferCapabilities(request.mode, request.question);
    const chosen = await this.resolve(request);
    const chosenEntry = this.entries.get(chosen.id);

    return `Selected advisor: ${chosen.id} (priority: ${chosenEntry?.priority ?? 100})
Reason: Best available match for mode='${request.mode}' and capabilities=[${needed.join(", ")}].`;
  }

  private inferCapabilities(mode: ConsultationMode, question: string): string[] {
    const questionLower = question.toLowerCase();
    const caps: string[] = [];

    switch (mode) {
      case "diagnose":
        caps.push("debugging", "concurrency");
        break;
      case "review":
        caps.push("code-review", "architecture");
        break;
      case "decide":
        caps.push("architecture", "tradeoffs", "design");
        break;
      case "challenge":
        caps.push("threat-modeling", "architecture");
        break;
      default:
        caps.push("general");
    }

    if (
      questionLower.includes("race") ||
      questionLower.includes("deadlock") ||
      questionLower.includes("concurrent") ||
      questionLower.includes("lock")
    ) {
      caps.push("concurrency");
    }
    if (
      questionLower.includes("security") ||
      questionLower.includes("auth") ||
      questionLower.includes("leak") ||
      questionLower.includes("secret")
    ) {
      caps.push("threat-modeling");
    }
    if (
      questionLower.includes("refactor") ||
      questionLower.includes("clean") ||
      questionLower.includes("dry")
    ) {
      caps.push("refactoring");
    }

    return Array.from(new Set(caps));
  }
}
