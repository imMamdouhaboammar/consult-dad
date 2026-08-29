import { ConsultationRequest } from "./protocol";
import { PromptCompiler } from "../prompts/compiler";

export interface ContextPackOptions {
  maxCharacters?: number;
  includeFileManifestOnly?: boolean;
  promptsDir?: string;
}

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/g, // OpenAI/Anthropic legacy keys
  /sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic standard keys
  /sk-proj-[a-zA-Z0-9_-]{20,}/g, // OpenAI project keys
  /ghp_[a-zA-Z0-9]{30,}/g, // GitHub personal tokens
  /gho_[a-zA-Z0-9]{30,}/g, // GitHub OAuth tokens
  /ghu_[a-zA-Z0-9]{30,}/g, // GitHub user-to-server tokens
  /ghs_[a-zA-Z0-9]{30,}/g, // GitHub server-to-server tokens
  /glpat-[a-zA-Z0-9_-]{20,}/g, // GitLab tokens
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, // Bearer auth headers / JWTs
  /xox[baprs]-[0-9a-zA-Z]{10,}/g, // Slack tokens
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
  /AIza[0-9A-Za-z\\-_]{35}/g, // Google API Key
  /postgres:\/\/[^:]+:[^@]+@[^\/]+/gi, // PostgreSQL credentials in URIs
  /mysql:\/\/[^:]+:[^@]+@[^\/]+/gi, // MySQL credentials in URIs
  /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\/]+/gi, // Mongo credentials in URIs
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, // RSA/EC Private Keys
];

export class ContextPackBuilder {
  private options: ContextPackOptions;
  private compiler: PromptCompiler;

  constructor(options: ContextPackOptions = {}) {
    this.options = {
      maxCharacters: 60_000,
      includeFileManifestOnly: true,
      ...options,
    };
    this.compiler = new PromptCompiler({ promptsDir: this.options.promptsDir });
  }

  redact(text: string): string {
    if (!text) return text;
    let sanitized = text;
    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
    return sanitized;
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
      request.evidence?.git_diff ||
      (request.evidence?.logs && request.evidence.logs.length > 0);

    if (hasEvidence) {
      lines.push("## OBSERVED EVIDENCE");

      if (request.evidence?.relevant_files && request.evidence.relevant_files.length > 0) {
        lines.push("Relevant Files:");
        request.evidence.relevant_files.forEach((f) => lines.push(`- ${f}`));
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
