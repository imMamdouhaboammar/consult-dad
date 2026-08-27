import { AdvisorAdapter, AdvisorAvailability, AdvisorRun } from "./adapter";
import {
  ConsultationRequest,
  ConsultationAnswer,
  ConsultationAnswerSchema,
  FollowupRequest,
} from "../core/protocol";
import { ContextPackBuilder } from "../core/context-builder";
import { spawn } from "node:child_process";

export interface ClaudeAdapterOptions {
  id?: string;
  binaryPath?: string;
  model?: string;
  timeoutMs?: number;
}

export class ClaudeAdapter implements AdvisorAdapter {
  readonly id: string;
  private binaryPath: string;
  private model?: string;
  private timeoutMs: number;
  private contextBuilder: ContextPackBuilder;

  constructor(options: ClaudeAdapterOptions = {}) {
    this.id = options.id || "claude-architect";
    this.binaryPath = options.binaryPath || "claude";
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
        version: "claude-code-cli",
        supports_resume: true,
        supports_background: true,
        supports_read_only: true,
        supports_structured_output: true,
        capabilities: ["architecture", "design", "tradeoffs", "refactoring", "threat-modeling"],
      };
    } catch (probeError) {
      console.error(`[consult-dad] Claude probe failed: ${probeError instanceof Error ? probeError.message : String(probeError)}`);
      return {
        available: false,
        authenticated: false,
        supports_resume: false,
        supports_background: false,
        supports_read_only: true,
        supports_structured_output: true,
      };
    }
  }

  async start(request: ConsultationRequest): Promise<AdvisorRun> {
    const consultationId = request.consultation_id || `dad_${Date.now()}`;
    const brief = this.contextBuilder.build(request);
    const args = ["--print"];
    if (this.model) {
      args.push("--model", this.model);
    }
    args.push("-p", brief);

    return this.runClaudeProcess(consultationId, args);
  }

  async resume(run: AdvisorRun, delta: FollowupRequest): Promise<AdvisorRun> {
    const followupPrompt = `FOLLOWUP TO PRIOR CONSULTATION:\n${delta.message}\n` +
      (delta.new_evidence ? `Evidence: ${JSON.stringify(delta.new_evidence)}` : "");

    const args = ["--print"];
    if (run.native_session_id) {
      args.push("--resume", run.native_session_id);
    }
    args.push("-p", followupPrompt);

    return this.runClaudeProcess(run.consultation_id, args, run.native_session_id);
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

  private async runClaudeProcess(
    consultationId: string,
    args: string[],
    nativeSessionId?: string | null
  ): Promise<AdvisorRun> {
    return new Promise<AdvisorRun>((resolve) => {
      const child = spawn(this.binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
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
          stderr: `Claude process timed out after ${this.timeoutMs}ms`,
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
            stderr: stderr || `Claude exited with code ${code}`,
          });
          return;
        }

        try {
          const parsed = this.parseAnswerJson(stdout, consultationId);
          resolve({
            consultation_id: consultationId,
            advisor_id: this.id,
            native_session_id: nativeSessionId || `claude_session_${consultationId}`,
            status: "completed",
            answer: parsed,
            stderr,
          });
        } catch (parseError) {
          console.error(`[consult-dad] Claude answer parsing failed, using prose fallback: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          const fallbackAnswer: ConsultationAnswer = {
            schema: "consult-dad.answer.v1",
            consultation_id: consultationId,
            status: "completed",
            advisor: { id: this.id, adapter: "claude" },
            verdict: stdout.trim() || "Claude architectural guidance completed",
            recommendation: ["Review analysis"],
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
            native_session_id: nativeSessionId || `claude_session_${consultationId}`,
            status: "completed",
            answer: fallbackAnswer,
            stderr,
          });
        }
      });
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
