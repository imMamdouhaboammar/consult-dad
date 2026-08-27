import { AdvisorAdapter, AdvisorAvailability, AdvisorRun } from "./adapter";
import {
  ConsultationRequest,
  ConsultationAnswer,
  ConsultationAnswerSchema,
  FollowupRequest,
} from "../core/protocol";
import { ContextPackBuilder } from "../core/context-builder";
import { spawn } from "node:child_process";

export interface CodexAdapterOptions {
  id?: string;
  binaryPath?: string;
  model?: string;
  timeoutMs?: number;
}

export class CodexAdapter implements AdvisorAdapter {
  readonly id: string;
  private binaryPath: string;
  private model?: string;
  private timeoutMs: number;
  private contextBuilder: ContextPackBuilder;

  constructor(options: CodexAdapterOptions = {}) {
    this.id = options.id || "codex-staff";
    this.binaryPath = options.binaryPath || "codex";
    this.model = options.model;
    this.timeoutMs = options.timeoutMs || 120_000;
    this.contextBuilder = new ContextPackBuilder();
  }

  async probe(): Promise<AdvisorAvailability> {
    try {
      const proc = Bun.spawnSync(["which", this.binaryPath]);
      const available = proc.exitCode === 0;
      return {
        available,
        authenticated: available,
        version: "codex-cli",
        supports_resume: true,
        supports_background: true,
        supports_read_only: true,
        supports_structured_output: true,
        capabilities: ["architecture", "debugging", "code-review", "concurrency", "tradeoffs"],
      };
    } catch (probeError) {
      console.error(`[consult-dad] Codex probe failed: ${probeError instanceof Error ? probeError.message : String(probeError)}`);
      return {
        available: false,
        authenticated: false,
        supports_resume: true,
        supports_background: true,
        supports_read_only: true,
        supports_structured_output: true,
      };
    }
  }

  async start(request: ConsultationRequest): Promise<AdvisorRun> {
    const consultationId = request.consultation_id || `dad_${Date.now()}`;
    const brief = this.contextBuilder.build(request);

    const args = ["exec", "-s", "read-only", "--json"];
    if (this.model) {
      args.push("-m", this.model);
    }
    args.push("-");

    return this.runCodexProcess(consultationId, args, brief);
  }

  async resume(run: AdvisorRun, delta: FollowupRequest): Promise<AdvisorRun> {
    const followupPrompt = `FOLLOWUP: ${delta.message}\n` +
      (delta.new_evidence ? `Evidence: ${JSON.stringify(delta.new_evidence)}` : "");

    const args = ["exec", "resume", "--last", "--json", "-"];
    return this.runCodexProcess(run.consultation_id, args, followupPrompt, run.native_session_id);
  }

  async cancel(run: AdvisorRun): Promise<void> {
    run.status = "canceled";
  }

  async result(run: AdvisorRun): Promise<ConsultationAnswer> {
    if (!run.answer) {
      throw new Error(`Consultation ${run.consultation_id} produced no answer`);
    }
    return run.answer;
  }

  private async runCodexProcess(
    consultationId: string,
    args: string[],
    stdinInput: string,
    nativeSessionId?: string | null
  ): Promise<AdvisorRun> {
    return new Promise<AdvisorRun>((resolve) => {
      const child = spawn(this.binaryPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve({
          consultation_id: consultationId,
          advisor_id: this.id,
          native_session_id: nativeSessionId || null,
          status: "failed",
          answer: null,
          stderr: `Codex process timed out after ${this.timeoutMs}ms`,
        });
      }, this.timeoutMs);

      child.stdout.on("data", (c) => (stdout += c.toString()));
      child.stderr.on("data", (c) => (stderr += c.toString()));

      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          consultation_id: consultationId,
          advisor_id: this.id,
          native_session_id: nativeSessionId || null,
          status: "failed",
          answer: null,
          stderr: `Spawn error: ${err.message}`,
        });
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          resolve({
            consultation_id: consultationId,
            advisor_id: this.id,
            native_session_id: nativeSessionId || null,
            status: "failed",
            answer: null,
            stderr: stderr || `Codex exited with code ${code}`,
          });
          return;
        }

        try {
          const parsed = this.parseAnswerJson(stdout, consultationId);
          resolve({
            consultation_id: consultationId,
            advisor_id: this.id,
            native_session_id: nativeSessionId || `codex_session_${consultationId}`,
            status: "completed",
            answer: parsed,
            stderr,
          });
        } catch (parseError) {
          console.error(`[consult-dad] Codex answer parsing failed, using prose fallback: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          const fallbackAnswer: ConsultationAnswer = {
            schema: "consult-dad.answer.v1",
            consultation_id: consultationId,
            status: "completed",
            advisor: { id: this.id, adapter: "codex" },
            verdict: stdout.trim() || "Codex analysis completed",
            recommendation: ["Review advisor findings"],
            assumptions: [],
            risks: [],
            verification: [],
            confidence: "medium",
            worker_action: "continue",
            needs_followup: false,
          };
          resolve({
            consultation_id: consultationId,
            advisor_id: this.id,
            native_session_id: nativeSessionId || `codex_session_${consultationId}`,
            status: "completed",
            answer: fallbackAnswer,
            stderr,
          });
        }
      });

      child.stdin.write(stdinInput);
      child.stdin.end();
    });
  }

  private parseAnswerJson(text: string, consultationId: string): ConsultationAnswer {
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1] : text;
    const parsedAnswer = JSON.parse(jsonStr);
    return ConsultationAnswerSchema.parse({
      schema: "consult-dad.answer.v1",
      consultation_id: consultationId,
      ...parsedAnswer,
    });
  }
}
