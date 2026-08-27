import { describe, it, expect } from "vitest";
import { WorkspaceGuard } from "../../src/security/workspace";
import { EnvironmentCleaner } from "../../src/security/environment";

describe("WorkspaceGuard", () => {
  const guard = new WorkspaceGuard("/Users/test/my-project");

  it("permits paths located inside the workspace root", () => {
    expect(guard.isPathWithinWorkspace("src/index.ts")).toBe(true);
    expect(guard.isPathWithinWorkspace("/Users/test/my-project/src/auth.ts")).toBe(true);
  });

  it("rejects path traversal attempts with ..", () => {
    expect(guard.isPathWithinWorkspace("../../etc/passwd")).toBe(false);
    expect(() => guard.assertPathWithinWorkspace("../outside.ts")).toThrow("workspace_violation");
  });

  it("enforces read-only constraint by default", () => {
    expect(() => guard.assertReadOnly("consult", true)).toThrow("workspace_violation");
    expect(() => guard.assertReadOnly("takeover", false)).toThrow("workspace_violation");
    expect(() => guard.assertReadOnly("takeover", true)).not.toThrow();
  });
});

describe("EnvironmentCleaner", () => {
  it("scrubs API keys and secrets while retaining safe environment variables", () => {
    const dirtyEnv = {
      PATH: "/usr/bin:/bin",
      SHELL: "/bin/zsh",
      OPENAI_API_KEY: "sk-proj-secret12345",
      GITHUB_TOKEN: "ghp_1234567890",
      DATABASE_PASSWORD: "super_secret_pw",
      AWS_SECRET_ACCESS_KEY: "secret_aws",
      DAD_CUSTOM_FLAG: "1",
    };

    const cleaned = EnvironmentCleaner.clean(dirtyEnv);
    expect(cleaned.PATH).toBe("/usr/bin:/bin");
    expect(cleaned.SHELL).toBe("/bin/zsh");
    expect(cleaned.DAD_CUSTOM_FLAG).toBe("1");
    expect(cleaned.OPENAI_API_KEY).toBeUndefined();
    expect(cleaned.GITHUB_TOKEN).toBeUndefined();
    expect(cleaned.DATABASE_PASSWORD).toBeUndefined();
    expect(cleaned.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  });
});
