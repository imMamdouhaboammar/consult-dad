import { Command } from "commander";
import { ConsultationStore } from "../store/sqlite";
import { ArtifactStore } from "../store/artifacts";
import { OutputFormatter } from "./output";

export function createPruneCommand(store: ConsultationStore, artifactStore: ArtifactStore): Command {
  return new Command("prune")
    .description("Prune old consultations from SQLite and clean up disk artifacts")
    .option("-d, --days <days>", "Prune records older than N days", "30")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options: any) => {
      try {
        const days = parseInt(options.days, 10);
        if (isNaN(days) || days < 0) {
          throw new Error("Invalid days argument. Must be a positive integer.");
        }

        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const prunedIds = store.prune(cutoffDate);

        for (const id of prunedIds) {
          artifactStore.deleteConsultationDir(id);
        }

        store.vacuum();

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                status: "pruned",
                days,
                cutoff_date: cutoffDate,
                pruned_count: prunedIds.length,
                pruned_ids: prunedIds,
              },
              null,
              2
            )
          );
        } else {
          console.log(`\n🧹 Consult Dad Prune Complete\n`);
          console.log(`  Cutoff Date:  ${cutoffDate} (${days} days ago)`);
          console.log(`  Pruned Count: ${prunedIds.length} consultations`);
          console.log(`  Database:     VACUUM executed successfully\n`);
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
