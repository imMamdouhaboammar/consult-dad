import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConsultationBroker } from "../broker/broker";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { AdvisorRegistry } from "../core/routing";
import { ConfigLoader, LoadedConfigResult } from "../config/loader";
import { ConfigTrust } from "../security/config-trust";
import { createMcpServer } from "./server";
import { join } from "node:path";

export interface StdioRuntimeOptions {
  store?: ConsultationStore;
  artifactStore?: ArtifactStore;
  configTrust?: ConfigTrust;
  workspaceRoot?: string;
}

export interface StdioRuntime {
  store: ConsultationStore;
  artifactStore: ArtifactStore;
  trust: ConfigTrust;
  registry: AdvisorRegistry;
  broker: ConsultationBroker;
  server: ReturnType<typeof createMcpServer>;
  loadedConfig: LoadedConfigResult;
}

export function createStdioRuntime(options: StdioRuntimeOptions = {}): StdioRuntime {
  const store =
    options.store ||
    new ConsultationStore(
      join(process.env.HOME || "", ".local/state/consult-dad/consult-dad.db")
    );
  const artifactStore =
    options.artifactStore ||
    new ArtifactStore(
      join(process.env.HOME || "", ".local/state/consult-dad/consultations")
    );

  const trust = options.configTrust || new ConfigTrust();
  const registry = new AdvisorRegistry();
  const loader = new ConfigLoader({
    workspaceRoot: options.workspaceRoot || process.cwd(),
    configTrust: trust,
  });

  const loadedConfig = loader.load();
  loader.applyToRegistry(loadedConfig.config, registry);

  const broker = new ConsultationBroker({
    store,
    artifactStore,
    registry,
  });

  const server = createMcpServer(broker, registry);

  return {
    store,
    artifactStore,
    trust,
    registry,
    broker,
    server,
    loadedConfig,
  };
}

export async function runStdioServer(): Promise<void> {
  const runtime = createStdioRuntime();
  const transport = new StdioServerTransport();
  await runtime.server.connect(transport);
}

if (import.meta.main) {
  runStdioServer().catch((err) => {
    console.error("MCP server crashed:", err);
    process.exit(1);
  });
}
