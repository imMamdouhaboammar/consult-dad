import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export class ArtifactStore {
  private baseDir: string;

  constructor(baseDir: string = join(process.env.HOME || "", ".local/state/consult-dad/consultations")) {
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
    writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
    return filePath;
  }

  readJson<T = any>(id: string, filename: string): T | null {
    const filePath = join(this.getConsultationDir(id), filename);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8"));
  }

  writeText(id: string, filename: string, content: string): string {
    const dir = this.initConsultation(id);
    const filePath = join(dir, filename);
    writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  appendLog(id: string, filename: string, line: string): void {
    const dir = this.initConsultation(id);
    const filePath = join(dir, filename);
    appendFileSync(filePath, line, "utf-8");
  }

  readText(id: string, filename: string): string | null {
    const filePath = join(this.getConsultationDir(id), filename);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf-8");
  }
}
