import { describe, it, expect } from "vitest";
import { ContextPackBuilder } from "../../src/core/context-builder";
import { ConsultationRequest } from "../../src/core/protocol";

describe("ContextPackBuilder", () => {
  const fullReq: ConsultationRequest = {
    schema: "consult-dad.request.v1",
    consultation_id: "dad_test_ctx",
    mode: "diagnose",
    caller: { agent: "gemini-cli", role: "worker" },
    goal: "Fix authentication race condition in token refresher",
    question: "Why does concurrent refresh trigger token invalidation?",
    current_hypothesis: "Two threads refresh the same expired token concurrently",
    attempts: [
      { action: "Added retry wrapper", outcome: "Flakiness decreased from 10% to 3%" },
      { action: "Added local mutex in worker", outcome: "Deadlock on timeout" },
    ],
    evidence: {
      failing_tests: ["test_concurrent_refresh_fails"],
      errors: ["TokenRefreshError: invalid_grant - token already used with secret: sk-ant-api03-secretkey123456789"],
      relevant_files: ["src/auth/refresh.ts", "src/auth/token_store.ts"],
      git_diff: "+ const retryCount = 3;",
      logs: ["Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret"],
    },
    constraints: {
      read_only: true,
      workspace_root: "/path/to/project",
      max_followups: 3,
    },
    decision_needed: "Recommend the right locking or single-flight mechanism",
  };

  it("builds all required sections cleanly", () => {
    const builder = new ContextPackBuilder();
    const pack = builder.build(fullReq);

    expect(pack).toContain("=== DAD CONSULTATION BRIEF ===");
    expect(pack).toContain("## GOAL");
    expect(pack).toContain("Fix authentication race condition");
    expect(pack).toContain("## QUESTION");
    expect(pack).toContain("Why does concurrent refresh trigger token invalidation?");
    expect(pack).toContain("## CURRENT HYPOTHESIS");
    expect(pack).toContain("Two threads refresh the same expired token concurrently");
    expect(pack).toContain("## ATTEMPTS ALREADY MADE");
    expect(pack).toContain("Added retry wrapper");
    expect(pack).toContain("## OBSERVED EVIDENCE");
    expect(pack).toContain("test_concurrent_refresh_fails");
    expect(pack).toContain("## CONSTRAINTS");
    expect(pack).toContain("READ-ONLY: true");
    expect(pack).toContain("## DECISION NEEDED");
    expect(pack).toContain("Recommend the right locking or single-flight mechanism");
  });

  it("redacts sensitive tokens, api keys, and bearer headers", () => {
    const builder = new ContextPackBuilder();
    const pack = builder.build(fullReq);

    expect(pack).not.toContain("sk-ant-api03-secretkey123456789");
    expect(pack).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret");
    expect(pack).toContain("[REDACTED]");
  });

  it("omits missing optional sections cleanly without empty headers", () => {
    const builder = new ContextPackBuilder();
    const minimalReq: ConsultationRequest = {
      schema: "consult-dad.request.v1",
      mode: "consult",
      caller: { agent: "claude-code", role: "worker" },
      goal: "Choose database",
      question: "PostgreSQL or SQLite?",
      decision_needed: "Choose storage",
    };

    const pack = builder.build(minimalReq);
    expect(pack).not.toContain("## CURRENT HYPOTHESIS");
    expect(pack).not.toContain("## ATTEMPTS ALREADY MADE");
    expect(pack).toContain("## GOAL");
    expect(pack).toContain("## QUESTION");
    expect(pack).toContain("## DECISION NEEDED");
  });
});
