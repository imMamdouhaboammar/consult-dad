#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const rootDir = resolve(join(dirname(new URL(import.meta.url).pathname), ".."));
const pkgJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));
const version = pkgJson.version || "0.0.1";
const distDir = join(rootDir, "dist");
const releaseDir = join(distDir, "release");

console.log(`\n📦 Building Consult Dad Distribution Packages (v${version})...\n`);

// Always verify a freshly generated release set. Never reuse stale artifacts.
if (existsSync(releaseDir)) {
  rmSync(releaseDir, { recursive: true, force: true });
}

// 1. Ensure build is fresh
console.log("🔨 1. Running build...");
execSync("bun run build", { cwd: rootDir, stdio: "inherit" });

mkdirSync(releaseDir, { recursive: true });

// 2. Package standalone CLI tarball
const cliTarName = `consult-dad-v${version}.tar.gz`;
const cliTarPath = join(releaseDir, cliTarName);
console.log(`📦 2. Creating CLI release tarball: ${cliTarName}...`);

const tarIncludes = [
  "dist",
  "skills",
  "prompts",
  "schemas",
  "docs",
  "hooks",
  "templates",
  "package.json",
  "README.md",
  "LICENSE",
  "AGENTS.md",
  "install.sh",
];

execSync(`tar --exclude="dist/release" -czf "${cliTarPath}" ${tarIncludes.join(" ")}`, {
  cwd: rootDir,
  stdio: "inherit",
});

// 3. Package standalone Skill archive (tar.gz and zip)
const skillTarName = `consult-dad-skill-v${version}.tar.gz`;
const skillTarPath = join(releaseDir, skillTarName);
const skillZipName = `consult-dad-skill-v${version}.zip`;
const skillZipPath = join(releaseDir, skillZipName);

console.log("📦 3. Creating Skill distribution archives...");
execSync(`tar -czf "${skillTarPath}" -C skills consult-dad`, {
  cwd: rootDir,
  stdio: "inherit",
});

try {
  execSync(`zip -r "${skillZipPath}" consult-dad`, {
    cwd: join(rootDir, "skills"),
    stdio: "inherit",
  });
} catch {
  console.warn("⚠️ zip utility not available, skipped .zip generation");
}

// 4. Generate SHA-256 Checksums
console.log("🔐 4. Generating SHA-256 Checksum Manifest (SHA256SUMS)...");
const checksums: string[] = [];

for (const fileName of [cliTarName, skillTarName, skillZipName]) {
  const filePath = join(releaseDir, fileName);
  if (existsSync(filePath)) {
    const fileBuffer = readFileSync(filePath);
    const hash = createHash("sha256").update(fileBuffer).digest("hex");
    const stat = fileBuffer.byteLength;
    checksums.push(`${hash}  ${fileName} (${(stat / 1024).toFixed(1)} KB)`);
    console.log(`  ✓ ${fileName}: ${hash} (${(stat / 1024).toFixed(1)} KB)`);
  }
}

const sha256SumsPath = join(releaseDir, "SHA256SUMS");
writeFileSync(sha256SumsPath, checksums.join("\n") + "\n", "utf-8");

console.log(`\n🎉 Distribution artifacts generated successfully in: ${releaseDir}\n`);

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf("/"));
}
