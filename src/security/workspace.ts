import {
  existsSync,
  realpathSync,
} from "node:fs";
import {
  isAbsolute,
  normalize,
  relative,
  resolve,
} from "node:path";

export class WorkspaceGuard {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = resolve(normalize(workspaceRoot));
  }

  isPathWithinWorkspace(targetPath: string): boolean {
    const root = this.canonicalWorkspaceRoot();
    const target = this.canonicalTarget(targetPath);
    const rel = relative(root, target);

    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  }

  assertPathWithinWorkspace(targetPath: string): string {
    const target = this.canonicalTarget(targetPath);
    if (!this.isPathWithinWorkspace(targetPath)) {
      throw new Error(
        `workspace_violation: Path '${targetPath}' resolves outside the authorized workspace root '${this.workspaceRoot}'`
      );
    }
    return target;
  }

  getCanonicalRoot(): string {
    return this.canonicalWorkspaceRoot();
  }

  assertReadOnly(mode: string, allowWrite: boolean): void {
    if (mode === "takeover" && !allowWrite) {
      throw new Error(
        "workspace_violation: Takeover requires explicit write permission (--allow-write)"
      );
    }
    if (mode !== "takeover" && allowWrite) {
      throw new Error(
        "workspace_violation: Read-only consultation cannot be converted to write without takeover mode"
      );
    }
  }

  private canonicalWorkspaceRoot(): string {
    if (existsSync(this.workspaceRoot)) {
      return realpathSync(this.workspaceRoot);
    }
    return this.workspaceRoot;
  }

  private canonicalTarget(targetPath: string): string {
    const lexical = isAbsolute(targetPath)
      ? resolve(normalize(targetPath))
      : resolve(this.workspaceRoot, normalize(targetPath));

    if (existsSync(lexical)) {
      return realpathSync(lexical);
    }

    return lexical;
  }
}
