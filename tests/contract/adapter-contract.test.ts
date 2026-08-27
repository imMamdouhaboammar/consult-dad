import { describe, it, expect } from "vitest";
import { AdvisorAdapter } from "../../src/adapters/adapter";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { ConsultationRequest, FollowupRequest } from "../../src/core/protocol";

function assertAdapterContract(name: string, createAdapter: () => AdvisorAdapter) {
  describe(`Adapter Contract: ${name}`, () => {
    const sampleReq: ConsultationRequest = {
      schema: "consult-dad.request.v1",
      consultation_id: "dad_contract_123",
      mode: "review",
      caller: { agent: "contract-agent", role: "worker" },
      goal: "Architecture check",
      question: "Is this design scalable?",
      attempts: [],
      evidence: {},
      constraints: { read_only: true },
      decision_needed: "Review and approve",
    };

    it("has a valid identifier string", () => {
      const adapter = createAdapter();
      expect(typeof adapter.id).toBe("string");
      expect(adapter.id.length).toBeGreaterThan(0);
    });

    it("fulfills probe contract", async () => {
      const adapter = createAdapter();
      const avail = await adapter.probe();
      expect(typeof avail.available).toBe("boolean");
      expect(typeof avail.authenticated).toBe("boolean");
      expect(typeof avail.supports_resume).toBe("boolean");
      expect(typeof avail.supports_background).toBe("boolean");
      expect(typeof avail.supports_read_only).toBe("boolean");
    });

    it("fulfills start and result contract", async () => {
      const adapter = createAdapter();
      const run = await adapter.start(sampleReq);
      expect(run.consultation_id).toBe(sampleReq.consultation_id);
      expect(["running", "completed", "failed", "canceled"]).toContain(run.status);

      const answer = await adapter.result(run);
      expect(answer.schema).toBe("consult-dad.answer.v1");
      expect(answer.consultation_id).toBe(sampleReq.consultation_id);
      expect(Array.isArray(answer.recommendation)).toBe(true);
      expect(["high", "medium", "low"]).toContain(answer.confidence);
      expect(["continue", "retry", "escalate", "abort"]).toContain(answer.worker_action);
    });

    it("fulfills resume contract", async () => {
      const adapter = createAdapter();
      const run = await adapter.start(sampleReq);
      const followup: FollowupRequest = {
        consultation_id: sampleReq.consultation_id!,
        message: "What about memory impact?",
      };
      const resumed = await adapter.resume(run, followup);
      expect(resumed.status).toBe("completed");
      expect(resumed.answer).not.toBeNull();
    });

    it("fulfills cancel contract", async () => {
      const adapter = createAdapter();
      const run = await adapter.start(sampleReq);
      await adapter.cancel(run);
      expect(["canceled", "failed", "completed"]).toContain(run.status);
    });
  });
}

// Run contract suite against FakeAdvisorAdapter
assertAdapterContract("FakeAdvisorAdapter", () => new FakeAdvisorAdapter());
