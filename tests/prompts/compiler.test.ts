import { describe, it, test, expect } from "vitest";
import { PromptCompiler } from "../../src/prompts/compiler";
import { ContextPackBuilder } from "../../src/core/context-builder";
import { ConsultationMode, ConsultationRequest } from "../../src/core/protocol";

describe("PromptCompiler & ContextPackBuilder", () => {
  const compiler = new PromptCompiler();

  test.each<[ConsultationMode, string]>([
    ["diagnose", "MODE: DIAGNOSE"],
    ["decide", "MODE: DECIDE"],
    ["challenge", "MODE: CHALLENGE"],
    ["review", "MODE: REVIEW"],
    ["consult", "MODE: CONSULT"],
    ["takeover", "MODE: TAKEOVER"],
  ])("compiles mode-specific prompt template for mode: %s", (mode, expectedHeader) => {
    const compiled = compiler.compile(mode);
    expect(compiled).toContain(expectedHeader);
  });

  it("scrubs high-entropy tokens, cloud keys, database passwords, and private keys", () => {
    const builder = new ContextPackBuilder();

    const dirtyText = `
      OpenAI: sk-proj-1234567890abcdef1234567890abcdef
      Anthropic: sk-ant-api03-abcdef1234567890abcdef1234567890
      GitHub: ghp_1234567890abcdefghijklmnopqrstuvwxyz
      AWS: AKIA1234567890ABCDEF
      Google: AIzaSyD1234567890abcdefghijklmnopqrstuvw
      DB URI: postgres://admin:supersecretpassword@db.prod.internal:5432/main
      Mongo URI: mongodb+srv://app_user:dbpassword99@cluster0.mongodb.net/prod
      Bearer: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M
    `;

    const cleanText = builder.redact(dirtyText);
    expect(cleanText).not.toContain("sk-proj-");
    expect(cleanText).not.toContain("sk-ant-");
    expect(cleanText).not.toContain("ghp_");
    expect(cleanText).not.toContain("AKIA1234567890ABCDEF");
    expect(cleanText).not.toContain("AIzaSyD");
    expect(cleanText).not.toContain("supersecretpassword");
    expect(cleanText).not.toContain("dbpassword99");
    expect(cleanText).not.toContain("eyJhbGci");
  });

  it("builds a full structured context pack with mode prompt and clean evidence", () => {
    const builder = new ContextPackBuilder();
    const request: ConsultationRequest = {
      schema: "consult-dad.request.v1",
      consultation_id: "dad_01H12345",
      mode: "decide",
      caller: { agent: "claude-code", role: "worker" },
      goal: "Choose between optimistic concurrency and database mutex",
      question: "Which pattern provides higher throughput with lower deadlock risk?",
      current_hypothesis: "Optimistic locking with version column",
      attempts: [
        { action: "Tried pessimistic row locks", outcome: "Encountered lock contention under 100 concurrent workers" }
      ],
      evidence: {
        relevant_files: ["src/orders/lock.ts"],
        errors: ["deadlock detected on table orders"],
      },
      constraints: { read_only: true, workspace_root: "/app" },
      decision_needed: "Choose concurrency control pattern",
    };

    const brief = builder.build(request);
    expect(brief).toContain("=== DAD CONSULTATION BRIEF ===");
    expect(brief).toContain("MODE: DECIDE");
    expect(brief).toContain("## GOAL");
    expect(brief).toContain("Choose between optimistic concurrency");
    expect(brief).toContain("## OBSERVED EVIDENCE");
    expect(brief).toContain("src/orders/lock.ts");
    expect(brief).toContain("deadlock detected on table orders");
  });
});
