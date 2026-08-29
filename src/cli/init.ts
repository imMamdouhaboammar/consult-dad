import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigTrust } from "../security/config-trust";
import { OutputFormatter } from "./output";

const DEFAULT_CONFIG_CONTENT = {
  $schema: "https://consult-dad.dev/schemas/config.v1.json",
  version: "1.0.0",
  default_advisor: "staff",
  advisors: {
    staff: {
      adapter: "codex",
      priority: 100,
      capabilities: ["architecture", "debugging", "code-review", "concurrency"],
    },
    architect: {
      adapter: "claude",
      priority: 90,
      capabilities: ["architecture", "design", "tradeoffs", "threat-modeling"],
    },
  },
  escalation: {
    auto: true,
    max_attempts_before_consult: 2,
    max_consultations_per_task: 3,
    max_depth: 1,
    triggers: {
      architecture: true,
      auth: true,
      migrations: true,
      destructive: true,
      repeated_failure: true,
    },
  },
  timeout_ms: 120000,
};

export function createInitCommand(configTrust?: ConfigTrust): Command {
  return new Command("init")
    .description("Initialize Consult Dad project configuration (.consult-dad/config.json)")
    .option("-f, --force", "Overwrite existing configuration file", false)
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options: any) => {
      try {
        const workspaceRoot = process.cwd();
        const configDir = join(workspaceRoot, ".consult-dad");
        const configPath = join(configDir, "config.json");

        if (existsSync(configPath) && !options.force) {
          throw new Error(
            `Configuration file already exists at '${configPath}'. Use --force to overwrite.`
          );
        }

        mkdirSync(configDir, { recursive: true });
        writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG_CONTENT, null, 2), "utf-8");

        const trust = configTrust || new ConfigTrust();
        const approvedHash = trust.approve(configPath);

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                status: "initialized",
                config_path: configPath,
                hash: approvedHash,
                trusted: true,
              },
              null,
              2
            )
          );
        } else {
          console.log("\n✨ Consult Dad initialized successfully!\n");
          console.log(`  Configuration: ${configPath}`);
          console.log(`  SHA-256 Hash:  ${approvedHash}`);
          console.log(`  Trust Status:  [✓] Approved & Registered\n`);
          console.log("Next steps:");
          console.log("  1. Verify advisor health:   bun run dad doctor");
          console.log("  2. Ask a question:          bun run dad ask \"How to handle DB migration?\"\n");
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
