import { Command } from "commander";
import { ConsultationBroker } from "../broker/broker";
import { ConsultationModeEnum, ConsultationRequestInput } from "../core/protocol";
import { OutputFormatter } from "./output";
import { existsSync, readFileSync } from "node:fs";

function collectArray(val: string, memo: string[] = []): string[] {
  if (val.includes(",")) {
    memo.push(...val.split(",").map((s) => s.trim()).filter(Boolean));
  } else {
    memo.push(val);
  }
  return memo;
}

export function createAskCommand(broker: ConsultationBroker): Command {
  return new Command("ask")
    .description("Consult Dad on a technical decision, architecture question, or failure")
    .argument("<question>", "The specific question or decision needed")
    .option("-m, --mode <mode>", "Consultation mode (consult, diagnose, review, decide, challenge, takeover)", "consult")
    .option("-a, --advisor <advisorId>", "Explicit advisor to consult")
    .option("-g, --goal <goal>", "Goal statement (defaults to question)")
    .option("--hypothesis <hypothesis>", "Current theory of why it is happening")
    .option("-f, --file <file>", "Relevant file to include in context (can be repeated or comma-separated)", collectArray, [])
    .option("--diff", "Capture and attach uncommitted git diff", false)
    .option("--test <test>", "Failing test name or test file (can be repeated)", collectArray, [])
    .option("-e, --error <error>", "Specific error message encountered (can be repeated)", collectArray, [])
    .option("--log <log>", "Log file to read and attach (can be repeated)", collectArray, [])
    .option("--allow-write", "Allow write operations (permitted only in takeover mode)", false)
    .option("--json", "Output machine-readable JSON", false)
    .action(async (question: string, options: any) => {
      try {
        const mode = ConsultationModeEnum.parse(options.mode);

        if (options.allowWrite && mode !== "takeover") {
          throw new Error("policy_denied: --allow-write is permitted only with --mode takeover");
        }
        if (mode === "takeover" && !options.allowWrite) {
          throw new Error("policy_denied: --mode takeover requires explicit --allow-write authorization");
        }

        const goal = options.goal || question;

        const relevantFiles: string[] = Array.isArray(options.file) ? options.file : [];
        const failingTests: string[] = Array.isArray(options.test) ? options.test : [];
        const errors: string[] = Array.isArray(options.error) ? options.error : [];

        const logs: string[] = [];
        if (options.log && Array.isArray(options.log)) {
          for (const logPath of options.log) {
            if (existsSync(logPath)) {
              try {
                const content = readFileSync(logPath, "utf-8");
                logs.push(`=== Log: ${logPath} ===\n${content.slice(0, 10000)}`);
              } catch {}
            }
          }
        }

        let gitDiff: string | null = null;
        if (options.diff) {
          try {
            const diffProc = Bun.spawnSync(["git", "diff", "HEAD"]);
            if (diffProc.exitCode === 0) {
              gitDiff = diffProc.stdout.toString();
            }
          } catch {}
        }

        const request: ConsultationRequestInput = {
          mode,
          caller: { agent: "cli-user", role: "worker" },
          goal,
          question,
          current_hypothesis: options.hypothesis,
          attempts: [],
          evidence: {
            relevant_files: relevantFiles,
            failing_tests: failingTests,
            errors: errors,
            logs: logs,
            git_diff: gitDiff,
          },
          constraints: {
            read_only: !options.allowWrite,
            workspace_root: process.cwd(),
          },
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
