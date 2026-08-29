import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { AdvisorRegistry } from "../../src/core/routing";
import { ConsultationRequest } from "../../src/core/protocol";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync } from "node:fs";

describe("ConsultationBroker", () => {
  let broker: ConsultationBroker;
  let store: ConsultationStore;
  let artifactStore: ArtifactStore;
  let fakeAdapter: FakeAdvisorAdapter;
  let testDbPath: string;
  let testDir: string;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-broker-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDir = join(tmpdir(), `test-broker-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    store = new ConsultationStore(testDbPath);
    artifactStore = new ArtifactStore(testDir);
    fakeAdapter = new FakeAdvisorAdapter({ id: "staff-default" });

    broker = new ConsultationBroker({
      store,
      artifactStore,
      defaultAdapter: fakeAdapter,
    });
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(testDbPath)) rmSync(testDbPath, { force: true });
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  const validReq: ConsultationRequest = {
    schema: "consult-dad.request.v1",
    consultation_id: null,
    mode: "diagnose",
    caller: { agent: "gemini-cli", role: "worker" },
    goal: "Fix deadlock",
    question: "Why do worker threads deadlock on resource lock?",
    attempts: [{ action: "Increased lock timeout", outcome: "Still deadlocks" }],
    evidence: { relevant_files: ["src/mutex.ts"] },
    constraints: { read_only: true },
    decision_needed: "Recommend lock ordering strategy",
  };

  it("orchestrates a full consultation synchronously", async () => {
    const consultationId = await broker.consult(validReq);
    expect(consultationId).toMatch(/^dad_/);

    const state = broker.status(consultationId);
    expect(state).not.toBeNull();
    expect(state?.status).toBe("completed");
    expect(state?.answer).not.toBeNull();
    expect(state?.answer?.verdict).toContain("Diagnostic analysis for: Why do worker threads deadlock");

    const answer = await broker.result(consultationId);
    expect(answer.consultation_id).toBe(consultationId);
  });

  it("supports followup on existing consultation", async () => {
    const id = await broker.consult(validReq);

    const followupId = await broker.followup(id, "Lock order B -> A failed with timeout");
    expect(followupId).toBe(id);

    const state = broker.status(id);
    expect(state?.answer?.verdict).toContain("Refined advice after followup");
  });

  it("prevents recursive consultations (max_depth enforcement)", async () => {
    const recursiveReq: ConsultationRequest = {
      ...validReq,
      caller: { agent: "dad-advisor", role: "dad" },
    };

    await expect(broker.consult(recursiveReq)).rejects.toThrow("policy_denied: Recursive Dad consultation forbidden");
  });

  it("cancels an ongoing or completed consultation", async () => {
    const id = await broker.consult(validReq);
    await broker.cancel(id);

    const state = broker.status(id);
    expect(state?.status).toBe("canceled");
  });

  it("creates artifact files on disk during consultation", async () => {
    const id = await broker.consult(validReq);
    const savedReq = artifactStore.readJson(id, "request.json");
    const savedAns = artifactStore.readJson(id, "answer.json");

    expect(savedReq).not.toBeNull();
    expect(savedAns).not.toBeNull();
    expect(savedAns.consultation_id).toBe(id);
  });

  it("resolves advisor dynamically from registry based on capabilities", async () => {
    const registry = new AdvisorRegistry();
    const specializedAdapter = new FakeAdvisorAdapter({ id: "concurrency-specialist" });
    registry.register({
      adapter: specializedAdapter,
      priority: 120,
      capabilities: ["concurrency", "debugging"],
      description: "Concurrency Specialist",
    });

    const registryBroker = new ConsultationBroker({
      store,
      artifactStore,
      registry,
    });

    const id = await registryBroker.consult(validReq);
    const state = registryBroker.status(id);
    expect(state?.advisor_id).toBe("concurrency-specialist");
  });

  it("fails over automatically to secondary advisor when primary fails", async () => {
    const registry = new AdvisorRegistry();
    const failingPrimary = new FakeAdvisorAdapter({
      id: "failing-primary",
      simulateAvailabilityError: false,
    });
    // Force start to fail on primary
    failingPrimary.start = async () => ({
      consultation_id: "test",
      advisor_id: "failing-primary",
      native_session_id: null,
      status: "failed",
      answer: null,
      stderr: "Simulated primary crash",
    });

    const backupAdvisor = new FakeAdvisorAdapter({
      id: "backup-advisor",
      customVerdict: "Backup Advisor Rescue Verdict",
    });

    registry.register({
      adapter: failingPrimary,
      priority: 200,
      capabilities: ["debugging", "concurrency"],
    });

    registry.register({
      adapter: backupAdvisor,
      priority: 100,
      capabilities: ["debugging", "concurrency"],
    });

    const failoverBroker = new ConsultationBroker({
      store,
      artifactStore,
      registry,
    });

    const id = await failoverBroker.consult(validReq);
    const answer = await failoverBroker.result(id);

    expect(answer.verdict).toBe("Backup Advisor Rescue Verdict");
    const state = failoverBroker.status(id);
    expect(state?.status).toBe("completed");
    const failoverEvent = state?.events.find((e) => e.type === "failover");
    expect(failoverEvent).toBeDefined();
    expect(failoverEvent?.detail).toContain("Failing over from 'failing-primary' to 'backup-advisor'");
  });
});
