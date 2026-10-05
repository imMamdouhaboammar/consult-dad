# Threat Model & Security Posture

## Assets to Protect
1. **Source Code & Working Tree**: Prevent unauthorized edits during read-only consultations.
2. **Secrets & Credentials**: Ensure API tokens and database passwords never leak into advisor prompts, logs, or stored artifacts.
3. **Control Authority**: Ensure the Worker/Human maintains full authority over final code commits.

## Threat Mitigations

| Threat | Defense |
|---|---|
| Malicious project config in cloned repo | Project config is fail-closed: `.consult-dad/config.json` has no runtime authority unless its exact current contents match a `ConfigTrust` approval created by `dad trust`. New or modified project config is ignored and the runtime falls back to global or built-in defaults. |
| Prompt/advisor content containing supported secret patterns | One shared `RedactionService` scrubs supported token/key/credential patterns for prompt construction and again at SQLite/artifact persistence sinks. |
| Unauthorized write-enabled consultation | `EscalationPolicy` is enforced by `ConsultationBroker` before advisor resolution or persistence. Non-takeover modes cannot receive write authority, takeover requires an explicit write authorization signal, and MCP takeover fails closed because no such signal is exposed there. |
| Directory traversal (`../../etc/passwd`) | `WorkspaceGuard` rejects non-workspace paths. |
| Recursive runaway loops | `max_depth: 1` policy and `maxConsultationsPerTask: 3` cap. |


## Local Persistence Redaction

New consultation state is sanitized before durable writes to SQLite, JSON/text artifacts, event details, and stderr logs. Redaction is pattern-based and does not claim to detect every possible secret format.

State created by earlier versions is not rewritten automatically. If older consultation history may contain sensitive diagnostics, stop all Consult Dad processes before cleanup. Under the current default layout, remove the historical database at `~/.local/state/consult-dad/consult-dad.db`, its SQLite sidecars `consult-dad.db-wal` and `consult-dad.db-shm` when present, and the consultation artifact directory at `~/.local/state/consult-dad/consultations/` after preserving any evidence you intentionally need. This deletes consultation history. The separate config-trust approval file is not part of that cleanup unless you intentionally want to re-approve project configuration.
