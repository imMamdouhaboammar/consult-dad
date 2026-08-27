import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { OutputFormatter } from "./output";

export function createStatusCommand(broker: ConsultationBroker): Command {
  return new Command("status")
    .description("Check status of a specific consultation or list recent consultations")
    .argument("[consultationId]", "Optional consultation ID")
    .option("-l, --limit <limit>", "Max consultations to list", "10")
    .option("--json", "Output machine-readable JSON")
    .action(async (consultationId?: string, options?: any) => {
      try {
        if (consultationId) {
          const state = broker.status(consultationId);
          if (!state) {
            throw new Error(`Consultation '${consultationId}' not found`);
          }
          OutputFormatter.formatState(state, { json: options.json });
        } else {
          const list = broker.list({ limit: parseInt(options.limit, 10) });
          if (options.json) {
            console.log(JSON.stringify(list, null, 2));
          } else {
            console.log(`\n=== Recent Consultations (${list.length}) ===`);
            list.forEach((item) => {
              console.log(`- [${item.status.toUpperCase()}] ${item.consultation_id} | ${item.started_at} | ${item.request.question}`);
            });
            console.log("");
          }
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
