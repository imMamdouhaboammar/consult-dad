import { AdvisorAdapter, AdvisorAvailability, AdvisorRun } from "./adapter";
import {
  ConsultationRequest,
  ConsultationAnswer,
  ConsultationAnswerSchema,
  FollowupRequest,
} from "../core/protocol";
import { ContextPackBuilder } from "../core/context-builder";
import { spawn, ChildProcess } from "node:child_process";

export interface GenericCommandOptions {
  id?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
  capabilities?: string[];
}

export class GenericCommandAdapter implements AdvisorAdapter {
  readonly id: string;
  private command: string;
  private args: string[];
  private env: Record<string, string>;
  private timeoutMs: number;
  private capabilities: string[];
  private contextBuilder: ContextPackBuilder;
  private childProcesses: Map<string, ChildProcess> = new Map();

  constructor(options: GenericCommandOptions) {
    this.id = options.id || "generic-command";
    this.command = options.command;
    this.args = options.args || [];
    this.env = options.env || {};
    this.timeoutMs = options.timeoutMs || 60_000;
    this.capabilities = options.capabilities || ["general", "debugging"];
    this.contextBuilder = new ContextPackBuilder();
  }

  async probe(): Promise<AdvisorAvailability> {
    try {
      const proc = Bun.spawnSync(["which", this.command]);
      const available = proc.exitCode === 0;
      return {
        available,
        authenticated: available,
        supports_resume: false,
        supports_background: true,
        supports_read_only: true,
        supports_structured_output: true,
        capabilities: this.capabilities,
      };
    } catch (probeError) {
      console.error(`[consult-dad] GenericCommand probe failed for '${this.command}': ${probeError instanceof Error ? probeError.message : String(probeError)}`);
      return {
        available: false,
        authenticated: false,
        supports_resume: false,
        supports_background: false,
        supports_read_only: true,
        supports_structured_output: false,
      };
    }
  }

  async start(request: ConsultationRequest): Promise<AdvisorRun> {
    const consultationId = request.consultation_id || `dad_${Date.now()}`;
    const brief = this.contextBuilder.build(request);

    return this.executeProcess(consultationId, brief);
  }

  async resume(run: AdvisorRun, delta: FollowupRequest): Promise<AdvisorRun> {
    const followupPrompt = `\n=== FOLLOWUP MESSAGE ===\n${delta.message}\n` +
      (delta.new_evidence ? `\nNew Evidence: ${JSON.stringify(delta.new_evidence)}` : "");
    return this.executeProcess(run.consultation_id, followupPrompt);
  }

  async cancel(run: AdvisorRun): Promise<void> {
    const proc = this.childProcesses.get(run.consultation_id);
    if (proc && !proc.killed) {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 2000);
    }
    run.status = "canceled";
  }

  async result(run: AdvisorRun): Promise<ConsultationAnswer> {
    if (!run.answer) {
      throw new Error(`Consultation ${run.consultation_id} has no completed answer`);
    }
    return run.answer;
  }

  private async executeProcess(consultationId: string, inputData: string): Promise<AdvisorRun> {
    return new Promise<AdvisorRun>((resolve) => {
      const child = spawn(this.command, this.args, {
        env: { ...process.env, ...this.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.childProcesses.set(consultationId, child);

      let stdout = "";
      let stderr = "";
      let stdinError: Error | null = null;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (run: AdvisorRun): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this.childProcesses.delete(consultationId);
        resolve(run);
      };

      const failedRun = (message: string): AdvisorRun => ({
        consultation_id: consultationId,
        advisor_id: this.id,
        native_session_id: null,
        status: "failed",
        answer: null,
        stderr: message,
      });

      timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish(failedRun(`Process timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.stdin.on("error", (err: NodeJS.ErrnoException) => {
        if (this.isBenignStdinClosure(err)) {
          return;
        }
        stdinError = err;
      });

      child.on("error", (err) => {
        finish(failedRun(`Spawn error: ${err.message}`));
      });

      child.on("close", (code) => {
        if (settled) return;

        if (code !== 0) {
          finish(failedRun(stderr || `Process exited with code ${code}`));
          return;
        }

        if (stdinError) {
          finish(failedRun(`Stdin error: ${stdinError.message}`));
          return;
        }

        try {
          const parsed = this.extractJson(stdout);
          const validated = ConsultationAnswerSchema.parse({
            schema: "consult-dad.answer.v1",
            consultation_id: consultationId,
            ...parsed,
          });

          finish({
            consultation_id: consultationId,
            advisor_id: this.id,
            native_session_id: null,
            status: "completed",
            answer: validated,
            stderr,
          });
        } catch (parseError: any) {
          console.error(`[consult-dad] GenericCommand answer parsing failed, using prose fallback: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          const fallbackAnswer: ConsultationAnswer = {
            schema: "consult-dad.answer.v1",
            consultation_id: consultationId,
            status: "completed",
            advisor: { id: this.id, adapter: "generic-command" },
            verdict: stdout.trim() || "Execution completed without structured verdict",
            recommendation: ["Review command standard output"],
            assumptions: [],
            risks: [],
            verification: [],
            confidence: "medium",
            worker_action: "continue",
            needs_followup: false,
          };

          finish({
            consultation_id: consultationId,
            advisor_id: this.id,
            native_session_id: null,
            status: "completed",
            answer: fallbackAnswer,
            stderr,
          });
        }
      });

      try {
        child.stdin.end(inputData);
      } catch (err) {
        const stdinWriteError = err as NodeJS.ErrnoException;
        if (!this.isBenignStdinClosure(stdinWriteError)) {
          stdinError = stdinWriteError;
        }
      }
    });
  }

  private isBenignStdinClosure(err: NodeJS.ErrnoException): boolean {
    return (
      err.code === "EPIPE" ||
      err.code === "ECONNRESET" ||
      err.code === "ERR_STREAM_DESTROYED"
    );
  }

  private extractJson(text: string): any {
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1]);
    }
    const jsonFirstBrace = text.indexOf("{");
    const jsonLastBrace = text.lastIndexOf("}");
    if (jsonFirstBrace !== -1 && jsonLastBrace !== -1 && jsonLastBrace > jsonFirstBrace) {
      return JSON.parse(text.slice(jsonFirstBrace, jsonLastBrace + 1));
    }
    return JSON.parse(text);
  }
}
