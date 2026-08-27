import { resolve, normalize, relative } from "node:path";

export class WorkspaceGuard {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = resolve(normalize(workspaceRoot));
  }

  isPathWithinWorkspace(targetPath: string): boolean {
    const resolved = resolve(this.workspaceRoot, normalize(targetPath));
    const rel = relative(this.workspaceRoot, resolved);
    return !rel.startsWith("..") && !resolved.startsWith("/etc") && !resolved.startsWith("/private");
  }

  assertPathWithinWorkspace(targetPath: string): string {
    const resolved = resolve(this.workspaceRoot, normalize(targetPath));
    if (!this.isPathWithinWorkspace(targetPath)) {
      throw new Error(`workspace_violation: Path '${targetPath}' is outside the authorized workspace root '${this.workspaceRoot}'`);
    }
    return resolved;
  }

  assertReadOnly(mode: string, allowWrite: boolean): void {
    if (mode === "takeover" && !allowWrite) {
      throw new Error("workspace_violation: Takeover requires explicit write permission (--allow-write)");
    }
    if (mode !== "takeover" && allowWrite) {
      // In non-takeover modes, writes are never permitted
      throw new Error("workspace_violation: Read-only consultation cannot be converted to write without takeover mode");
    }
  }
}
