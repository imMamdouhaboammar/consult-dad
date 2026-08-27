import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConsultationBroker } from "../broker/broker";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { AdvisorRegistry } from "../core/routing";
import { FakeAdvisorAdapter } from "../adapters/fake";
import { CodexAdapter } from "../adapters/codex";
import { ClaudeAdapter } from "../adapters/claude";
import { createMcpServer } from "./server";
import { join } from "node:path";

export async function runStdioServer(): Promise<void> {
  const store = new ConsultationStore(
    join(process.env.HOME || "", ".local/state/consult-dad/consult-dad.db")
  );
  const artifactStore = new ArtifactStore(
    join(process.env.HOME || "", ".local/state/consult-dad/consultations")
  );

  const registry = new AdvisorRegistry();
  const staff = new CodexAdapter({ id: "staff" });
  const architect = new ClaudeAdapter({ id: "architect" });
  const fake = new FakeAdvisorAdapter({ id: "fake-advisor" });

  registry.register({
    adapter: staff,
    priority: 100,
    capabilities: ["architecture", "debugging", "code-review", "concurrency"],
  });
  registry.register({
    adapter: architect,
    priority: 90,
    capabilities: ["architecture", "design", "tradeoffs"],
  });
  registry.register({
    adapter: fake,
    priority: 10,
    capabilities: ["general", "testing"],
  });

  const broker = new ConsultationBroker({
    store,
    artifactStore,
    defaultAdapter: staff,
  });

  const server = createMcpServer(broker, registry);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  runStdioServer().catch((err) => {
    console.error("MCP server crashed:", err);
    process.exit(1);
  });
}
