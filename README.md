<div align="center">

# Consult Dad 👨‍💼

**Local escalation bridge for AI coding agents.**

*Your coding agent does the work. Dad gets called when the decision is above its pay grade.*

[![Built with Bun](https://img.shields.io/badge/Bun-1.3+-FBF0DF?style=flat-square&logo=bun&logoColor=000)](https://bun.sh)
[![Protocol v1](https://img.shields.io/badge/protocol-v1.0-blue?style=flat-square)](docs/protocol.md)
[![MCP Ready](https://img.shields.io/badge/MCP-compatible-green?style=flat-square)](docs/mcp.md)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=fff)](tsconfig.json)

</div>

---

## 💡 The Problem

When AI coding agents (Gemini CLI, Claude Code, Codex, Cursor, OpenCode) get stuck in failure loops or hit architectural crossroads (schema migrations, deadlock concurrency, token race conditions), they often thrash — trying the same failed change repeatedly or hallucinating invalid fixes.

Delegation tools ask: *Who should do this entire task?*  
**Consult Dad asks:** *When does the current worker need a higher technical opinion before continuing?*

---

## ⚡ Quickstart

### 1. One-Line Universal Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/imMamdouhaboammar/consult-dad/main/install.sh | bash
```

*Or install manually via Bun:*

```bash
git clone https://github.com/imMamdouhaboammar/consult-dad.git
cd consult-dad
bun install
bun run build
bun link
```

### 2. Distribute Skill to AI Agent Ecosystems

Distribute the Consult Dad skill and MCP server to Gemini CLI / Antigravity, Claude Code, Cursor, OpenCode, and standard cross-agent directories:

```bash
# Distribute across all detected AI agent environments
dad skill install --all --mcp

# Audit skill integrity and reference guides
dad skill doctor

# Check cross-runtime installation status
dad skill list
```

### 3. Verify System & Advisor Health

```bash
bun run dad doctor
```

### 4. Initialize Project Configuration

```bash
bun run dad init
```
This generates `.consult-dad/config.json` with recommended defaults and approves its SHA-256 trust hash.

### 5. Consult Dad via CLI

```bash
# General consultation with bounded file attachments
# UTF-8 text only, workspace-contained, max 16 KiB per file / 48 KiB total evidence
bun run dad ask -f src/auth/token.ts "Should we use database locks or optimistic concurrency for token refresh?"

# Diagnostic mode with hypothesis and failing test
bun run dad ask -m diagnose --hypothesis "Lock acquired in reverse order" --test "auth.test.ts" "Why does auth token deadlock under load?"

# Decision mode with git diff
bun run dad ask -m decide --diff "Is this migration safe for production deployment?"

# Machine-readable JSON output for AI pipelines
bun run dad ask --json "Explain deadlock in worker pool"
```

### 6. Resume Thread on New Evidence

```bash
bun run dad followup dad_01HXYZ "Tested option A with 50 concurrent threads, no deadlock observed"
```

### 7. Inspect Consultation Logs & Timeline

```bash
bun run dad logs dad_01HXYZ
```

---

## 🛠️ MCP Server (Tools, Resources & Prompts)

To attach Consult Dad directly to Claude Desktop, Cursor, or Gemini CLI:

```json
{
  "mcpServers": {
    "consult-dad": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/consult-dad/src/mcp/stdio.ts"]
    }
  }
}
```

### Supported MCP Capabilities:
- **Tools**: `dad_consult`, `dad_followup`, `dad_status`, `dad_result`, `dad_cancel`, `dad_list_advisors`, `dad_explain_route`
- **Resources**: `dad://consultations/latest`, `dad://consultations/{id}`, `dad://advisors`
- **Prompts**: `dad_escalation_triage`, `dad_consult_brief`

---

## 🛡️ Security & Governance

1. **Read-Only by Default**: Consultations never edit files or land commits without explicit `--allow-write` in `takeover` mode.
2. **Cryptographic Config Trust**: Protects against malicious `.consult-dad/config.json` via SHA-256 approval tracking (`dad trust`).
3. **Secret Redaction**: Automatically scrubs supported API-token and credential patterns from prompts and persisted artifacts.
4. **Workspace-Contained Evidence**: `--file` and `--log` resolve real filesystem targets, reject symlink escapes, accept UTF-8 text only, and enforce 16 KiB per-file / 48 KiB total evidence budgets.
5. **Max Depth = 1**: Advisors cannot recursively consult other advisors, preventing runaway token loops.

---

## 📚 Documentation

- [Skill Distribution & Agent Setup](docs/distribution.md)
- [Architecture & Design](docs/architecture.md)
- [Protocol Specification](docs/protocol.md)
- [Advisor Adapters & Dynamic Routing](docs/adapters.md)
- [Model Context Protocol (MCP)](docs/mcp.md)
- [Threat Model & Security](docs/threat-model.md)
- [Agentic SKILL.md](skills/consult-dad/SKILL.md)

---

## 📄 License

MIT © Mamdouh Aboammar
