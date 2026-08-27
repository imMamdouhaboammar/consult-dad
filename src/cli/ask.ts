import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { ConsultationModeEnum, ConsultationRequestInput } from "../core/protocol";
import { OutputFormatter } from "./output";

export function createAskCommand(broker: ConsultationBroker): Command {
  return new Command("ask")
    .description("Consult Dad on a technical decision or failure")
    .argument("<question>", "The specific question or decision needed")
    .option("-m, --mode <mode>", "Consultation mode (consult, diagnose, review, decide, challenge, takeover)", "consult")
    .option("-a, --advisor <advisorId>", "Explicit advisor to consult")
    .option("-g, --goal <goal>", "Goal statement (defaults to question)")
    .option("--hypothesis <hypothesis>", "Current theory of why it is happening")
    .option("--json", "Output machine-readable JSON")
    .action(async (question: string, options: any) => {
      try {
        const mode = ConsultationModeEnum.parse(options.mode);
        const goal = options.goal || question;

        const request: ConsultationRequestInput = {
          mode,
          caller: { agent: "cli-user", role: "worker" },
          goal,
          question,
          current_hypothesis: options.hypothesis,
          attempts: [],
          evidence: { relevant_files: [] },
          constraints: { read_only: true },
          decision_needed: question,
        };

        const id = await broker.consult(request, undefined, options.advisor);
        const answer = await broker.result(id);

        OutputFormatter.formatAnswer(answer, { json: options.json });
      } catch (err: any) {
        OutputFormatter.formatError(err, { json: options.json });
        process.exitCode = 1;
      }
    });
}
