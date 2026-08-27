import { describe, it, expect } from "vitest";
import { AdvisorRegistry } from "../../src/core/routing";
import { EscalationPolicy } from "../../src/core/policy";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { ConsultationRequest } from "../../src/core/protocol";

describe("AdvisorRegistry & Routing", () => {
  const req: ConsultationRequest = {
    schema: "consult-dad.request.v1",
    mode: "diagnose",
    caller: { agent: "gemini-cli", role: "worker" },
    goal: "Fix deadlock",
    question: "How to eliminate concurrency race?",
    decision_needed: "Choose concurrency primitive",
  };

  it("registers and resolves advisor by explicit id", async () => {
    const registry = new AdvisorRegistry();
    const staff = new FakeAdvisorAdapter({ id: "staff" });
    const architect = new FakeAdvisorAdapter({ id: "architect" });

    registry.register({ adapter: staff, priority: 100, capabilities: ["debugging", "concurrency"] });
    registry.register({ adapter: architect, priority: 90, capabilities: ["architecture"] });

    const resolved = await registry.resolve(req, "architect");
    expect(resolved.id).toBe("architect");
  });

  it("resolves highest priority available advisor matching capabilities", async () => {
    const registry = new AdvisorRegistry();
    const staff = new FakeAdvisorAdapter({ id: "staff" });
    const fallback = new FakeAdvisorAdapter({ id: "generic-fallback" });

    registry.register({ adapter: fallback, priority: 50, capabilities: ["concurrency"] });
    registry.register({ adapter: staff, priority: 100, capabilities: ["concurrency"] });

    const resolved = await registry.resolve(req);
    expect(resolved.id).toBe("staff");
  });

  it("explains routing rationale clearly", async () => {
    const registry = new AdvisorRegistry();
    const staff = new FakeAdvisorAdapter({ id: "staff" });
    registry.register({ adapter: staff, priority: 100, capabilities: ["debugging"] });

    const explanation = await registry.explain(req);
    expect(explanation).toContain("Selected advisor: staff");
    expect(explanation).toContain("Reason:");
  });
});

describe("EscalationPolicy", () => {
  it("enforces max depth = 1 (rejects Dad consulting Dad)", () => {
    const policy = new EscalationPolicy();
    const recursiveReq: ConsultationRequest = {
      schema: "consult-dad.request.v1",
      mode: "diagnose",
      caller: { agent: "dad-staff", role: "advisor" },
      goal: "Test",
      question: "Test",
      decision_needed: "Test",
    };

    const check = policy.validate(recursiveReq);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("max_depth: 1");
  });

  it("permits standard worker consultation requests", () => {
    const policy = new EscalationPolicy();
    const standardReq: ConsultationRequest = {
      schema: "consult-dad.request.v1",
      mode: "consult",
      caller: { agent: "claude-code", role: "worker" },
      goal: "Architecture check",
      question: "DB choice",
      decision_needed: "Pick one",
    };

    const check = policy.validate(standardReq);
    expect(check.allowed).toBe(true);
  });
});
