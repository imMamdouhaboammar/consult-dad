<div align="center">

# Consult Dad 👨‍💼

**Local escalation bridge for AI coding agents.**

*Your coding agent does the work. Dad gets called when the decision is above its pay grade.*

[![Built with Bun](https://img.shields.io/badge/Bun-1.3+-FBF0DF?style=flat-square&logo=bun&logoColor=000)](https://bun.sh)
[![Protocol v1](https://img.shields.io/badge/protocol-v1.0-blue?style=flat-square)](docs/protocol.md)
[![MCP Ready](https://img.shields.io/badge/MCP-compatible-green?style=flat-square)](docs/mcp.md)

</div>

---

## 💡 The Problem

When AI coding agents (Gemini, Claude Code, Codex) get stuck in failure loops or hit architectural crossroads (schema migrations, deadlock concurrency, token race conditions), they often thrash — trying the same failed change repeatedly or hallucinating invalid fixes.

Delegation tools ask: *Who should do this entire task?*  
**Consult Dad asks:** *When does the current worker need a higher technical opinion before continuing?*

---

## ⚡ Quickstart

### 1. Installation

```bash
cd consult-dad
bun install
bun run build
```

### 2. Verify Health

```bash
bun run dad doctor
```

### 3. Consult Dad via CLI

```bash
# General consultation
bun run dad ask "Should we use database locks or optimistic concurrency for inventory reservation?"

# Diagnostic mode with hypothesis
bun run dad ask --mode diagnose --hypothesis "Two refresh calls racing" "Find root cause of auth token test failure"

# JSON mode for agents
bun run dad ask --json "Explain deadlock in worker pool"
```

### 4. Resume Thread on New Evidence

```bash
bun run dad followup dad_01HXYZ "Tested option A with 50 concurrent threads, no deadlock observed"
```

---

## 🛠️ MCP Server

To attach Consult Dad directly to your agent's MCP tools:

```json
{
  "mcpServers": {
    "consult-dad": {
      "command": "bun",
      "args": ["run", "/path/to/consult-dad/src/mcp/stdio.ts"]
    }
  }
}
```

---

## 📚 Documentation

- [Architecture](docs/architecture.md)
- [Protocol Specification](docs/protocol.md)
- [Advisor Adapters](docs/adapters.md)
- [Model Context Protocol](docs/mcp.md)
- [Threat Model & Security](docs/threat-model.md)
- [Agentic SKILL.md](skills/consult-dad/SKILL.md)

---

## 📄 License

MIT © Mamdouh Aboammar
