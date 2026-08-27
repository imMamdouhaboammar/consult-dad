# Consult Dad — Agent Guidelines

## Identity & Core Philosophy

- **Consult Dad** is a local escalation bridge for coding agents — consult a higher-trust advisor without surrendering control.
- **Dad is a Role + Escalation Protocol + Local Runtime**, not a smarter model.
- The model or coding agent playing the Dad role is an interchangeable Adapter (Codex, Claude, etc.).
- **Consultation ≠ delegation:** Consultation is escalation of judgment; the worker agent retains ownership and continues execution itself.
- **Default is read-only:** All consultation modes (`consult`, `diagnose`, `review`, `decide`, `challenge`) are strictly read-only. `takeover` is the only mode that writes and requires explicit user permission.

## Engineering Rules

1. **Bun is mandatory:** Always use `bun` (and `bun test`, `bun run build`). Never use `npm` or `yarn`.
2. **TypeScript strict mode:** All code must pass `tsc --noEmit` and strict type checks.
3. **Zod validation:** All data at runtime boundaries (requests, answers, state, configuration) must be validated with Zod schemas.
4. **Conventional commits:** Use conventional commit formatting (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`).
5. **No hardcoded model hierarchy:** All advisor resolution is handled via the registry and routing policies.
6. **Max depth = 1:** An advisor cannot recursively call another Dad consultation.
7. **Secret redaction:** Sensitive tokens and keys must never be persisted into context or state artifacts.
