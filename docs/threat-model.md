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
| File evidence path traversal or symlink escape | `WorkspaceGuard` compares canonical filesystem targets against the canonical workspace root. `EvidenceLoader` rejects outside-workspace, missing, non-file, binary, or invalid UTF-8 inputs before consultation. |
| Recursive runaway loops | `max_depth: 1` policy and `maxConsultationsPerTask: 3` cap. |


## Local Persistence Redaction

New consultation state is sanitized before durable writes to SQLite, JSON/text artifacts, event details, and stderr logs. Redaction is pattern-based and does not claim to detect every possible secret format.

State created by earlier versions is not rewritten automatically. If older consultation history may contain sensitive diagnostics, stop all Consult Dad processes before cleanup. Under the current default layout, remove the historical database at `~/.local/state/consult-dad/consult-dad.db`, its SQLite sidecars `consult-dad.db-wal` and `consult-dad.db-shm` when present, and the consultation artifact directory at `~/.local/state/consult-dad/consultations/` after preserving any evidence you intentionally need. This deletes consultation history. The separate config-trust approval file is not part of that cleanup unless you intentionally want to re-approve project configuration.


## File-Backed Evidence

CLI `--file` and `--log` inputs use one `EvidenceLoader` boundary. The loader resolves the actual filesystem target, deduplicates canonical files, accepts regular UTF-8 text files only, redacts supported secret patterns before request construction, and limits reads to 16 KiB per file and 48 KiB total per `dad ask` invocation.

Oversized evidence is truncated and labeled. Missing, unreadable, binary, invalid-encoding, or outside-workspace inputs fail the command instead of being silently omitted.
