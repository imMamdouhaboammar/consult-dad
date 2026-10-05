import { describe, it, expect } from "vitest";
import { GenericCommandAdapter } from "../../src/adapters/generic-command";
import { ConsultationRequest } from "../../src/core/protocol";

describe("GenericCommandAdapter", () => {
  const req: ConsultationRequest = {
    schema: "consult-dad.request.v1",
    consultation_id: "dad_gen_test",
    mode: "diagnose",
    caller: { agent: "test-caller", role: "worker" },
    goal: "Test command execution",
    question: "Does the command run and output valid answer?",
    decision_needed: "Return verdict",
  };

  it("probes successfully for standard system command like cat", async () => {
    const adapter = new GenericCommandAdapter({ command: "cat" });
    const avail = await adapter.probe();
    expect(avail.available).toBe(true);
  });

  it("handles prose output from a command that exits without reading stdin", async () => {
    const adapter = new GenericCommandAdapter({
      command: "echo",
      args: ["Use an atomic transaction with rollback"],
    });

    const run = await adapter.start(req);
    expect(run.status).toBe("completed");
    expect(run.answer).not.toBeNull();
    expect(run.answer?.verdict).toContain("Use an atomic transaction");
    expect(run.answer?.worker_action).toBe("continue");
  });

  it("delivers the consultation brief to commands that consume stdin", async () => {
    const adapter = new GenericCommandAdapter({ command: "cat" });

    const run = await adapter.start(req);
    expect(run.status).toBe("completed");
    expect(run.answer?.verdict).toContain("=== DAD CONSULTATION BRIEF ===");
    expect(run.answer?.verdict).toContain("Test command execution");
  });

  it("parses valid JSON response from custom command", async () => {
    const jsonOutput = JSON.stringify({
      status: "completed",
      advisor: { id: "custom-json-bot", adapter: "generic-command" },
      verdict: "Root cause is race in token store",
      recommendation: ["Use single-flight mutex"],
      assumptions: [],
      risks: [],
      verification: ["Run race detector"],
      confidence: "high",
      worker_action: "continue",
      needs_followup: false,
    });

    const adapter = new GenericCommandAdapter({
      command: "echo",
      args: [jsonOutput],
    });

    const run = await adapter.start(req);
    expect(run.status).toBe("completed");
    expect(run.answer?.verdict).toBe("Root cause is race in token store");
    expect(run.answer?.recommendation).toEqual(["Use single-flight mutex"]);
  });

  it("reports non-zero process exits as failed advisor runs", async () => {
    const adapter = new GenericCommandAdapter({
      command: "sh",
      args: ["-c", "exit 7"],
    });

    const run = await adapter.start(req);
    expect(run.status).toBe("failed");
    expect(run.stderr).toContain("Process exited with code 7");
  });

  it("settles timeouts once as failed advisor runs", async () => {
    const adapter = new GenericCommandAdapter({
      command: "sh",
      args: ["-c", "sleep 1"],
      timeoutMs: 20,
    });

    const run = await adapter.start(req);
    expect(run.status).toBe("failed");
    expect(run.stderr).toContain("timed out");
  });

  it("handles non-existent command gracefully", async () => {
    const adapter = new GenericCommandAdapter({
      command: "non_existent_command_123456789",
    });
    const avail = await adapter.probe();
    expect(avail.available).toBe(false);

    const run = await adapter.start(req);
    expect(run.status).toBe("failed");
    expect(run.stderr).toContain("error");
  });
});
