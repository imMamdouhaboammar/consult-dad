# Security & Governance Reference

## Trust & Boundaries

1. **Workspace Boundary**:
   - `WorkspaceGuard` asserts all paths stay within the authorized root.
   - Directory traversal (`..`) is strictly blocked.

2. **Secret Redaction**:
   - `ContextPackBuilder` automatically redacts patterns for OpenAI, Anthropic, GitHub, GitLab, Bearer JWTs, and private keys.

3. **Environment Scrubbing**:
   - `EnvironmentCleaner` filters credentials and tokens from spawned advisor processes.

4. **Project Config Trust**:
   - `.consult-dad/config.json` requires explicit approval (`dad trust`).
   - Changes to the configuration invalidate the SHA-256 approval hash, halting execution until re-approved.
