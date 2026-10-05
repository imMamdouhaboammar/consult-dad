import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

describe("Distribution Packaging Pipeline", () => {
  const rootDir = process.cwd();
  const releaseDir = join(rootDir, "dist/release");
  const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));
  const version = packageJson.version as string;
  const cliTarName = `consult-dad-v${version}.tar.gz`;
  const skillTarName = `consult-dad-skill-v${version}.tar.gz`;
  const skillZipName = `consult-dad-skill-v${version}.zip`;

  it("contains required versioned archives and checksum manifest", () => {
    expect(existsSync(join(releaseDir, cliTarName))).toBe(true);
    expect(existsSync(join(releaseDir, skillTarName))).toBe(true);
    expect(existsSync(join(releaseDir, "SHA256SUMS"))).toBe(true);
  });

  it("verifies checksums for every generated release artifact", () => {
    const sha256SumsContent = readFileSync(join(releaseDir, "SHA256SUMS"), "utf-8");
    const lines = sha256SumsContent.trim().split("\n").filter(Boolean);
    const releaseArtifacts = readdirSync(releaseDir)
      .filter((name) =>
        name === cliTarName ||
        name === skillTarName ||
        name === skillZipName
      )
      .sort();

    expect(releaseArtifacts).toContain(cliTarName);
    expect(releaseArtifacts).toContain(skillTarName);

    const manifestFiles = new Set<string>();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const expectedHash = parts[0];
      const fileName = parts[1];

      expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
      expect(fileName).toBeTruthy();

      const filePath = join(releaseDir, fileName);
      expect(existsSync(filePath)).toBe(true);

      const actualHash = createHash("sha256")
        .update(readFileSync(filePath))
        .digest("hex");
      expect(actualHash).toBe(expectedHash);
      manifestFiles.add(fileName);
    }

    expect([...manifestFiles].sort()).toEqual(releaseArtifacts);
  });

  it("enforces packaging size hygiene (skill bundle < 100KB, CLI < 5MB)", () => {
    const skillTar = join(releaseDir, skillTarName);
    const cliTar = join(releaseDir, cliTarName);

    expect(statSync(skillTar).size).toBeLessThan(100 * 1024);
    expect(statSync(cliTar).size).toBeLessThan(5 * 1024 * 1024);
  });

  it("ensures universal install.sh is present and executable", () => {
    const installScript = join(rootDir, "install.sh");
    expect(existsSync(installScript)).toBe(true);
    const content = readFileSync(installScript, "utf-8");
    expect(content).toContain("#!/usr/bin/env bash");
    expect(content).toContain("skill install");
  });
});
