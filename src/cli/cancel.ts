import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { OutputFormatter } from "./output";

export function createCancelCommand(broker: ConsultationBroker): Command {
  return new Command("cancel")
    .description("Cancel an active or completed consultation")
    .argument("<consultationId>", "Consultation ID")
    .option("--json", "Output machine-readable JSON")
    .action(async (consultationId: string, options: any) => {
      try {
        await broker.cancel(consultationId);
        if (options.json) {
          console.log(JSON.stringify({ status: "canceled", consultation_id: consultationId }, null, 2));
        } else {
          console.log(`\n✓ Consultation ${consultationId} has been canceled.`);
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
