import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { RedactionService } from "../security/redaction";

export class ArtifactStore {
  private baseDir: string;

  constructor(
    baseDir: string = join(process.env.HOME || "", ".local/state/consult-dad/consultations"),
    private redactor: RedactionService = new RedactionService()
  ) {
    this.baseDir = baseDir;
    mkdirSync(this.baseDir, { recursive: true });
  }

  getConsultationDir(id: string): string {
    return join(this.baseDir, id);
  }

  initConsultation(id: string): string {
    const dir = this.getConsultationDir(id);
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    return dir;
  }

  writeJson(id: string, filename: string, payload: unknown): string {
    const dir = this.initConsultation(id);
    const filePath = join(dir, filename);
    const safePayload = this.redactor.sanitizeValue(payload);
    writeFileSync(filePath, JSON.stringify(safePayload, null, 2), "utf-8");
    return filePath;
  }

  readJson<T = any>(id: string, filename: string): T | null {
    const filePath = join(this.getConsultationDir(id), filename);
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }

  writeText(id: string, filename: string, content: string): string {
    const dir = this.initConsultation(id);
    const filePath = join(dir, filename);
    writeFileSync(filePath, this.redactor.sanitizeText(content), "utf-8");
    return filePath;
  }

  appendLog(id: string, filename: string, line: string): void {
    const dir = this.initConsultation(id);
    const filePath = join(dir, filename);
    appendFileSync(filePath, this.redactor.sanitizeText(line), "utf-8");
  }

  readText(id: string, filename: string): string | null {
    const filePath = join(this.getConsultationDir(id), filename);
    if (!existsSync(filePath)) return null;
    try {
      return readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  readLog(id: string, filename: string): string | null {
    return this.readText(id, filename);
  }

  deleteConsultationDir(id: string): void {
    const dir = this.getConsultationDir(id);
    if (existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[consult-dad] Could not remove directory '${dir}':`, err);
      }
    }
  }
}
