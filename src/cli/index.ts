#!/usr/bin/env bun
import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { AdvisorRegistry } from "../core/routing";
import { CodexAdapter } from "../adapters/codex";
import { ClaudeAdapter } from "../adapters/claude";
import { FakeAdvisorAdapter } from "../adapters/fake";

import { createAskCommand } from "./ask";
import { createFollowupCommand } from "./followup";
import { createStatusCommand } from "./status";
import { createResultCommand } from "./result";
import { createCancelCommand } from "./cancel";
import { createAdvisorsCommand } from "./advisors";
import { createDoctorCommand } from "./doctor";
import { createServeCommand } from "./serve";
import { createTrustCommand } from "./trust";
import { join } from "node:path";

export interface CliDependencies {
  store?: ConsultationStore;
  artifactStore?: ArtifactStore;
  registry?: AdvisorRegistry;
  broker?: ConsultationBroker;
}

export function createCli(deps: CliDependencies = {}): Command {
  const defaultStore =
    deps.store || new ConsultationStore(join(process.env.HOME || "", ".local/state/consult-dad/consult-dad.db"));
  const defaultArtifactStore =
    deps.artifactStore || new ArtifactStore(join(process.env.HOME || "", ".local/state/consult-dad/consultations"));

  const defaultRegistry = deps.registry || new AdvisorRegistry();

  if (!deps.registry) {
    const codex = new CodexAdapter({ id: "staff" });
    const claude = new ClaudeAdapter({ id: "architect" });
    const fake = new FakeAdvisorAdapter({ id: "fake-advisor" });

    defaultRegistry.register({
      adapter: codex,
      priority: 100,
      capabilities: ["architecture", "debugging", "code-review", "concurrency"],
      description: "Codex Staff Engineer",
    });
    defaultRegistry.register({
      adapter: claude,
      priority: 90,
      capabilities: ["architecture", "design", "tradeoffs"],
      description: "Claude Principal Architect",
    });
    defaultRegistry.register({
      adapter: fake,
      priority: 10,
      capabilities: ["general", "testing"],
      description: "Local Mock Advisor",
    });
  }

  const defaultBroker =
    deps.broker ||
    new ConsultationBroker({
      store: defaultStore,
      artifactStore: defaultArtifactStore,
      defaultAdapter: new FakeAdvisorAdapter({ id: "staff" }),
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
  program.addCommand(createDoctorCommand(defaultRegistry, defaultStore, defaultArtifactStore));
  program.addCommand(createServeCommand());
  program.addCommand(createTrustCommand());

  return program;
}

if (import.meta.main) {
  const cli = createCli();
  cli.parse(process.argv);
}
