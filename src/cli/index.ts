#!/usr/bin/env bun
import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { AdvisorRegistry } from "../core/routing";
import { ConfigLoader } from "../config/loader";
import { ConfigTrust } from "../security/config-trust";

import { createAskCommand } from "./ask";
import { createFollowupCommand } from "./followup";
import { createStatusCommand } from "./status";
import { createResultCommand } from "./result";
import { createCancelCommand } from "./cancel";
import { createAdvisorsCommand } from "./advisors";
import { createDoctorCommand } from "./doctor";
import { createServeCommand } from "./serve";
import { createTrustCommand } from "./trust";
import { createInitCommand } from "./init";
import { createLogsCommand } from "./logs";
import { createPruneCommand } from "./prune";
import { join } from "node:path";

export interface CliDependencies {
  store?: ConsultationStore;
  artifactStore?: ArtifactStore;
  registry?: AdvisorRegistry;
  broker?: ConsultationBroker;
  configTrust?: ConfigTrust;
  workspaceRoot?: string;
}

export function createCli(deps: CliDependencies = {}): Command {
  const defaultTrust = deps.configTrust || new ConfigTrust();
  const defaultStore =
    deps.store ||
    new ConsultationStore(join(process.env.HOME || "", ".local/state/consult-dad/consult-dad.db"));
  const defaultArtifactStore =
    deps.artifactStore ||
    new ArtifactStore(join(process.env.HOME || "", ".local/state/consult-dad/consultations"));

  const defaultRegistry = deps.registry || new AdvisorRegistry();

  if (!deps.registry) {
    const loader = new ConfigLoader({
      workspaceRoot: deps.workspaceRoot || process.cwd(),
      configTrust: defaultTrust,
    });
    const loadedConfig = loader.load();
    loader.applyToRegistry(loadedConfig.config, defaultRegistry);
  }

  const defaultBroker =
    deps.broker ||
    new ConsultationBroker({
      store: defaultStore,
      artifactStore: defaultArtifactStore,
      registry: defaultRegistry,
    });

  const program = new Command();
  program
    .name("dad")
    .description("Consult Dad — Local escalation bridge for AI coding agents")
    .version("0.0.1");

  program.addCommand(createAskCommand(defaultBroker));
  program.addCommand(createFollowupCommand(defaultBroker));
  program.addCommand(createStatusCommand(defaultBroker));
  program.addCommand(createResultCommand(defaultBroker));
  program.addCommand(createCancelCommand(defaultBroker));
  program.addCommand(createAdvisorsCommand(defaultRegistry));
  program.addCommand(
    createDoctorCommand(defaultRegistry, defaultStore, defaultArtifactStore, defaultTrust)
  );
  program.addCommand(createServeCommand());
  program.addCommand(createTrustCommand());
  program.addCommand(createInitCommand(defaultTrust));
  program.addCommand(createLogsCommand(defaultBroker, defaultArtifactStore));
  program.addCommand(createPruneCommand(defaultStore, defaultArtifactStore));

  return program;
}

if (import.meta.main) {
  const cli = createCli();
  cli.parse(process.argv);
}
