# GSD Phase Plan: Production Grade Hardening

## Phase Objective
Implement all core production components: Configuration Subsystem with Config Trust, Dynamic Broker & Registry Resolution, Specialized Prompt Compilation, Rich CLI Ergonomics, MCP Resources/Prompts, and High-Concurrency Stress Testing.

---

## Tasks Breakdown

### Wave 1: Core Architecture & Configuration (Foundations)
- [ ] **Task 1.1: Config Schema & Loader**
  - Implement `src/config/schema.ts` (Zod validation for `ConsultDadConfig`)
  - Implement `src/config/loader.ts` (discovery from `.consult-dad/config.json` & `~/.config/consult-dad/config.json`)
  - Integrate with `ConfigTrust` to verify cryptographic authorization
- [ ] **Task 1.2: Dynamic Broker & Registry Integration**
  - Refactor `ConsultationBroker` to accept `AdvisorRegistry` and resolve advisors dynamically per consultation
  - Implement graceful multi-tier fallback with structured error codes
- [ ] **Task 1.3: Prompt Compiler & Context Pack Enhancement**
  - Implement `src/prompts/compiler.ts` with embedded mode templates (`diagnose`, `decide`, `challenge`, `review`, `takeover`)
  - Enhance `ContextPackBuilder` with structured sections and comprehensive secret scrubbing

### Wave 2: CLI Subcommands & Tooling (Ergonomics)
- [ ] **Task 2.1: Rich CLI Attachments in `dad ask`**
  - Support `-f, --file <paths...>`, `--diff`, `--test <names...>`, `--log <files...>`, `--timeout <ms>`
- [ ] **Task 2.2: New CLI Commands (`dad init`, `dad logs`, `dad prune`)**
  - Implement `src/cli/init.ts` for project scaffolding and auto-trust
  - Implement `src/cli/logs.ts` for inspection of stderr and lifecycle event timelines
  - Implement `src/cli/prune.ts` for database cleanup
- [ ] **Task 2.3: Enhanced `dad doctor` & `dad status`**
  - Provide full matrix probe diagnostics across runtime, database, storage, config trust, and all advisors

### Wave 3: MCP Server Enterprise Compliance (Protocols & Integrations)
- [ ] **Task 3.1: MCP Resources & Prompts**
  - Add MCP resource handlers: `dad://consultations/latest`, `dad://consultations/{id}`, `dad://advisors`
  - Add MCP prompt templates: `dad_consult_brief`, `dad_escalation_triage`
- [ ] **Task 3.2: Agent Hooks & Skill Manifests**
  - Package ready-to-use hooks and skill definitions for Claude Code, Gemini CLI, Antigravity, and Codex

### Wave 4: Testing, Verification & Hardening (Quality Gates)
- [ ] **Task 4.1: Unit & Contract Test Suite Expansion**
  - Test config loader, prompt compiler, dynamic fallback, and new CLI commands
- [ ] **Task 4.2: High-Concurrency & Edge Case Stress Testing**
  - Run 50+ concurrent consultations, test database lock contention, timeout recovery, and corrupted configs
- [ ] **Task 4.3: Build & Distribution Verification**
  - Run `tsc --noEmit`, `bun run build`, and verify binary execution and package files

---

## Verification Criteria
1. `bun test` passes 100% of all test suites (target > 100 tests).
2. `tsc --noEmit` and `bun run build` compile cleanly with zero errors.
3. `dad doctor` reports 100% healthy status with runtime, DB, storage, and registered advisors.
4. `dad init` creates valid `.consult-dad/config.json` and records trust hash in `.config-approval.json`.
5. MCP stdio server passes full tool, prompt, and resource invocations.
