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

describe("High-Concurrency Stress & SQLite WAL Hardening", () => {
  let testDbPath: string;
  let testDir: string;
  let store: ConsultationStore;
  let artifactStore: ArtifactStore;
  let registry: AdvisorRegistry;
  let broker: ConsultationBroker;
  let fakeAdapter: FakeAdvisorAdapter;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-stress-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDir = join(tmpdir(), `test-stress-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    store = new ConsultationStore(testDbPath);
    artifactStore = new ArtifactStore(testDir);
    fakeAdapter = new FakeAdvisorAdapter({ id: "staff", customVerdict: "Concurrent Verdict" });
    registry = new AdvisorRegistry();
    registry.register({ adapter: fakeAdapter, priority: 100, capabilities: ["general", "concurrency"] });

    broker = new ConsultationBroker({
      store,
      artifactStore,
      registry,
    });
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(testDbPath)) rmSync(testDbPath, { force: true });
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it("handles 50 simultaneous consultations without lock collision or state corruption", async () => {
    const totalConsultations = 50;
    const requests: ConsultationRequest[] = Array.from({ length: totalConsultations }, (_, i) => ({
      schema: "consult-dad.request.v1",
      consultation_id: null,
      mode: "diagnose",
      caller: { agent: `worker-${i}`, role: "worker" },
      goal: `Resolve concurrency race condition #${i}`,
      question: `How to handle concurrent write batch #${i}?`,
      attempts: [{ action: "Attempted retry", outcome: "Collision" }],
      evidence: { relevant_files: [`src/worker_${i}.ts`] },
      constraints: { read_only: true },
      decision_needed: `Decision for worker #${i}`,
    }));

    // Launch all 50 in parallel
    const start = performance.now();
    const ids = await Promise.all(requests.map((req) => broker.consult(req)));
    const durationMs = performance.now() - start;

    expect(ids.length).toBe(totalConsultations);

    // Verify all IDs are unique
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(totalConsultations);

    // Verify all consultations completed successfully with answers
    const answers = await Promise.all(ids.map((id) => broker.result(id)));
    for (let i = 0; i < totalConsultations; i++) {
      expect(answers[i].consultation_id).toBe(ids[i]);
      expect(answers[i].status).toBe("completed");
      expect(answers[i].verdict).toBe("Concurrent Verdict");

      const diskAnswer = artifactStore.readJson(ids[i], "answer.json");
      expect(diskAnswer).not.toBeNull();
      expect(diskAnswer.consultation_id).toBe(ids[i]);
    }

    console.log(`[Stress Test] 50 concurrent consultations completed cleanly in ${durationMs.toFixed(2)}ms`);
  });

  it("handles simultaneous followups across multiple threads", async () => {
    const count = 20;
    const initialIds = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        broker.consult({
          mode: "decide",
          caller: { agent: `agent-${i}`, role: "worker" },
          goal: `Goal ${i}`,
          question: `Question ${i}`,
          decision_needed: `Decision ${i}`,
        })
      )
    );

    // Launch 20 concurrent followups
    const followupResults = await Promise.all(
      initialIds.map((id, i) => broker.followup(id, `New observation for thread ${i}`))
    );

    expect(followupResults.length).toBe(count);
    for (let i = 0; i < count; i++) {
      const state = broker.status(initialIds[i]);
      expect(state?.status).toBe("completed");
      expect(state?.events.length).toBeGreaterThanOrEqual(4);
    }
  });
});
