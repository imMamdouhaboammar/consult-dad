import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { ArtifactStore } from "../store/artifacts";
import { OutputFormatter } from "./output";

export function createLogsCommand(broker: ConsultationBroker, artifactStore: ArtifactStore): Command {
  return new Command("logs")
    .description("View lifecycle events and stderr logs for a consultation")
    .argument("<consultationId>", "The consultation ID handle (e.g. dad_01HXYZ)")
    .option("--json", "Output raw JSON", false)
    .action(async (consultationId: string, options: any) => {
      try {
        const state = broker.status(consultationId);
        if (!state) {
          throw new Error(`Consultation '${consultationId}' not found`);
        }

        const stderrLog = artifactStore.readLog(consultationId, "stderr.log");

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                consultation_id: state.consultation_id,
                status: state.status,
                events: state.events,
                errors: state.errors,
                stderr: stderrLog || null,
              },
              null,
              2
            )
          );
        } else {
          console.log(`\n=== Consultation Logs: ${state.consultation_id} ===\n`);
          console.log(`Status:  ${state.status.toUpperCase()}`);
          console.log(`Advisor: ${state.advisor_id || "unassigned"}`);
          console.log(`Started: ${state.started_at}`);
          if (state.finished_at) {
            console.log(`Finished:${state.finished_at}`);
          }
          console.log("\n--- Event Timeline ---");
          if (state.events.length === 0) {
            console.log("  No events logged.");
          } else {
            for (const ev of state.events) {
              console.log(`  [${ev.timestamp}] ${ev.type.padEnd(16)} ${ev.detail || ""}`);
            }
          }

          if (stderrLog && stderrLog.trim()) {
            console.log("\n--- Stderr Output ---");
            console.log(stderrLog.trim());
          }
          console.log("");
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
