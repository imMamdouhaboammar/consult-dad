import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConsultationBroker } from "../broker/broker";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { AdvisorRegistry } from "../core/routing";
import { ConfigLoader } from "../config/loader";
import { ConfigTrust } from "../security/config-trust";
import { createMcpServer } from "./server";
import { join } from "node:path";

export async function runStdioServer(): Promise<void> {
  const store = new ConsultationStore(
    join(process.env.HOME || "", ".local/state/consult-dad/consult-dad.db")
  );
  const artifactStore = new ArtifactStore(
    join(process.env.HOME || "", ".local/state/consult-dad/consultations")
  );

  const trust = new ConfigTrust();
  const registry = new AdvisorRegistry();
  const loader = new ConfigLoader({
    workspaceRoot: process.cwd(),
    configTrust: trust,
  });

  const loaded = loader.load();
  loader.applyToRegistry(loaded.config, registry);

  const broker = new ConsultationBroker({
    store,
    artifactStore,
    registry,
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
