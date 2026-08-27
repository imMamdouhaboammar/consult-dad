import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMcpToolDefinitions } from "../../src/mcp/tools";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { AdvisorRegistry } from "../../src/core/routing";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync } from "node:fs";

describe("MCP Tools & Server", () => {
  let store: ConsultationStore;
  let artifactStore: ArtifactStore;
  let registry: AdvisorRegistry;
  let broker: ConsultationBroker;
  let fakeAdapter: FakeAdvisorAdapter;
  let testDbPath: string;
  let testDir: string;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDir = join(tmpdir(), `test-mcp-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    store = new ConsultationStore(testDbPath);
    artifactStore = new ArtifactStore(testDir);
    fakeAdapter = new FakeAdvisorAdapter({ id: "staff", customVerdict: "MCP Staff Advice" });
    registry = new AdvisorRegistry();
    registry.register({ adapter: fakeAdapter, priority: 100, capabilities: ["debugging", "architecture"] });

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

  it("registers all 7 MCP tools", () => {
    const tools = createMcpToolDefinitions(broker, registry);
    const names = tools.map((t) => t.name);

    expect(names).toEqual([
      "dad_consult",
      "dad_followup",
      "dad_status",
      "dad_result",
      "dad_cancel",
      "dad_list_advisors",
      "dad_explain_route",
    ]);
  });

  it("dad_consult tool executes and returns valid answer", async () => {
    const tools = createMcpToolDefinitions(broker, registry);
    const consultTool = tools.find((t) => t.name === "dad_consult")!;

    const result = await consultTool.handler({
      goal: "Fix database deadlock",
      question: "Which isolation level is needed?",
      mode: "diagnose",
    });

    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.schema).toBe("consult-dad.answer.v1");
    expect(parsed.verdict).toBe("MCP Staff Advice");
    expect(parsed.consultation_id).toMatch(/^dad_/);
  });

  it("dad_followup tool resumes existing thread with consultation_id handle", async () => {
    const tools = createMcpToolDefinitions(broker, registry);
    const consultTool = tools.find((t) => t.name === "dad_consult")!;
    const followupTool = tools.find((t) => t.name === "dad_followup")!;

    const consultRes = await consultTool.handler({
      goal: "Test followup",
      question: "Initial question",
    });

    const initialAnswer = JSON.parse(consultRes.content[0].text);
    const cid = initialAnswer.consultation_id;

    const followupRes = await followupTool.handler({
      consultation_id: cid,
      message: "Option A caused high CPU",
    });

    expect(followupRes.isError).toBe(false);
    const updatedAnswer = JSON.parse(followupRes.content[0].text);
    expect(updatedAnswer.consultation_id).toBe(cid);
    expect(updatedAnswer.verdict).toContain("Refined advice after followup");
  });

  it("dad_list_advisors tool returns available advisors", async () => {
    const tools = createMcpToolDefinitions(broker, registry);
    const listTool = tools.find((t) => t.name === "dad_list_advisors")!;

    const res = await listTool.handler({});
    expect(res.isError).toBe(false);
    const list = JSON.parse(res.content[0].text);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].id).toBe("staff");
  });
});
