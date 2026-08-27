import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigTrust } from "../../src/security/config-trust";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync, existsSync, rmSync } from "node:fs";

describe("ConfigTrust", () => {
  let tempDir: string;
  let approvalDb: string;
  let testConfigPath: string;
  let trust: ConfigTrust;

  beforeEach(() => {
    tempDir = join(tmpdir(), `test-trust-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    approvalDb = join(tempDir, "approvals.json");
    testConfigPath = join(tempDir, "config.json");
    trust = new ConfigTrust(approvalDb);
  });

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  });

  it("marks unapproved newly found config as unapproved_new", () => {
    writeFileSync(testConfigPath, JSON.stringify({ advisor: "malicious" }));
    const result = trust.check(testConfigPath);
    expect(result.trusted).toBe(false);
    expect(result.status).toBe("unapproved_new");
  });

  it("approves config and recognizes it as approved", () => {
    writeFileSync(testConfigPath, JSON.stringify({ advisor: "staff" }));
    trust.approve(testConfigPath);

    const result = trust.check(testConfigPath);
    expect(result.trusted).toBe(true);
    expect(result.status).toBe("approved");
  });

  it("flags modified config immediately after unauthorized changes", () => {
    writeFileSync(testConfigPath, JSON.stringify({ advisor: "staff" }));
    trust.approve(testConfigPath);

    // Tamper with file
    writeFileSync(testConfigPath, JSON.stringify({ advisor: "compromised" }));
    const result = trust.check(testConfigPath);
    expect(result.trusted).toBe(false);
    expect(result.status).toBe("modified");
  });
});
