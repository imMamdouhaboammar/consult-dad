import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { OutputFormatter } from "./output";

export function createFollowupCommand(broker: ConsultationBroker): Command {
  return new Command("followup")
    .description("Continue an existing consultation with new evidence or results")
    .argument("<consultationId>", "Consultation ID (e.g. dad_01HXYZ)")
    .argument("<message>", "Followup message or newly observed behavior")
    .option("--json", "Output machine-readable JSON")
    .action(async (consultationId: string, message: string, options: any) => {
      try {
        await broker.followup(consultationId, message);
        const answer = await broker.result(consultationId);
        OutputFormatter.formatAnswer(answer, { json: options.json });
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
