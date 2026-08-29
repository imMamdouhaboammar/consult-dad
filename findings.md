# Consult Dad — Codebase Discovery & Technical Findings

## 1. Executive Summary

Consult Dad (`consult-dad`) is a local escalation bridge for AI coding agents (Gemini CLI, Claude Code, OpenAI Codex, OpenCode, Cursor). Unlike delegation frameworks that replace the working agent, Consult Dad implements the **Staff Engineer Advisory Pattern**: the worker agent owns the task, writes code, and lands commits, while Dad is consulted on-demand when decisions exceed the worker's pay grade.

## 2. Current Architecture & Codebase Map

| Subsystem | Key Files | Current State | Production Gap |
|---|---|---|---|
| **Core Protocol** | `src/core/protocol.ts`, `schemas/*.json` | Complete Zod schemas for request, answer, state, event, error, followup. | Missing typed Zod schema for `config.v1.json`. |
| **Escalation Engine** | `src/core/escalation.ts`, `src/core/policy.ts` | Heuristics for failure loops, architecture keywords, destructive commands, contradictory evidence. | Triggers are hardcoded; should support project config overrides. |
| **Advisor Adapters** | `src/adapters/codex.ts`, `claude.ts`, `generic-command.ts`, `fake.ts` | 4 functional adapters with probe, start, resume, cancel, result. | Output extraction is fragile on multi-block markdown; need fallback parsing enhancements. |
| **Routing & Registry** | `src/core/routing.ts` | Priority & capability scoring, availability probing, explain route. | Registry is disconnected from `ConsultationBroker` default resolution. |
| **Broker & Lifecycle** | `src/broker/broker.ts`, `lifecycle.ts`, `queue.ts` | Async queue, event logging, disk artifact saving, transition validation. | Broker uses hardcoded default adapter instead of calling `registry.resolve()`. |
| **Persistence** | `src/store/sqlite.ts`, `migrations.ts`, `artifacts.ts` | SQLite WAL mode (`bun:sqlite`), ULID generation, filesystem artifacts. | Missing DB vacuum/pruning utility for old consultations. |
| **Security Layer** | `src/security/workspace.ts`, `config-trust.ts`, `environment.ts` | Traversal checks, read-only assertion, SHA-256 config approval, env scrubbing. | Complete, but config loading pipeline not yet wired to `ConfigTrust`. |
| **CLI Suite** | `src/cli/*.ts` (9 commands) | `ask`, `followup`, `status`, `result`, `cancel`, `advisors`, `doctor`, `serve`, `trust`. | Missing `dad init`, `dad logs`, and rich attachment flags (`-f`, `--diff`, `--test`). |
| **MCP Integration** | `src/mcp/server.ts`, `stdio.ts`, `tools.ts` | 7 MCP tools registered on stdio transport. | Missing MCP Prompts and Resources capabilities. |
| **Prompts & Skills** | `prompts/*.md`, `skills/consult-dad/SKILL.md` | 5 Markdown prompt templates and agent skill spec. | Prompt templates are not loaded dynamically by `ContextPackBuilder`. |

## 3. Detailed Technical Findings

### Finding 1: Config Loading & Trust Verification
- `schemas/config.v1.json` defines project configuration structure (`.consult-dad/config.json`), including custom advisors, escalation triggers, max attempts, and timeouts.
- `src/security/config-trust.ts` implements SHA-256 hash checks and stored approvals.
- **Missing Link:** There is currently no `ConfigLoader` module that reads `.consult-dad/config.json`, verifies its hash against `ConfigTrust`, parses it into typed config objects, and registers custom advisors or custom thresholds into the `AdvisorRegistry` and `EscalationDetector`.

### Finding 2: Broker & Registry Dynamic Resolution
- Currently, `src/broker/broker.ts` accepts a `defaultAdapter` and falls back to it when `advisorId` is omitted.
- In `src/cli/index.ts`, `defaultAdapter` is hardcoded to a mock `FakeAdvisorAdapter({ id: "staff" })`, and the actual adapters registered in `AdvisorRegistry` are not passed to `broker`.
- **Production Requirement:** `ConsultationBroker` should receive `AdvisorRegistry`. When a consultation is requested without an explicit advisor, the broker invokes `registry.resolve(request)` to choose the best available and authenticated adapter.

### Finding 3: Context Pack Prompt Customization
- `prompts/` contains rich mode prompts: `advisor.md`, `diagnose.md`, `decide.md`, `challenge.md`, `review.md`.
- `ContextPackBuilder` currently uses hardcoded prompt text and does not load or blend the specialized mode prompts.
- **Production Requirement:** `ContextPackBuilder` should embed mode-specific advice guidelines (e.g. root cause trees for `diagnose`, tradeoff tables for `decide`, threat models for `challenge`).

### Finding 4: CLI Ergonomics & Flag Support
- Currently `dad ask` only takes `<question>` and basic flags.
- Agents and developers need to pass files (`-f src/foo.ts`), git diff (`--diff`), failing test names (`--test "test name"`), logs (`--log file.log`), and custom timeouts.
- `dad init` should scaffold `.consult-dad/config.json` and approve its initial hash in one command.

### Finding 5: MCP Resources & Prompts Support
- The MCP Server currently exposes 7 tools.
- Adding MCP Prompts (e.g. `dad_consult_template`) and MCP Resources (e.g. `dad://consultations/{id}`, `dad://history`) will provide full native integration for Claude Desktop, Cursor, and Gemini CLI.

### Finding 6: Build & Distribution
- Built with `tsup` targeting ESM (`dist/cli/index.js`, `dist/mcp/server.js`).
- Bin wrapper `dad` configured in `package.json`.
- Type checking passes cleanly with `tsc --noEmit`.
- 81 unit/contract/acceptance tests pass with Bun test.
