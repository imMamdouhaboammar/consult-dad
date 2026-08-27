import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { AdvisorRegistry } from "../../src/core/routing";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { EscalationDetector } from "../../src/core/escalation";
import { createMcpToolDefinitions } from "../../src/mcp/tools";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync } from "node:fs";

describe("E2E Acceptance: Full Consultation Scenario", () => {
  let testDbPath: string;
  let testDir: string;
  let store: ConsultationStore;
  let artifactStore: ArtifactStore;
  let registry: AdvisorRegistry;
  let broker: ConsultationBroker;
  let staffAdapter: FakeAdvisorAdapter;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDir = join(tmpdir(), `test-e2e-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    store = new ConsultationStore(testDbPath);
    artifactStore = new ArtifactStore(testDir);
    staffAdapter = new FakeAdvisorAdapter({
      id: "staff",
      customVerdict: "Token refresher lacks single-flight mutex around refresh call",
    });

    registry = new AdvisorRegistry();
    registry.register({
      adapter: staffAdapter,
      priority: 100,
      capabilities: ["debugging", "concurrency", "architecture"],
    });

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

  it("completes full realistic lifecycle: worker gets stuck -> detects escalation -> consults via MCP -> applies advice -> followups -> finishes", async () => {
    // 1. Worker detects escalation condition
    const detector = new EscalationDetector();
    const escalationDecision = detector.shouldConsult({
      attemptsCount: 2,
      question: "Why does concurrent token refresh fail with 401?",
      lastErrors: ["invalid_grant", "invalid_grant"],
    });

    expect(escalationDecision.should).toBe(true);
    expect(escalationDecision.mode).toBe("diagnose");

    // 2. Worker calls dad_consult via MCP
    const tools = createMcpToolDefinitions(broker, registry);
    const consultTool = tools.find((t) => t.name === "dad_consult")!;
    const followupTool = tools.find((t) => t.name === "dad_followup")!;

    const consultResult = await consultTool.handler({
      goal: "Fix intermittent token refresh failure",
      question: "Why does concurrent token refresh fail with 401?",
      mode: escalationDecision.mode,
      current_hypothesis: "Two refresh requests racing for single-use token",
      relevant_files: ["src/auth/token_refresh.ts"],
      errors: ["invalid_grant: token already consumed with secret sk-test1234567890abcdefghij"],
    });

    expect(consultResult.isError).toBe(false);
    const answer = JSON.parse(consultResult.content[0].text);
    const consultationId = answer.consultation_id;

    expect(consultationId).toMatch(/^dad_/);
    expect(answer.verdict).toContain("Token refresher lacks single-flight mutex");
    expect(answer.worker_action).toBe("continue");

    // 3. Worker tests new hypothesis, discovers new edge case, calls dad_followup
    const followupResult = await followupTool.handler({
      consultation_id: consultationId,
      message: "Implemented single-flight mutex, but queue depth spikes under 500rps",
    });

    expect(followupResult.isError).toBe(false);
    const refinedAnswer = JSON.parse(followupResult.content[0].text);

    expect(refinedAnswer.consultation_id).toBe(consultationId);
    expect(refinedAnswer.verdict).toContain("Refined advice after followup");

    // 4. Verify persistent artifacts on disk
    const savedReq = artifactStore.readJson(consultationId, "request.json");
    const savedAns = artifactStore.readJson(consultationId, "answer.json");
    expect(savedReq).not.toBeNull();
    expect(savedAns).not.toBeNull();

    // 5. Verify final status
    const state = broker.status(consultationId);
    expect(state?.status).toBe("completed");
  });
});
