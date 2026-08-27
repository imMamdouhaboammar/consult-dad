import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { OutputFormatter } from "./output";

export function createResultCommand(broker: ConsultationBroker): Command {
  return new Command("result")
    .description("Retrieve the structured answer of a completed consultation")
    .argument("<consultationId>", "Consultation ID")
    .option("--json", "Output machine-readable JSON")
    .action(async (consultationId: string, options: any) => {
      try {
        const answer = await broker.result(consultationId);
        OutputFormatter.formatAnswer(answer, { json: options.json });
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
