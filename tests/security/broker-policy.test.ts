import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { ConsultationRequestInput } from "../../src/core/protocol";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Broker write-policy boundary", () => {
  let dbPath: string;
  let artifactDir: string;
  let store: ConsultationStore;
  let artifacts: ArtifactStore;
  let adapter: FakeAdvisorAdapter;
  let broker: ConsultationBroker;
  let startCalls: number;

  beforeEach(() => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dbPath = join(tmpdir(), `consult-dad-policy-${suffix}.db`);
    artifactDir = join(tmpdir(), `consult-dad-policy-${suffix}`);
    store = new ConsultationStore(dbPath);
    artifacts = new ArtifactStore(artifactDir);
    adapter = new FakeAdvisorAdapter({ id: "policy-test-advisor" });
    const originalStart = adapter.start.bind(adapter);
    startCalls = 0;
    adapter.start = async (request) => {
      startCalls += 1;
      return originalStart(request);
    };
    broker = new ConsultationBroker({
      store,
      artifactStore: artifacts,
      defaultAdapter: adapter,
    });
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
    if (existsSync(artifactDir)) rmSync(artifactDir, { recursive: true, force: true });
  });

  const request = (overrides: Partial<ConsultationRequestInput> = {}): ConsultationRequestInput => ({
    mode: "consult",
    caller: { agent: "policy-test-worker", role: "worker" },
    goal: "Check policy",
    question: "Can this request execute?",
    decision_needed: "Authorize or reject",
    ...overrides,
  });

  it("rejects write-enabled non-takeover requests before persistence or advisor execution", async () => {
    await expect(
      broker.consult(
        request({
          mode: "diagnose",
          constraints: { read_only: false },
        })
      )
    ).rejects.toThrow("policy_denied");

    expect(startCalls).toBe(0);
    expect(broker.list()).toHaveLength(0);
    expect(readdirSync(artifactDir)).toHaveLength(0);
  });

  it("rejects takeover without explicit write authorization before persistence", async () => {
    await expect(
      broker.consult(
        request({
          mode: "takeover",
          constraints: { read_only: true },
        })
      )
    ).rejects.toThrow("policy_denied");

    expect(startCalls).toBe(0);
    expect(broker.list()).toHaveLength(0);
    expect(readdirSync(artifactDir)).toHaveLength(0);
  });

  it("allows takeover only when explicit write authorization is present", async () => {
    const id = await broker.consult(
      request({
        mode: "takeover",
        constraints: { read_only: false },
      })
    );

    expect(startCalls).toBe(1);
    expect(broker.status(id)?.status).toBe("completed");
  });

  it("keeps recursive Dad protection at the same broker policy boundary", async () => {
    await expect(
      broker.consult(
        request({
          caller: { agent: "dad-advisor", role: "dad" },
        })
      )
    ).rejects.toThrow("max_depth: 1");

    expect(startCalls).toBe(0);
    expect(broker.list()).toHaveLength(0);
  });
});
