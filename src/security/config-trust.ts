import { createHash } from "node:crypto";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface TrustCheckResult {
  trusted: boolean;
  status: "approved" | "unapproved_new" | "modified" | "missing";
  configPath: string;
  expectedHash?: string;
  actualHash?: string;
}

export class ConfigTrust {
  private approvalDbPath: string;

  constructor(
    approvalDbPath: string = join(
      process.env.HOME || "",
      ".local/state/consult-dad/.config-approval.json"
    )
  ) {
    this.approvalDbPath = approvalDbPath;
    mkdirSync(dirname(this.approvalDbPath), { recursive: true });
  }

  computeHash(content: string): string {
    return createHash("sha256").update(content, "utf-8").digest("hex");
  }

  check(configPath: string): TrustCheckResult {
    if (!existsSync(configPath)) {
      return { trusted: true, status: "missing", configPath };
    }

    const content = readFileSync(configPath, "utf-8");
    const currentHash = this.computeHash(content);
    const approvals = this.loadApprovals();

    const storedHash = approvals[configPath];
    if (!storedHash) {
      return {
        trusted: false,
        status: "unapproved_new",
        configPath,
        actualHash: currentHash,
      };
    }

    if (storedHash !== currentHash) {
      return {
        trusted: false,
        status: "modified",
        configPath,
        expectedHash: storedHash,
        actualHash: currentHash,
      };
    }

    return {
      trusted: true,
      status: "approved",
      configPath,
      expectedHash: storedHash,
      actualHash: currentHash,
    };
  }

  approve(configPath: string): string {
    if (!existsSync(configPath)) {
      throw new Error(`Config file '${configPath}' does not exist`);
    }

    const content = readFileSync(configPath, "utf-8");
    const hash = this.computeHash(content);
    const approvals = this.loadApprovals();

    approvals[configPath] = hash;
    this.saveApprovals(approvals);
    return hash;
  }

  private loadApprovals(): Record<string, string> {
    if (!existsSync(this.approvalDbPath)) return {};
    try {
      return JSON.parse(readFileSync(this.approvalDbPath, "utf-8"));
    } catch (err) {
      console.error(`[consult-dad] Failed to load approvals database from ${this.approvalDbPath}: ${err instanceof Error ? err.message : String(err)}`);
      return {};
    }
  }

  private saveApprovals(approvals: Record<string, string>): void {
    writeFileSync(this.approvalDbPath, JSON.stringify(approvals, null, 2), "utf-8");
  }
}
