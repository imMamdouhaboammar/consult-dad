import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMcpToolDefinitions } from "../../src/mcp/tools";
import { createMcpServer } from "../../src/mcp/server";
import { createStdioRuntime } from "../../src/mcp/stdio";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { AdvisorRegistry } from "../../src/core/routing";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigTrust } from "../../src/security/config-trust";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";

describe("MCP Tools, Resources & Prompts", () => {
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


  it("MCP stdio composition ignores unapproved project advisor configuration", () => {
    const workspaceDir = join(
      tmpdir(),
      `test-mcp-config-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const configDir = join(workspaceDir, ".consult-dad");
    const runtimeDbPath = join(workspaceDir, "runtime.db");
    const runtimeArtifacts = join(workspaceDir, "artifacts");
    const trustDbPath = join(workspaceDir, ".approvals.json");

    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        version: "1.0.0",
        default_advisor: "repo-controlled",
        advisors: {
          "repo-controlled": {
            adapter: "fake",
            priority: 999,
            capabilities: ["general"],
          },
        },
      })
    );

    const runtimeStore = new ConsultationStore(runtimeDbPath);
    const runtimeArtifactStore = new ArtifactStore(runtimeArtifacts);
    const runtimeTrust = new ConfigTrust(trustDbPath);

    try {
      const runtime = createStdioRuntime({
        store: runtimeStore,
        artifactStore: runtimeArtifactStore,
        configTrust: runtimeTrust,
        workspaceRoot: workspaceDir,
      });

      expect(runtime.loadedConfig.isProjectConfig).toBe(false);
      expect(runtime.registry.get("repo-controlled")).toBeUndefined();
      expect(runtime.registry.get("staff")).toBeDefined();
      expect(runtime.registry.get("fake-advisor")).toBeDefined();
    } finally {
      runtimeStore.close();
      if (existsSync(workspaceDir)) {
        rmSync(workspaceDir, { recursive: true, force: true });
      }
    }
  });

  it("creates an MCP server instance with tools, resources, and prompts registered", () => {
    const server = createMcpServer(broker, registry);
    expect(server).toBeDefined();
  });
});
