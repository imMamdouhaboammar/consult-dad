# Consult Dad — Skill Distribution & Multi-Agent Integration Guide

Consult Dad is packaged for distribution across AI agent ecosystems, CLI runtimes, Model Context Protocol (MCP) clients, and automated CI/CD pipelines.

---

## 1. Quick Installation Methods

### Method A: One-Line Installer (Recommended)
Installs Bun (if needed), builds Consult Dad, links `dad` into `~/.local/bin`, and distributes the skill across all detected agent runtimes:

```bash
curl -fsSL https://raw.githubusercontent.com/imMamdouhaboammar/consult-dad/main/install.sh | bash
```

### Method B: Git Clone & Local Build
```bash
git clone https://github.com/imMamdouhaboammar/consult-dad.git
cd consult-dad
bun install
bun run build
bun link
```

### Method C: Download Standalone Release Bundle
Download the standalone tarball or zip from [GitHub Releases](https://github.com/imMamdouhaboammar/consult-dad/releases):
```bash
tar -xzf consult-dad-skill-v0.0.1.tar.gz -C ~/.agents/skills/
```

---

## 2. Cross-Agent Ecosystem Distribution

Consult Dad provides first-class discovery and execution support across major agent platforms:

| Agent / Environment | Skill Path / Configuration | Installation Command |
|---|---|---|
| **Cross-Agent Standard** | `~/.agents/skills/consult-dad/` | `dad skill install --global` |
| **Gemini CLI / Antigravity** | `~/.gemini/config/skills/consult-dad/` | `dad skill install --gemini` |
| **Claude Code** | `~/.claude/skills/consult-dad/` | `dad skill install --claude` |
| **Cursor IDE** | `.cursor/rules/consult-dad.mdc` | `dad skill install --cursor` |
| **OpenCode / Codex** | `~/.config/opencode/` + `.agents/skills/` | `dad skill install --all` |
| **All Platforms + MCP** | All targets + MCP server configuration | `dad skill install --all --mcp` |

---

## 3. CLI Skill Commands

Consult Dad includes a built-in skill management subsystem:

```bash
# Check cross-runtime installation status
dad skill list

# Audit skill integrity, frontmatter, references, and scripts
dad skill doctor

# Distribute skill to all detected agent environments
dad skill install --all

# Export standalone skill bundle for air-gapped environments
dad skill export --output ./my-skills-bundle
```

---

## 4. MCP Server Setup for AI Clients

Add Consult Dad as an MCP server in your agent's configuration file:

```json
{
  "mcpServers": {
    "consult-dad": {
      "command": "dad",
      "args": ["serve"]
    }
  }
}
```

### Available MCP Capabilities:
- **Tools**: `dad_consult`, `dad_followup`, `dad_status`, `dad_result`, `dad_cancel`, `dad_list_advisors`, `dad_explain_route`
- **Resources**: `dad://consultations/latest`, `dad://consultations/{id}`, `dad://advisors`
- **Prompts**: `dad_escalation_triage`, `dad_consult_brief`

---

## 5. Verifying Installation & Runtime Health

Run the system doctor to verify runtime, SQLite database engine, config trust approval, and registered advisors:

```bash
dad doctor
```
