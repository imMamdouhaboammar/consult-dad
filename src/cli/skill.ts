import { Command } from "commander";
import { existsSync, mkdirSync, cpSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";

export interface SkillTarget {
  name: string;
  type: "skill_dir" | "cursor_rule" | "mcp_config";
  path: string;
  description: string;
}

export function getKnownSkillTargets(workspaceRoot: string = process.cwd()): SkillTarget[] {
  const home = homedir();
  return [
    {
      name: "Cross-Agent Standard (Global)",
      type: "skill_dir",
      path: join(home, ".agents/skills/consult-dad"),
      description: "Recognized by Codex, Copilot CLI, Gemini CLI, Claude Code, and OpenCode",
    },
    {
      name: "Cross-Agent Standard (Local Project)",
      type: "skill_dir",
      path: join(workspaceRoot, ".agents/skills/consult-dad"),
      description: "Project-level skill for shared agent repositories",
    },
    {
      name: "Gemini CLI / Antigravity",
      type: "skill_dir",
      path: join(home, ".gemini/config/skills/consult-dad"),
      description: "Official Gemini CLI / Antigravity skills repository",
    },
    {
      name: "Claude Code",
      type: "skill_dir",
      path: join(home, ".claude/skills/consult-dad"),
      description: "Personal skills repository for Claude Code",
    },
    {
      name: "Cursor Rules (Local Project)",
      type: "cursor_rule",
      path: join(workspaceRoot, ".cursor/rules/consult-dad.mdc"),
      description: "Cursor IDE agent rules for the current workspace",
    },
  ];
}

export function findSourceSkillDir(startDir: string = process.cwd()): string | null {
  const candidatePaths = [
    join(startDir, "skills/consult-dad"),
    join(startDir, "../skills/consult-dad"),
    join(dirname(new URL(import.meta.url).pathname), "../../skills/consult-dad"),
    join(dirname(new URL(import.meta.url).pathname), "../skills/consult-dad"),
  ];

  for (const p of candidatePaths) {
    const resolved = resolve(p);
    if (existsSync(join(resolved, "SKILL.md"))) {
      return resolved;
    }
  }
  return null;
}

export function copyDirectoryRecursive(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  const entries = readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(source, entry.name);
    const destPath = join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

export function configureMcpServer(targetConfigPath: string): boolean {
  try {
    const resolvedPath = resolve(targetConfigPath);
    mkdirSync(dirname(resolvedPath), { recursive: true });

    let configData: any = {};
    if (existsSync(resolvedPath)) {
      try {
        configData = JSON.parse(readFileSync(resolvedPath, "utf-8"));
      } catch {
        configData = {};
      }
    }

    if (!configData.mcpServers) {
      configData.mcpServers = {};
    }

    configData.mcpServers["consult-dad"] = {
      command: "dad",
      args: ["serve"],
    };

    writeFileSync(resolvedPath, JSON.stringify(configData, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export function createSkillCommand(workspaceRoot: string = process.cwd()): Command {
  const cmd = new Command("skill");
  cmd.description("Manage Consult Dad agent skills, distribution, and cross-runtime installations");

  cmd
    .command("list")
    .description("List installed Consult Dad skill status across detected agent runtimes")
    .action(() => {
      console.log("\n🔍 Consult Dad — Cross-Runtime Skill Status:\n");
      const targets = getKnownSkillTargets(workspaceRoot);

      console.log(
        "Runtime / Ecosystem".padEnd(35) +
          "Status".padEnd(16) +
          "Destination Path"
      );
      console.log("-".repeat(85));

      for (const target of targets) {
        const isInstalled = existsSync(target.path);
        const statusText = isInstalled ? "✅ Installed" : "⚪ Not installed";
        console.log(
          target.name.padEnd(35) +
            statusText.padEnd(16) +
            target.path
        );
      }
      console.log("\nRun 'dad skill install --all' to distribute to all detected runtimes.\n");
    });

  cmd
    .command("install")
    .description("Install or distribute Consult Dad skill to agent ecosystems")
    .option("-a, --all", "Install to all supported agent runtimes")
    .option("--claude", "Install to Claude Code (~/.claude/skills/consult-dad)")
    .option("--gemini", "Install to Gemini CLI / Antigravity (~/.gemini/config/skills/consult-dad)")
    .option("--cursor", "Install Cursor rule (.cursor/rules/consult-dad.mdc)")
    .option("--global", "Install to global cross-runtime standard (~/.agents/skills/consult-dad)")
    .option("-t, --target <path>", "Custom target directory for installation")
    .option("--mcp", "Also configure MCP server in agent settings")
    .option("-f, --force", "Overwrite existing files without prompting", true)
    .action((options) => {
      const sourceDir = findSourceSkillDir(workspaceRoot);
      if (!sourceDir) {
        console.error("❌ Error: Source skill directory 'skills/consult-dad' could not be found.");
        process.exit(1);
      }

      console.log(`📦 Found source skill at: ${sourceDir}\n`);

      const targetsToInstall: SkillTarget[] = [];
      const knownTargets = getKnownSkillTargets(workspaceRoot);

      if (options.target) {
        targetsToInstall.push({
          name: "Custom Target",
          type: "skill_dir",
          path: resolve(options.target),
          description: "Custom installation directory",
        });
      } else if (options.all) {
        targetsToInstall.push(...knownTargets);
      } else {
        if (options.claude) {
          const t = knownTargets.find((k) => k.name.includes("Claude"));
          if (t) targetsToInstall.push(t);
        }
        if (options.gemini) {
          const t = knownTargets.find((k) => k.name.includes("Gemini"));
          if (t) targetsToInstall.push(t);
        }
        if (options.cursor) {
          const t = knownTargets.find((k) => k.name.includes("Cursor"));
          if (t) targetsToInstall.push(t);
        }
        if (options.global) {
          const t = knownTargets.find((k) => k.name.includes("Global"));
          if (t) targetsToInstall.push(t);
        }

        // Default if no flag specified: install to global cross-agent + local project .agents/skills
        if (targetsToInstall.length === 0) {
          targetsToInstall.push(knownTargets[0], knownTargets[1]);
        }
      }

      for (const target of targetsToInstall) {
        try {
          if (target.type === "cursor_rule") {
            const cursorRuleSrc = join(workspaceRoot, ".cursor/rules/consult-dad.mdc");
            mkdirSync(dirname(target.path), { recursive: true });
            if (existsSync(cursorRuleSrc)) {
              cpSync(cursorRuleSrc, target.path);
            } else {
              const ruleContent = `---
description: Consult Dad escalation rule for Cursor AI
globs: *
alwaysApply: false
---

# Consult Dad — Cursor Agent Escalation Rule

When a proposed fix or test fails 2 times consecutively:
1. STOP immediately and avoid thrashing.
2. Call 'dad ask --mode diagnose -f <file> "<question>"' or invoke the 'dad_consult' MCP tool.
3. Review Dad's recommendation, verify against repository ground truth, and implement the fix.
`;
              writeFileSync(target.path, ruleContent, "utf-8");
            }
            console.log(`✅ [Installed] ${target.name} -> ${target.path}`);
          } else {
            copyDirectoryRecursive(sourceDir, target.path);
            console.log(`✅ [Installed] ${target.name} -> ${target.path}`);
          }
        } catch (err: any) {
          console.error(`❌ [Failed] ${target.name}: ${err.message}`);
        }
      }

      if (options.mcp) {
        console.log("\n🔌 Configuring MCP Servers in Agent Runtimes...");
        const mcpPaths = [
          join(homedir(), ".claude/settings.json"),
          join(workspaceRoot, ".cursor/mcp.json"),
          join(homedir(), ".cursor/mcp.json"),
        ];

        for (const mcpPath of mcpPaths) {
          if (existsSync(dirname(mcpPath))) {
            const ok = configureMcpServer(mcpPath);
            if (ok) {
              console.log(`  ✓ Configured MCP in ${mcpPath}`);
            }
          }
        }
      }

      console.log("\n🎉 Skill distribution completed successfully!");
    });

  cmd
    .command("doctor")
    .description("Audit the Consult Dad skill definition, frontmatter, and assets")
    .action(() => {
      console.log("\n🩺 Auditing Consult Dad Skill Integrity...\n");
      const sourceDir = findSourceSkillDir(workspaceRoot);

      if (!sourceDir) {
        console.error("❌ Source skill directory not found.");
        process.exit(1);
      }

      let passes = 0;
      let warnings = 0;

      // Check 1: SKILL.md exists
      const skillMdPath = join(sourceDir, "SKILL.md");
      if (existsSync(skillMdPath)) {
        console.log("  ✓ SKILL.md exists");
        passes++;

        const content = readFileSync(skillMdPath, "utf-8");
        // Check YAML frontmatter
        if (content.startsWith("---") && content.includes("name: consult-dad")) {
          console.log("  ✓ YAML frontmatter valid ('name: consult-dad')");
          passes++;
        } else {
          console.warn("  ⚠ Missing or malformed YAML frontmatter");
          warnings++;
        }

        if (content.includes("description:") && content.includes("Use when")) {
          console.log("  ✓ Skill Discovery Optimization (SDO) valid ('Use when...')");
          passes++;
        } else {
          console.warn("  ⚠ Description does not follow 'Use when...' convention");
          warnings++;
        }
      } else {
        console.error("  ❌ SKILL.md is missing!");
        warnings++;
      }

      // Check 2: References
      const refDir = join(sourceDir, "references");
      if (existsSync(refDir)) {
        const refs = readdirSync(refDir);
        console.log(`  ✓ Reference directory contains ${refs.length} guides`);
        passes++;
      } else {
        console.warn("  ⚠ References directory missing");
        warnings++;
      }

      // Check 3: Examples
      const exampleDir = join(sourceDir, "examples");
      if (existsSync(exampleDir)) {
        const examples = readdirSync(exampleDir);
        console.log(`  ✓ Examples directory contains ${examples.length} samples`);
        passes++;
      } else {
        console.warn("  ⚠ Examples directory missing");
        warnings++;
      }

      // Check 4: Scripts
      const scriptDir = join(sourceDir, "scripts");
      if (existsSync(scriptDir)) {
        const scripts = readdirSync(scriptDir);
        console.log(`  ✓ Scripts directory contains ${scripts.length} helpers`);
        passes++;
      } else {
        console.warn("  ⚠ Scripts directory missing");
        warnings++;
      }

      console.log(`\nAudit complete: ${passes} passed, ${warnings} warnings.\n`);
    });

  cmd
    .command("export")
    .description("Export standalone skill bundle for distribution or air-gapped deployment")
    .option("-o, --output <dir>", "Destination directory", "./dist/skills/consult-dad")
    .action((options) => {
      const sourceDir = findSourceSkillDir(workspaceRoot);
      if (!sourceDir) {
        console.error("❌ Error: Source skill directory 'skills/consult-dad' not found.");
        process.exit(1);
      }

      const outDir = resolve(options.output);
      copyDirectoryRecursive(sourceDir, outDir);
      console.log(`📦 Successfully exported standalone skill bundle to: ${outDir}`);
    });

  return cmd;
}
