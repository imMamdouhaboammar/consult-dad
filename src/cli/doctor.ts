import { Command } from "commander";
import { AdvisorRegistry } from "../core/routing";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { ConfigTrust } from "../security/config-trust";
import { OutputFormatter } from "./output";
import { join } from "node:path";
import { existsSync } from "node:fs";

export function createDoctorCommand(
  registry: AdvisorRegistry,
  store: ConsultationStore,
  artifactStore: ArtifactStore,
  configTrust?: ConfigTrust
): Command {
  return new Command("doctor")
    .description("Verify Consult Dad local runtime, database health, config trust, and advisor readiness")
    .option("--json", "Output machine-readable JSON")
    .action(async (options: any) => {
      try {
        const diagnostics: Record<string, any> = {
          runtime: `Bun v${Bun.version}`,
          database: "healthy",
          storage: "healthy",
          config_trust: "no_project_config",
          advisors: {},
          healthy: true,
        };

        // 1. Check DB
        try {
          store.list({ limit: 1 });
          diagnostics.database = "healthy";
        } catch (e: any) {
          diagnostics.database = `error: ${e.message}`;
          diagnostics.healthy = false;
        }

        // 2. Check Storage
        try {
          artifactStore.initConsultation("doctor_probe");
          artifactStore.deleteConsultationDir("doctor_probe");
          diagnostics.storage = "healthy";
        } catch (e: any) {
          diagnostics.storage = `error: ${e.message}`;
          diagnostics.healthy = false;
        }

        // 3. Check Config Trust
        const projectConfigPath = join(process.cwd(), ".consult-dad/config.json");
        if (existsSync(projectConfigPath)) {
          const trust = (configTrust || new ConfigTrust()).check(projectConfigPath);
          diagnostics.config_trust = {
            status: trust.status,
            trusted: trust.trusted,
            path: projectConfigPath,
          };
          if (!trust.trusted) {
            diagnostics.healthy = false;
          }
        }

        // 4. Check Advisors
        const advisors = await registry.list();
        for (const adv of advisors) {
          diagnostics.advisors[adv.id] = {
            available: adv.availability.available,
            authenticated: adv.availability.authenticated,
            version: adv.availability.version || "unknown",
            capabilities: adv.capabilities,
          };
        }

        const anyAvailable = advisors.some((a) => a.availability.available);
        if (!anyAvailable) {
          diagnostics.healthy = false;
        }

        if (options.json) {
          console.log(JSON.stringify(diagnostics, null, 2));
        } else {
          console.log("\n=== Consult Dad Doctor ===\n");
          console.log(`[✓] Local Runtime:  ${diagnostics.runtime}`);
          console.log(`[✓] State Database: SQLite (${diagnostics.database})`);
          console.log(`[✓] Artifact Store: ${artifactStore["baseDir"]}`);

          if (typeof diagnostics.config_trust === "object") {
            const isTrust = diagnostics.config_trust.trusted;
            const mark = isTrust ? "✓" : "!";
            console.log(
              `[${mark}] Project Config: ${diagnostics.config_trust.status.toUpperCase()} (${diagnostics.config_trust.path})`
            );
          } else {
            console.log(`[✓] Project Config: Safe Defaults (No .consult-dad/config.json)`);
          }

          console.log("\nAdvisor Diagnostics:");
          if (advisors.length === 0) {
            console.log("  [!] No advisors registered in registry.");
          } else {
            for (const [name, info] of Object.entries(diagnostics.advisors as Record<string, any>)) {
              const mark = info.available ? "✓" : "✗";
              console.log(
                `  [${mark}] ${name.padEnd(16)}: ${info.available ? "Ready" : "Unavailable"} (caps: ${info.capabilities.join(", ")})`
              );
            }
          }

          console.log(
            `\nOverall Readiness: ${diagnostics.healthy ? "🟢 READY" : "🟡 ACTION NEEDED"}\n`
          );
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
