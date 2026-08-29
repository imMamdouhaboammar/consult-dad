# Task Plan: Consult Dad Production Grade Architecture & Plan

## Goal
Elevate `consult-dad` from initial release to a bulletproof, enterprise-ready Production Grade system across configuration management, dynamic advisor routing, specialized prompt engineering, rich CLI ergonomics, full MCP resource/prompt compliance, automated agent hooks, and end-to-end resilience.

## Next Step
Work complete. All 7 phases executed, verified, and 94 tests passing with 0 failures.

## Current Phase
Complete (Phase 7)

## Phases

### Phase 1: Requirements Discovery & Technical Audit
- [x] Pull and synchronize repository `imMamdouhaboammar/consult-dad`
- [x] Run baseline tests, linting, and build validation (`bun test`, `tsc --noEmit`, `bun run build`)
- [x] Audit code structure, schema boundaries, adapters, broker lifecycle, security, CLI, and MCP
- [x] Map out production gaps and document findings in `findings.md`
- [x] Establish Manus-style planning files (`task_plan.md`, `findings.md`, `progress.md`)
- [x] Establish GSD roadmap and phase structure (`.planning/ROADMAP.md`)
- **Status:** complete

### Phase 2: Configuration Subsystem & Config Trust Wiring
- [x] Implement `src/config/schema.ts` with Zod validation matching `schemas/config.v1.json`
- [x] Implement `src/config/loader.ts` for hierarchical config discovery (`.consult-dad/config.json` > `~/.config/consult-dad/config.json`)
- [x] Integrate `ConfigTrust` verification: auto-detect unapproved/modified configs and handle security policies
- [x] Instantiate custom configured advisors (custom commands, API models, capability mappings)
- [x] Add `dad init` command to scaffold `.consult-dad/config.json` and approve initial hash
- [x] Unit & contract tests for config loading, validation, and trust enforcement
- **Status:** complete

### Phase 3: Dynamic Broker & Advisor Registry Integration
- [x] Refactor `ConsultationBroker` to accept `AdvisorRegistry` and dynamically resolve advisors per request
- [x] Implement multi-advisor automatic failover when preferred advisor is unavailable or errors
- [x] Enhance error classification with structured `ConsultationError` codes (`advisor_unavailable`, `advisor_not_authenticated`, `timeout`, `policy_denied`)
- [x] Support custom timeout, background execution, and stream event emitters
- [x] Unit & integration tests for multi-adapter dynamic routing and failure fallback
- **Status:** complete

### Phase 4: Prompt Engineering & Mode Template Compilation
- [x] Create `src/prompts/compiler.ts` to bundle and inject specialized mode prompts (`diagnose`, `decide`, `challenge`, `review`, `consult`, `takeover`)
- [x] Enhance `ContextPackBuilder` with structured sections: Objective, Hypothesis Tree, Evidence Matrix, Constraints, and Output Guardrails
- [x] Enhance secret redaction patterns (OAuth tokens, AWS keys, GCP service accounts, Supabase secrets, Database connection URIs)
- [x] Unit tests for prompt compiler, token truncation bounds, and secret redaction
- **Status:** complete

### Phase 5: CLI Ergonomics & Developer Experience
- [x] Enhance `dad ask` with rich attachment flags: `-f, --file <file>`, `--diff`, `--test <test>`, `-e, --error <error>`, `--log <log>`, `--allow-write`
- [x] Implement `dad logs <consultation_id>` to view stderr and event timeline streams
- [x] Enhance `dad status` with formatted summary table and filter options
- [x] Enhance `dad doctor` with deep diagnostic probing for all configured advisors, DB integrity, and config trust status
- [x] Add `dad prune` command for SQLite and artifact cleanup
- [x] Comprehensive CLI contract tests
- **Status:** complete

### Phase 6: MCP Server Enterprise Compliance
- [x] Expand MCP server to support MCP Resources (`dad://consultations/latest`, `dad://consultations/{id}`, `dad://advisors`)
- [x] Expand MCP server to support MCP Prompts (`dad_consult_brief`, `dad_escalation_triage`)
- [x] Implement robust error formatting and JSON schema parameter validation for all tools
- [x] Add automated integration test suite for MCP stdio client-server communication
- **Status:** complete

### Phase 7: Agent Integration, Hooks & CI/CD Packaging
- [x] Build ready-to-use hooks for Claude Code (`hooks/claude-pre-tool.sh`, `hooks/claude-stop-gate.sh`)
- [x] Build Gemini CLI / Antigravity skill integration and slash commands
- [x] Implement DB maintenance utility (`dad prune`, SQLite VACUUM)
- [x] Add concurrency & stress test suite (50+ concurrent consultations, lock contention resilience)
- [x] Finalize documentation (`README.md`, `docs/`, `AGENTS.md`, `package.json`)
- [x] Full build, lint, and test validation (94 tests passing, zero lint/build errors)
- **Status:** complete

## Key Questions
1. How should untrusted project configs be handled in unattended CI/Agent loops?
   → Strict mode: warn and ignore untrusted project config, falling back to safe defaults unless explicitly approved via `dad trust`.
2. Should prompt templates be loaded from disk or compiled into the bundle?
   → Built-in embedded defaults in code with optional overrides loaded from `prompts/` or `.consult-dad/prompts/`.
3. How should `takeover` mode be safely managed?
   → Strict enforcement: requires explicit `--allow-write` flag or environment approval; read-only by default.

## Decisions Made
| Decision | Rationale |
|---|---|
| Use `bun:sqlite` with WAL mode & foreign keys | Built-in high-performance storage with zero external dependencies and fast concurrency. |
| Hierarchical configuration loader | Allows global user defaults (`~/.config/consult-dad/config.json`) with per-repo overrides (`.consult-dad/config.json`). |
| Dynamic capability-based routing with automatic failover | Allows seamless switching between Codex, Claude, Gemini, or custom CLI advisors and automatic recovery if primary advisor fails. |
| In-code fallback prompt templates | Ensures `dad` binary works standalone when distributed globally via npm/bun without requiring external prompt files. |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Divergent branch on initial git pull | 1 | Ran `git checkout -B main origin/main` to cleanly track remote `origin/main`. |
| Variadic `-f, --file <files...>` option swallowing positional argument | 1 | Replaced variadic option with custom accumulator function `collectArray` to allow repeated or comma-separated `-f` arguments safely. |
| Primary advisor CLI error during live run | 1 | Implemented multi-advisor automatic failover in `ConsultationBroker` to smoothly fail over to secondary advisors. |
