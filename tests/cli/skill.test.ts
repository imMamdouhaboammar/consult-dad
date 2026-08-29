import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  findSourceSkillDir,
  getKnownSkillTargets,
  configureMcpServer,
  createSkillCommand,
} from "../../src/cli/skill";

describe("Skill Distribution Subsystem (dad skill)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "consult-dad-skill-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("finds the source skill directory in the workspace", () => {
    const sourceDir = findSourceSkillDir(process.cwd());
    expect(sourceDir).not.toBeNull();
    expect(existsSync(join(sourceDir!, "SKILL.md"))).toBe(true);
  });

  it("returns known cross-agent skill targets", () => {
    const targets = getKnownSkillTargets(tempDir);
    expect(targets.length).toBeGreaterThanOrEqual(4);
    expect(targets.some((t) => t.name.includes("Global"))).toBe(true);
    expect(targets.some((t) => t.name.includes("Claude"))).toBe(true);
    expect(targets.some((t) => t.name.includes("Gemini"))).toBe(true);
    expect(targets.some((t) => t.name.includes("Cursor"))).toBe(true);
  });

  it("configures MCP server into an existing or new json configuration", () => {
    const mcpPath = join(tempDir, ".cursor/mcp.json");
    const ok = configureMcpServer(mcpPath);
    expect(ok).toBe(true);
    expect(existsSync(mcpPath)).toBe(true);

    const parsed = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(parsed.mcpServers["consult-dad"]).toBeDefined();
    expect(parsed.mcpServers["consult-dad"].command).toBe("dad");
    expect(parsed.mcpServers["consult-dad"].args).toEqual(["serve"]);
  });

  it("creates and parses the skill CLI command with subcommands", () => {
    const cmd = createSkillCommand(tempDir);
    expect(cmd.name()).toBe("skill");
    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain("list");
    expect(subcommands).toContain("install");
    expect(subcommands).toContain("doctor");
    expect(subcommands).toContain("export");
  });

  it("exports a standalone skill bundle to a target directory", async () => {
    const cmd = createSkillCommand(process.cwd());
    const exportTarget = join(tempDir, "exported-skill");

    await cmd.parseAsync(["node", "dad", "export", "-o", exportTarget]);

    expect(existsSync(join(exportTarget, "SKILL.md"))).toBe(true);
    expect(existsSync(join(exportTarget, "references"))).toBe(true);
    expect(existsSync(join(exportTarget, "examples"))).toBe(true);
    expect(existsSync(join(exportTarget, "scripts"))).toBe(true);
  });

  it("installs skill to a custom target directory", async () => {
    const cmd = createSkillCommand(process.cwd());
    const installTarget = join(tempDir, "agent-skills/consult-dad");

    await cmd.parseAsync(["node", "dad", "install", "-t", installTarget]);

    expect(existsSync(join(installTarget, "SKILL.md"))).toBe(true);
    const content = readFileSync(join(installTarget, "SKILL.md"), "utf-8");
    expect(content).toContain("name: consult-dad");
    expect(content).toContain("Use when");
  });
});
