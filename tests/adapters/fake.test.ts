import { describe, it, expect } from "vitest";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { ConsultationRequest, FollowupRequest } from "../../src/core/protocol";

describe("FakeAdvisorAdapter", () => {
  const req: ConsultationRequest = {
    schema: "consult-dad.request.v1",
    consultation_id: "dad_run_01",
    mode: "diagnose",
    caller: { agent: "test-caller", role: "worker" },
    goal: "Fix bug",
    question: "Why does it crash?",
    attempts: [],
    evidence: { relevant_files: ["index.ts"] },
    constraints: { read_only: true },
    decision_needed: "Determine fix",
  };

  it("probes availability successfully", async () => {
    const adapter = new FakeAdvisorAdapter();
    const info = await adapter.probe();
    expect(info.available).toBe(true);
    expect(info.authenticated).toBe(true);
    expect(info.supports_read_only).toBe(true);
  });

  it("starts a consultation and returns a completed run with answer", async () => {
    const adapter = new FakeAdvisorAdapter();
    const run = await adapter.start(req);

    expect(run.status).toBe("completed");
    expect(run.consultation_id).toBe("dad_run_01");
    expect(run.answer).not.toBeNull();
    expect(run.answer?.verdict).toContain("Diagnostic analysis for: Why does it crash?");
    expect(run.answer?.worker_action).toBe("continue");
  });

  it("resumes an existing run on followup", async () => {
    const adapter = new FakeAdvisorAdapter();
    const initialRun = await adapter.start(req);

    const followup: FollowupRequest = {
      consultation_id: "dad_run_01",
      message: "Option A gave error 404",
    };

    const resumedRun = await adapter.resume(initialRun, followup);
    expect(resumedRun.answer?.verdict).toContain("Refined advice after followup: \"Option A gave error 404\"");
  });

  it("handles availability error correctly", async () => {
    const adapter = new FakeAdvisorAdapter({ isAvailable: false });
    await expect(adapter.start(req)).rejects.toThrow("is not available");
  });

  it("handles authentication error correctly", async () => {
    const adapter = new FakeAdvisorAdapter({ isAuthenticated: false });
    await expect(adapter.start(req)).rejects.toThrow("is not authenticated");
  });
});
