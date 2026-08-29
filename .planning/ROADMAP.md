# Consult Dad — GSD Roadmap to Production Grade

## Project Vision
Transform Consult Dad into the industry-standard local escalation bridge for autonomous AI coding agents, providing deterministic, high-trust technical advice from interchangeable Staff Engineer advisors with zero loss of worker ownership.

---

## Phases Overview

### Phase 1: Configuration Subsystem & Config Trust Wiring
- **Goal:** Enable repo-level and user-level configuration (`.consult-dad/config.json`) with cryptographic trust protection, typed Zod schemas, and automatic custom advisor registration.
- **Deliverables:**
  - `src/config/schema.ts` (Zod schema for `config.v1.json`)
  - `src/config/loader.ts` (Hierarchical config loader + hash check)
  - `src/cli/init.ts` (`dad init` command)
  - Full test coverage for config parsing, invalid schemas, and untrusted modifications.

### Phase 2: Dynamic Routing & Resilient Broker Lifecycle
- **Goal:** Unify `ConsultationBroker` with `AdvisorRegistry` for dynamic, capability-based advisor resolution with automatic fallbacks and structured error recovery.
- **Deliverables:**
  - Dynamic `registry.resolve()` integration in `ConsultationBroker`
  - Graceful multi-tier fallback (Preferred -> Secondary -> Generic Command -> Actionable Error)
  - Structured error classification adhering to `ErrorCodeEnum`
  - Integration tests for advisor failover and timeout handling.

### Phase 3: Specialized Prompt Compiler & Evidence Synthesizer
- **Goal:** Compile mode-specific system prompts (`diagnose`, `decide`, `challenge`, `review`, `takeover`) into rich context packs with enhanced secret scrubbing.
- **Deliverables:**
  - `src/prompts/compiler.ts` (Embedded prompt templates + mode decorators)
  - Enhanced `ContextPackBuilder` (hypothesis trees, test summaries, diff parsing)
  - Extended redaction for 15+ secret patterns (GCP, AWS, Supabase, JWT, OAuth, DB URIs)
  - Prompt compilation and redaction test suite.

### Phase 4: Full CLI Ergonomics & Developer Tooling
- **Goal:** Provide first-class CLI ergonomics for humans and subagents with rich file/diff/log attachments, streaming status, and diagnostics.
- **Deliverables:**
  - Extended `dad ask` flags: `-f, --file`, `--diff`, `--test`, `--log`, `--timeout`
  - `dad logs <id>` command for lifecycle event and stderr inspection
  - Enhanced `dad doctor` reporting full advisor matrix and trust health
  - Pretty table output with chalk/ansi formatting and raw `--json` modes.

### Phase 5: MCP Server Enterprise Compliance (Resources + Prompts)
- **Goal:** Elevate MCP server to support MCP Prompts, MCP Resources, and structured tool definitions for seamless integration with Claude Desktop, Cursor, and Gemini CLI.
- **Deliverables:**
  - MCP Resources (`dad://consultations/latest`, `dad://consultations/{id}`, `dad://advisors`)
  - MCP Prompts (`dad_consult_template`, `dad_escalation_guide`)
  - Full JSON schema validation and error wrapping across all tools
  - Automated stdio client test harness.

### Phase 6: Agent Harness Integrations & Automated Hooks
- **Goal:** Ship turn-key integrations for Claude Code, Gemini CLI, Antigravity, and Codex with automatic escalation triggers on repeated tool failures.
- **Deliverables:**
  - Pre-built Claude Code hooks & slash commands
  - Antigravity / Gemini CLI skill bundle in `skills/consult-dad/`
  - Documentation and end-to-end integration walkthrough.

### Phase 7: Concurrency Hardening, Packaging & Release Readiness
- **Goal:** Validate high-concurrency resilience (50+ simultaneous consultations), database WAL integrity, clean build outputs, and automated CI/CD workflows.
- **Deliverables:**
  - High-concurrency stress test suite
  - Database cleanup/vacuum utility (`dad prune`)
  - GitHub Actions CI matrix with automated build, lint, and test validation
  - Production release readiness verification.
