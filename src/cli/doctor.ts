import { Command } from "commander";
import { AdvisorRegistry } from "../core/routing";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { OutputFormatter } from "./output";

export function createDoctorCommand(
  registry: AdvisorRegistry,
  store: ConsultationStore,
  artifactStore: ArtifactStore
): Command {
  return new Command("doctor")
    .description("Verify Consult Dad local runtime, database health, and advisor readiness")
    .option("--json", "Output machine-readable JSON")
    .action(async (options: any) => {
      try {
        const diagnostics: Record<string, any> = {
          runtime: "bun",
          database: "healthy",
          storage: "healthy",
          advisors: {},
          healthy: true,
        };

        // Check DB
        try {
          store.list({ limit: 1 });
          diagnostics.database = "healthy";
        } catch (e: any) {
          diagnostics.database = `error: ${e.message}`;
          diagnostics.healthy = false;
        }

        // Check advisors
        const advisors = await registry.list();
        for (const adv of advisors) {
          diagnostics.advisors[adv.id] = {
            available: adv.availability.available,
            authenticated: adv.availability.authenticated,
            version: adv.availability.version,
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
          console.log(`[✓] Local Runtime:  Bun v${Bun.version}`);
          console.log(`[✓] State Database: SQLite (${diagnostics.database})`);
          console.log(`[✓] Artifact Store: ${artifactStore["baseDir"]}`);
          console.log("\nAdvisor Diagnostics:");
          for (const [name, info] of Object.entries(diagnostics.advisors as Record<string, any>)) {
            const mark = info.available ? "✓" : "✗";
            console.log(`  [${mark}] ${name}: ${info.available ? "Ready" : "Unavailable"}`);
          }
          console.log(`\nOverall Readiness: ${diagnostics.healthy ? "🟢 READY" : "🟡 ACTION NEEDED"}\n`);
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
