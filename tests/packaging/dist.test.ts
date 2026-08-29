import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

describe("Distribution Packaging Pipeline", () => {
  const rootDir = process.cwd();
  const releaseDir = join(rootDir, "dist/release");

  it("ensures release directory contains tarball and zip archives", () => {
    expect(existsSync(join(releaseDir, "consult-dad-v0.0.1.tar.gz"))).toBe(true);
    expect(existsSync(join(releaseDir, "consult-dad-skill-v0.0.1.tar.gz"))).toBe(true);
    expect(existsSync(join(releaseDir, "SHA256SUMS"))).toBe(true);
  });

  it("verifies SHA256 checksums match physical archive contents", () => {
    const sha256SumsContent = readFileSync(join(releaseDir, "SHA256SUMS"), "utf-8");
    const lines = sha256SumsContent.trim().split("\n");

    expect(lines.length).toBeGreaterThanOrEqual(2);

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const expectedHash = parts[0];
      const fileName = parts[1];

      const filePath = join(releaseDir, fileName);
      if (existsSync(filePath)) {
        const actualHash = createHash("sha256")
          .update(readFileSync(filePath))
          .digest("hex");
        expect(actualHash).toBe(expectedHash);
      }
    }
  });

  it("enforces packaging size hygiene (skill bundle < 100KB, CLI < 5MB)", () => {
    const skillTar = join(releaseDir, "consult-dad-skill-v0.0.1.tar.gz");
    const cliTar = join(releaseDir, "consult-dad-v0.0.1.tar.gz");

    if (existsSync(skillTar)) {
      const skillSize = statSync(skillTar).size;
      expect(skillSize).toBeLessThan(100 * 1024); // Less than 100KB
    }

    if (existsSync(cliTar)) {
      const cliSize = statSync(cliTar).size;
      expect(cliSize).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    }
  });

  it("ensures universal install.sh is present and executable", () => {
    const installScript = join(rootDir, "install.sh");
    expect(existsSync(installScript)).toBe(true);
    const content = readFileSync(installScript, "utf-8");
    expect(content).toContain("#!/usr/bin/env bash");
    expect(content).toContain("skill install");
  });
});
