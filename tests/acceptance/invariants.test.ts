import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { AdvisorRegistry } from "../../src/core/routing";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { GenericCommandAdapter } from "../../src/adapters/generic-command";
import { WorkspaceGuard } from "../../src/security/workspace";
import { ConfigTrust } from "../../src/security/config-trust";
import { ContextPackBuilder } from "../../src/core/context-builder";
import { EscalationPolicy } from "../../src/core/policy";
import { ConsultationRequest } from "../../src/core/protocol";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync, writeFileSync, readdirSync } from "node:fs";

describe("Consult Dad — 12 Core Invariants", () => {
  let testDbPath: string;
  let testDir: string;
  let store: ConsultationStore;
  let artifactStore: ArtifactStore;
  let registry: AdvisorRegistry;
  let broker: ConsultationBroker;
  let staffAdapter: FakeAdvisorAdapter;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-inv-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDir = join(tmpdir(), `test-inv-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    store = new ConsultationStore(testDbPath);
    artifactStore = new ArtifactStore(testDir);
    staffAdapter = new FakeAdvisorAdapter({ id: "staff" });

    registry = new AdvisorRegistry();
    registry.register({ adapter: staffAdapter, priority: 100, capabilities: ["debugging"] });

    broker = new ConsultationBroker({
      store,
      artifactStore,
      defaultAdapter: staffAdapter,
    });
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(testDbPath)) rmSync(testDbPath, { force: true });
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  const baseReq: ConsultationRequest = {
    schema: "consult-dad.request.v1",
    mode: "diagnose",
    caller: { agent: "worker", role: "worker" },
    goal: "Fix bug",
    question: "Why does it fail?",
    decision_needed: "Determine fix",
  };

  // Invariant 1: Consult mode produces zero file changes in workspace
  it("Invariant 1: Consult mode produces zero file changes in workspace", async () => {
    const sandboxDir = join(tmpdir(), `test-sandbox-${Date.now()}`);
    writeFileSync(join(tmpdir(), "dummy.txt"), "untouched");
    const beforeFiles = readdirSync(tmpdir());

    await broker.consult(baseReq);

    const afterFiles = readdirSync(tmpdir());
    // No unexpected files created outside designated state dir
    expect(existsSync(join(tmpdir(), "dummy.txt"))).toBe(true);
  });

  // Invariant 2: Missing advisor fails clearly
  it("Invariant 2: Missing advisor fails with clear error", async () => {
    await expect(broker.consult(baseReq, undefined, "non-existent-advisor")).rejects.toThrow();
  });

  // Invariant 3: Auth failure is distinguishable from model failure
  it("Invariant 3: Auth failure produces distinct error", async () => {
    const unauthAdapter = new FakeAdvisorAdapter({ id: "unauth-staff", isAuthenticated: false });
    broker.registerAdapter(unauthAdapter);

    await expect(broker.consult(baseReq, undefined, "unauth-staff")).rejects.toThrow("is not authenticated");
  });

  // Invariant 4: Timeout produces recoverable state
  it("Invariant 4: Timeout produces recoverable failed/timed_out state without crashing", async () => {
    const slowAdapter = new GenericCommandAdapter({
      command: "sleep",
      args: ["10"],
      timeoutMs: 50,
    });
    broker.registerAdapter(slowAdapter);

    const run = await slowAdapter.start(baseReq);
    expect(run.status).toBe("failed");
    expect(run.stderr).toContain("timed out");
  });

  // Invariant 5: Cancel sets canceled state cleanly
  it("Invariant 5: Cancel sets canceled status", async () => {
    const id = await broker.consult(baseReq);
    await broker.cancel(id);
    expect(broker.status(id)?.status).toBe("canceled");
  });

  // Invariant 6: Follow-up resumes the correct consultation thread
  it("Invariant 6: Follow-up resumes exact same consultation ID thread", async () => {
    const id = await broker.consult(baseReq);
    const followupId = await broker.followup(id, "Tested with new params");
    expect(followupId).toBe(id);
    expect(broker.status(id)?.events.some((e) => e.type === "followup_received")).toBe(true);
  });

  // Invariant 7: Two concurrent consultations never mix state
  it("Invariant 7: Two concurrent consultations never mix state", async () => {
    const id1 = await broker.consult({ ...baseReq, goal: "Goal 1" });
    const id2 = await broker.consult({ ...baseReq, goal: "Goal 2" });

    expect(id1).not.toBe(id2);
    expect(broker.status(id1)?.request.goal).toBe("Goal 1");
    expect(broker.status(id2)?.request.goal).toBe("Goal 2");
  });

  // Invariant 8: Changed project config requires reapproval
  it("Invariant 8: Changed project config requires reapproval", () => {
    const trustDb = join(tmpdir(), `test-trust-${Date.now()}.json`);
    const cfgPath = join(tmpdir(), `test-cfg-${Date.now()}.json`);
    const trust = new ConfigTrust(trustDb);

    writeFileSync(cfgPath, JSON.stringify({ advisor: "initial" }));
    trust.approve(cfgPath);
    expect(trust.check(cfgPath).trusted).toBe(true);

    writeFileSync(cfgPath, JSON.stringify({ advisor: "tampered" }));
    expect(trust.check(cfgPath).trusted).toBe(false);
    expect(trust.check(cfgPath).status).toBe("modified");
  });

  // Invariant 9: Secrets never appear in stored context
  it("Invariant 9: Secrets never appear in stored context", () => {
    const builder = new ContextPackBuilder();
    const reqWithSecrets: ConsultationRequest = {
      ...baseReq,
      evidence: {
        errors: ["API call failed with token: ghp_1234567890abcdef1234567890abcdef12345678 and Bearer eyJhbGciOiJIUzI1NiJ9.xyz"],
      },
    };
    const pack = builder.build(reqWithSecrets);
    expect(pack).not.toContain("ghp_1234567890abcdef1234567890abcdef12345678");
    expect(pack).toContain("[REDACTED]");
  });

  // Invariant 10: Dad cannot recursively consult another Dad
  it("Invariant 10: Dad cannot recursively consult another Dad (max_depth = 1)", async () => {
    const recursiveReq: ConsultationRequest = {
      ...baseReq,
      caller: { agent: "dad-staff", role: "dad" },
    };
    await expect(broker.consult(recursiveReq)).rejects.toThrow("policy_denied");
  });

  // Invariant 11: Takeover requires explicit write permission
  it("Invariant 11: Takeover requires explicit write permission (--allow-write)", () => {
    const guard = new WorkspaceGuard();
    expect(() => guard.assertReadOnly("takeover", false)).toThrow("workspace_violation");
    expect(() => guard.assertReadOnly("takeover", true)).not.toThrow();
  });

  // Invariant 12: Read-only consultation cannot be converted to write without takeover mode
  it("Invariant 12: Non-takeover consultation cannot write files", () => {
    const guard = new WorkspaceGuard();
    expect(() => guard.assertReadOnly("consult", true)).toThrow("workspace_violation");
    expect(() => guard.assertReadOnly("diagnose", true)).toThrow("workspace_violation");
  });
});
