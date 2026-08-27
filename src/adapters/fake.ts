import { AdvisorAdapter, AdvisorAvailability, AdvisorRun } from "./adapter";
import {
  ConsultationRequest,
  ConsultationAnswer,
  FollowupRequest,
} from "../core/protocol";

export interface FakeAdapterOptions {
  id?: string;
  isAvailable?: boolean;
  isAuthenticated?: boolean;
  simulateDelayMs?: number;
  customVerdict?: string;
}

export class FakeAdvisorAdapter implements AdvisorAdapter {
  readonly id: string;
  private isAvailable: boolean;
  private isAuthenticated: boolean;
  private delayMs: number;
  private customVerdict?: string;

  constructor(options: FakeAdapterOptions = {}) {
    this.id = options.id || "fake-staff";
    this.isAvailable = options.isAvailable ?? true;
    this.isAuthenticated = options.isAuthenticated ?? true;
    this.delayMs = options.simulateDelayMs ?? 0;
    this.customVerdict = options.customVerdict;
  }

  async probe(): Promise<AdvisorAvailability> {
    return {
      available: this.isAvailable,
      authenticated: this.isAuthenticated,
      version: "fake-1.0.0",
      supports_resume: true,
      supports_background: true,
      supports_read_only: true,
      supports_structured_output: true,
      capabilities: ["architecture", "debugging", "code-review", "concurrency", "security"],
    };
  }

  async start(request: ConsultationRequest): Promise<AdvisorRun> {
    if (!this.isAvailable) {
      throw new Error(`Advisor ${this.id} is not available`);
    }
    if (!this.isAuthenticated) {
      throw new Error(`Advisor ${this.id} is not authenticated`);
    }

    if (this.delayMs > 0) {
      await new Promise((res) => setTimeout(res, this.delayMs));
    }

    const consultationId = request.consultation_id || "dad_fake_run";
    const relevantFile = request.evidence?.relevant_files?.[0] || "relevant files";

    const answer: ConsultationAnswer = {
      schema: "consult-dad.answer.v1",
      consultation_id: consultationId,
      status: "completed",
      advisor: { id: this.id, adapter: "fake" },
      verdict: this.customVerdict || `Diagnostic analysis for: ${request.question}`,
      recommendation: [
        `Inspect ${relevantFile}`,
        "Formulate and test isolated hypothesis",
      ],
      assumptions: ["Caller operates in standard isolated sandbox"],
      risks: ["Proceeding without verification may cause subtle regressions"],
      verification: ["Run automated unit test suite"],
      confidence: "high",
      worker_action: "continue",
      needs_followup: false,
    };

    return {
      consultation_id: consultationId,
      advisor_id: this.id,
      native_session_id: `session_${consultationId}`,
      status: "completed",
      answer,
      stderr: "",
    };
  }

  async resume(run: AdvisorRun, delta: FollowupRequest): Promise<AdvisorRun> {
    if (this.delayMs > 0) {
      await new Promise((res) => setTimeout(res, this.delayMs));
    }

    const updatedAnswer: ConsultationAnswer = {
      schema: "consult-dad.answer.v1",
      consultation_id: run.consultation_id,
      status: "completed",
      advisor: { id: this.id, adapter: "fake" },
      verdict: `Refined advice after followup: "${delta.message}"`,
      recommendation: [
        "Adjust parameter boundary",
        "Re-run verification pass",
      ],
      assumptions: ["Prior observations remain valid"],
      risks: ["Edge case may require additional check"],
      verification: ["Run integration test suite"],
      confidence: "high",
      worker_action: "continue",
      needs_followup: false,
    };

    return {
      ...run,
      status: "completed",
      answer: updatedAnswer,
    };
  }

  async cancel(run: AdvisorRun): Promise<void> {
    run.status = "canceled";
  }

  async result(run: AdvisorRun): Promise<ConsultationAnswer> {
    if (!run.answer) {
      throw new Error(`No answer available for consultation ${run.consultation_id}`);
    }
    return run.answer;
  }
}
