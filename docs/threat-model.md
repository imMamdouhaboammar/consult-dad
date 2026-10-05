# Threat Model & Security Posture

## Assets to Protect
1. **Source Code & Working Tree**: Prevent unauthorized edits during read-only consultations.
2. **Secrets & Credentials**: Ensure API tokens and database passwords never leak into advisor prompts, logs, or stored artifacts.
3. **Control Authority**: Ensure the Worker/Human maintains full authority over final code commits.

## Threat Mitigations

| Threat | Defense |
|---|---|
| Malicious project config in cloned repo | Project config is fail-closed: `.consult-dad/config.json` has no runtime authority unless its exact current contents match a `ConfigTrust` approval created by `dad trust`. New or modified project config is ignored and the runtime falls back to global or built-in defaults. |
| Prompt injection extracting secrets | `ContextPackBuilder` regex scrubbing for OpenAI, Anthropic, GitHub, JWT, Slack tokens. |
| Advisor writing files during consultation | `WorkspaceGuard` enforces `read_only: true` by default. |
| Directory traversal (`../../etc/passwd`) | `WorkspaceGuard` rejects non-workspace paths. |
| Recursive runaway loops | `max_depth: 1` policy and `maxConsultationsPerTask: 3` cap. |
