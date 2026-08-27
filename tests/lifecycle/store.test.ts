import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { ConsultationRequest, ConsultationAnswer } from "../../src/core/protocol";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ConsultationStore (SQLite)", () => {
  let store: ConsultationStore;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-consult-dad-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    store = new ConsultationStore(testDbPath);
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
  });

  const sampleRequest: ConsultationRequest = {
    schema: "consult-dad.request.v1",
    consultation_id: null,
    mode: "diagnose",
    caller: { agent: "gemini-cli", role: "worker" },
    goal: "Fix auth test failure",
    question: "Is this a race condition?",
    current_hypothesis: "Two refresh requests racing",
    attempts: [{ action: "Added retry", outcome: "Still fails" }],
    evidence: {
      failing_tests: ["test_refresh"],
      errors: ["TokenRefreshError"],
      relevant_files: ["src/auth.ts"],
      git_diff: null,
      logs: [],
    },
    constraints: {
      read_only: true,
      workspace_root: "/repo",
      max_followups: 3,
    },
    decision_needed: "Recommend diagnostic step",
  };

  it("creates a new consultation record and returns unique dad_ ID", () => {
    const id = store.create(sampleRequest, "ctx_01");
    expect(id).toMatch(/^dad_[A-Za-z0-9_-]+/);

    const state = store.get(id);
    expect(state).not.toBeNull();
    expect(state?.consultation_id).toBe(id);
    expect(state?.mode).toBe("diagnose");
    expect(state?.status).toBe("created");
    expect(state?.caller_id).toBe("gemini-cli");
    expect(state?.context_id).toBe("ctx_01");
    expect(state?.request.goal).toBe("Fix auth test failure");
  });

  it("updates consultation status and finished_at", () => {
    const id = store.create(sampleRequest);
    store.updateStatus(id, "running");

    let state = store.get(id);
    expect(state?.status).toBe("running");

    store.updateStatus(id, "completed");
    state = store.get(id);
    expect(state?.status).toBe("completed");
    expect(state?.finished_at).not.toBeNull();
  });

  it("saves structured answer", () => {
    const id = store.create(sampleRequest);
    const answer: ConsultationAnswer = {
      schema: "consult-dad.answer.v1",
      consultation_id: id,
      status: "completed",
      advisor: { id: "staff", adapter: "codex" },
      verdict: "Shared state race",
      recommendation: ["Remove retry", "Isolate token storage"],
      assumptions: ["Shared worker state"],
      risks: ["Masking real issue"],
      verification: ["Run 100 times"],
      confidence: "high",
      worker_action: "continue",
      needs_followup: false,
    };

    store.saveAnswer(id, answer);
    const state = store.get(id);
    expect(state?.answer).toEqual(answer);
  });

  it("appends and retrieves lifecycle events", () => {
    const id = store.create(sampleRequest);
    store.appendEvent(id, "advisor_spawned", "Codex adapter started");
    store.appendEvent(id, "output_received", "Tokens received");

    const state = store.get(id);
    expect(state?.events.length).toBe(2);
    expect(state?.events[0].type).toBe("advisor_spawned");
    expect(state?.events[0].detail).toBe("Codex adapter started");
  });

  it("lists consultations with filtering", () => {
    const id1 = store.create({ ...sampleRequest, goal: "Task 1" }, "ctx_A");
    const id2 = store.create({ ...sampleRequest, goal: "Task 2" }, "ctx_B");
    store.updateStatus(id1, "completed");

    const all = store.list();
    expect(all.length).toBe(2);

    const completedOnly = store.list({ status: "completed" });
    expect(completedOnly.length).toBe(1);
    expect(completedOnly[0].consultation_id).toBe(id1);

    const ctxBOnly = store.list({ contextId: "ctx_B" });
    expect(ctxBOnly.length).toBe(1);
    expect(ctxBOnly[0].consultation_id).toBe(id2);
  });

  it("keeps concurrent consultations strictly isolated", () => {
    const idA = store.create({ ...sampleRequest, goal: "Consultation A" });
    const idB = store.create({ ...sampleRequest, goal: "Consultation B" });

    store.appendEvent(idA, "event_a", "detail_a");
    store.appendEvent(idB, "event_b", "detail_b");

    const stateA = store.get(idA);
    const stateB = store.get(idB);

    expect(stateA?.events.map((e) => e.type)).toEqual(["event_a"]);
    expect(stateB?.events.map((e) => e.type)).toEqual(["event_b"]);
  });
});

describe("ArtifactStore", () => {
  let testDir: string;
  let artifactStore: ArtifactStore;

  beforeEach(() => {
    testDir = join(tmpdir(), `test-consult-dad-artifacts-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    artifactStore = new ArtifactStore(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("writes and reads consultation artifacts on disk", () => {
    const consultationId = "dad_test_123";
    artifactStore.initConsultation(consultationId);

    const reqData = { goal: "test goal" };
    artifactStore.writeJson(consultationId, "request.json", reqData);
    expect(artifactStore.readJson(consultationId, "request.json")).toEqual(reqData);

    artifactStore.appendLog(consultationId, "stderr.log", "some stderr line\n");
    expect(artifactStore.readText(consultationId, "stderr.log")).toContain("some stderr line");
  });
});
