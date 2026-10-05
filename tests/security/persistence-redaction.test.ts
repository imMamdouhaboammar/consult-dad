import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { ConsultationAnswer, ConsultationRequest } from "../../src/core/protocol";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SECRET = ["ghp_", "synthetic", "credential", "fixture", "only", "1234567890"].join("");
const REDACTED = "[REDACTED]";

describe("Persistence redaction boundary", () => {
  let dbPath: string;
  let artifactDir: string;
  let store: ConsultationStore;
  let artifacts: ArtifactStore;

  beforeEach(() => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dbPath = join(tmpdir(), `consult-dad-redaction-${suffix}.db`);
    artifactDir = join(tmpdir(), `consult-dad-redaction-${suffix}`);
    store = new ConsultationStore(dbPath);
    artifacts = new ArtifactStore(artifactDir);
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
    if (existsSync(artifactDir)) {
      rmSync(artifactDir, { recursive: true, force: true });
    }
  });

  const requestWithSecret = (): ConsultationRequest => ({
    schema: "consult-dad.request.v1",
    consultation_id: null,
    mode: "diagnose",
    caller: { agent: "test-worker", role: "worker" },
    goal: "Diagnose auth failure",
    question: "Why did authentication fail?",
    current_hypothesis: `Credential reflection: ${SECRET}`,
    attempts: [
      {
        action: "Captured failing request",
        outcome: `Server echoed ${SECRET}`,
      },
    ],
    evidence: {
      errors: [`Authorization failed for ${SECRET}`],
      logs: [`debug token=${SECRET}`],
      relevant_files: ["src/auth.ts"],
      failing_tests: [],
      git_diff: null,
    },
    constraints: {
      read_only: true,
      max_followups: 5,
    },
    decision_needed: "Recommend a safe diagnostic step",
  });

  it("sanitizes request, answer, and event data at the SQLite persistence boundary", () => {
    const request = requestWithSecret();
    const id = store.create(request);

    const answer: ConsultationAnswer = {
      schema: "consult-dad.answer.v1",
      consultation_id: id,
      status: "completed",
      advisor: { id: "test-advisor", adapter: "fake" },
      verdict: `Advisor reflected ${SECRET}`,
      recommendation: [`Never persist ${SECRET}`],
      assumptions: [],
      risks: [`Leak ${SECRET}`],
      verification: [],
      confidence: "high",
      worker_action: "continue",
      needs_followup: false,
    };

    store.saveAnswer(id, answer);
    store.appendEvent(id, "followup_received", `New evidence contained ${SECRET}`);

    const state = store.get(id);
    const serialized = JSON.stringify(state);

    expect(serialized).not.toContain(SECRET);
    expect(serialized).toContain(REDACTED);
  });

  it("sanitizes JSON, text, and log content at the artifact persistence boundary", () => {
    const id = "dad_redaction_artifacts";

    artifacts.writeJson(id, "request.json", {
      nested: {
        errors: [`Request contained ${SECRET}`],
      },
    });
    artifacts.writeText(id, "notes.txt", `Note: ${SECRET}`);
    artifacts.appendLog(id, "stderr.log", `stderr leaked ${SECRET}\n`);

    const requestArtifact = JSON.stringify(artifacts.readJson(id, "request.json"));
    const notes = artifacts.readText(id, "notes.txt") || "";
    const stderr = artifacts.readLog(id, "stderr.log") || "";
    const combined = [requestArtifact, notes, stderr].join("\n");

    expect(combined).not.toContain(SECRET);
    expect(combined).toContain(REDACTED);
  });

  it("does not persist a supported secret when it appears in an artifact object key", () => {
    const id = "dad_redaction_key";
    artifacts.writeJson(id, "key.json", {
      [`credential-${SECRET}`]: "synthetic-value",
    });

    const persisted = artifacts.readText(id, "key.json") || "";
    expect(persisted).not.toContain(SECRET);
    expect(persisted).toContain("[REDACTED]");
  });

  it("redacts a supported multiline secret split across successive log appends", () => {
    const id = "dad_split_log";
    const begin = "-----BEGIN TEST PRIVATE KEY-----";
    const end = "-----END TEST PRIVATE KEY-----";
    const first = `${begin}\nsynthetic-part-one-`;
    const second = `synthetic-part-two\n${end}\n`;

    artifacts.appendLog(id, "stderr.log", first);
    artifacts.appendLog(id, "stderr.log", second);

    const persisted = artifacts.readLog(id, "stderr.log") || "";
    expect(persisted).not.toContain("synthetic-part-one-");
    expect(persisted).not.toContain("synthetic-part-two");
    expect(persisted).toContain("[REDACTED]");
  });

  it("keeps request and reflected advisor answer secrets out of broker durable state", async () => {
    const adapter = new FakeAdvisorAdapter({
      id: "reflecting-advisor",
      customVerdict: `Reflected advisor value: ${SECRET}`,
    });
    const broker = new ConsultationBroker({
      store,
      artifactStore: artifacts,
      defaultAdapter: adapter,
    });

    const id = await broker.consult(requestWithSecret());
    const state = broker.status(id);
    const requestArtifact = artifacts.readJson(id, "request.json");
    const answerArtifact = artifacts.readJson(id, "answer.json");

    const durable = JSON.stringify({
      state,
      requestArtifact,
      answerArtifact,
    });

    expect(durable).not.toContain(SECRET);
    expect(durable).toContain(REDACTED);
  });

  it("sanitizes followup event details and reflected followup answers before persistence", async () => {
    const adapter = new FakeAdvisorAdapter({ id: "followup-advisor" });
    const broker = new ConsultationBroker({
      store,
      artifactStore: artifacts,
      defaultAdapter: adapter,
    });

    const cleanRequest: ConsultationRequest = {
      ...requestWithSecret(),
      current_hypothesis: "No secret in initial request",
      attempts: [],
      evidence: {},
    };

    const id = await broker.consult(cleanRequest);
    await broker.followup(id, `Followup contains ${SECRET}`);

    const state = broker.status(id);
    const answerArtifact = artifacts.readJson(id, "answer.json");
    const followupEvent = state?.events.find((event) => event.type === "followup_received");

    expect(followupEvent?.detail).not.toContain(SECRET);
    expect(followupEvent?.detail).toContain(REDACTED);
    expect(JSON.stringify(state?.answer)).not.toContain(SECRET);
    expect(JSON.stringify(answerArtifact)).not.toContain(SECRET);
  });

  it("sanitizes advisor stderr in persisted events and stderr.log", async () => {
    const adapter = new FakeAdvisorAdapter({ id: "failing-advisor" });
    adapter.start = async (request) => ({
      consultation_id: request.consultation_id || "dad_failed",
      advisor_id: adapter.id,
      native_session_id: null,
      status: "failed",
      answer: null,
      stderr: `Advisor failed with credential ${SECRET}`,
    });

    const broker = new ConsultationBroker({
      store,
      artifactStore: artifacts,
      defaultAdapter: adapter,
    });

    const cleanRequest: ConsultationRequest = {
      ...requestWithSecret(),
      current_hypothesis: "Clean hypothesis",
      attempts: [],
      evidence: {},
    };

    const id = await broker.consult(cleanRequest);
    const state = broker.status(id);
    const stderrLog = artifacts.readLog(id, "stderr.log") || "";
    const persisted = JSON.stringify({ state, stderrLog });

    expect(persisted).not.toContain(SECRET);
    expect(persisted).toContain(REDACTED);
  });
});
