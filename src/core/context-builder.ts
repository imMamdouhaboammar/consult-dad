import { ConsultationRequest } from "./protocol";
import { PromptCompiler } from "../prompts/compiler";
import { RedactionService } from "../security/redaction";

export interface ContextPackOptions {
  maxCharacters?: number;
  includeFileManifestOnly?: boolean;
  promptsDir?: string;
}

export class ContextPackBuilder {
  private options: ContextPackOptions;
  private compiler: PromptCompiler;
  private redactor: RedactionService;

  constructor(options: ContextPackOptions = {}) {
    this.options = {
      maxCharacters: 60_000,
      includeFileManifestOnly: true,
      ...options,
    };
    this.compiler = new PromptCompiler({ promptsDir: this.options.promptsDir });
    this.redactor = new RedactionService();
  }

  redact(text: string): string {
    return this.redactor.sanitizeText(text);
  }

  build(request: ConsultationRequest): string {
    const lines: string[] = [];

    lines.push("=== DAD CONSULTATION BRIEF ===");
    lines.push(`MODE: ${request.mode.toUpperCase()}`);
    lines.push(`CALLER: ${request.caller.agent} (${request.caller.role})`);
    if (request.consultation_id) {
      lines.push(`CONSULTATION ID: ${request.consultation_id}`);
    }
    lines.push("");

    // Mode-specific specialized instructions
    const modePrompt = this.compiler.compile(request.mode);
    lines.push(modePrompt);
    lines.push("");

    lines.push("## GOAL");
    lines.push(this.redact(request.goal));
    lines.push("");

    lines.push("## QUESTION");
    lines.push(this.redact(request.question));
    lines.push("");

    if (request.current_hypothesis && request.current_hypothesis.trim()) {
      lines.push("## CURRENT HYPOTHESIS");
      lines.push(this.redact(request.current_hypothesis));
      lines.push("");
    }

    if (request.attempts && request.attempts.length > 0) {
      lines.push("## ATTEMPTS ALREADY MADE");
      request.attempts.forEach((attempt, attemptIndex) => {
        lines.push(`${attemptIndex + 1}. Attempt: ${this.redact(attempt.action)}`);
        lines.push(`   Outcome: ${this.redact(attempt.outcome)}`);
      });
      lines.push("");
    }

    const hasEvidence =
      (request.evidence?.failing_tests && request.evidence.failing_tests.length > 0) ||
      (request.evidence?.errors && request.evidence.errors.length > 0) ||
      (request.evidence?.relevant_files && request.evidence.relevant_files.length > 0) ||
      (request.evidence?.file_contents && request.evidence.file_contents.length > 0) ||
      request.evidence?.git_diff ||
      (request.evidence?.logs && request.evidence.logs.length > 0);

    if (hasEvidence) {
      lines.push("## OBSERVED EVIDENCE");

      if (request.evidence?.relevant_files && request.evidence.relevant_files.length > 0) {
        lines.push("Relevant Files:");
        request.evidence.relevant_files.forEach((f) => lines.push(`- ${f}`));
        lines.push("");
      }

      if (request.evidence?.file_contents && request.evidence.file_contents.length > 0) {
        lines.push("Attached Source:");
        request.evidence.file_contents.forEach((file) => {
          const truncation = file.truncated ? " [TRUNCATED]" : "";
          lines.push(`Attached File: ${this.redact(file.path)}${truncation}`);
          lines.push(`\`\`\`text\n${this.redact(file.content)}\n\`\`\``);
        });
        lines.push("");
      }

      if (request.evidence?.failing_tests && request.evidence.failing_tests.length > 0) {
        lines.push("Failing Tests:");
        request.evidence.failing_tests.forEach((t) => lines.push(`- ${this.redact(t)}`));
        lines.push("");
      }

      if (request.evidence?.errors && request.evidence.errors.length > 0) {
        lines.push("Errors Encountered:");
        request.evidence.errors.forEach((e) => lines.push(`\`\`\`\n${this.redact(e)}\n\`\`\``));
        lines.push("");
      }

      if (request.evidence?.git_diff) {
        lines.push("Recent Diff:");
        lines.push(`\`\`\`diff\n${this.redact(request.evidence.git_diff)}\n\`\`\``);
        lines.push("");
      }

      if (request.evidence?.logs && request.evidence.logs.length > 0) {
        lines.push("Logs:");
        request.evidence.logs.forEach((l) => lines.push(`- ${this.redact(l)}`));
        lines.push("");
      }
    }

    if (request.constraints) {
      lines.push("## CONSTRAINTS");
      lines.push(`- READ-ONLY: ${request.constraints.read_only ?? true}`);
      if (request.constraints.workspace_root) {
        lines.push(`- WORKSPACE ROOT: ${request.constraints.workspace_root}`);
      }
      if (request.constraints.max_followups) {
        lines.push(`- MAX FOLLOWUPS: ${request.constraints.max_followups}`);
      }
      lines.push("");
    }

    lines.push("## DECISION NEEDED");
    lines.push(this.redact(request.decision_needed));
    lines.push("");

    lines.push("=== ADVISOR INSTRUCTION ===");
    lines.push("Provide your answer as structured JSON adhering to schema 'consult-dad.answer.v1'.");
    lines.push("Required fields: schema, status, advisor, verdict, recommendation, assumptions, risks, verification, confidence, worker_action, needs_followup.");

    let output = lines.join("\n");
    if (this.options.maxCharacters && output.length > this.options.maxCharacters) {
      output = output.slice(0, this.options.maxCharacters) + "\n... [TRUNCATED DUE TO SIZE LIMIT]";
    }
    return output;
  }
}
