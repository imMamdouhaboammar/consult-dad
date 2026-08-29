# Consult Dad Troubleshooting & Diagnostics

## 1. Quick Diagnostic Probing

Always start by running the health probe:

```bash
dad doctor
```

This verifies:
- **Bun Runtime**: Minimum version and execution environment.
- **SQLite Engine**: Database connectivity, WAL mode, table schemas, and write latency.
- **Artifact Storage**: Disk permissions and directory readability.
- **Config Trust**: Validates `.consult-dad/config.json` SHA-256 hash.
- **Advisors Matrix**: Probes availability and authentication of Codex, Claude, Gemini, and custom CLI adapters.

---

## 2. Common Issues & Solutions

### A. Config Trust Hash Mismatch (`unapproved_modified` or `unapproved_new`)
**Symptom**:
```
[consult-dad] Warning: Project config is unapproved_modified. Run 'dad trust' to review and approve.
```
**Cause**:
A teammate or git pull modified `.consult-dad/config.json`. To protect against malicious prompt injections or command execution, Consult Dad rejects untrusted configs by default.

**Resolution**:
```bash
# Inspect changes and view diff
dad trust

# Review and approve the new hash
dad trust --approve
```

---

### B. Advisor Not Available or Not Authenticated (`advisor_unavailable` / `advisor_not_authenticated`)
**Symptom**:
```
Consultation failed: [advisor_not_authenticated] Advisor 'codex' is not authenticated.
```
**Resolution**:
1. Check advisor credentials or CLI binary availability:
   - For Codex: Verify `codex login` or `OPENAI_API_KEY`.
   - For Claude: Verify `claude auth` or `ANTHROPIC_API_KEY`.
   - For Gemini: Verify `gcloud auth` or `GEMINI_API_KEY`.
2. Check automatic failover: Consult Dad automatically routes to secondary available advisors in the registry. If all advisors fail, verify at least one advisor is registered and functional via `dad advisors`.

---

### C. SQLite Database Lock Contention (`SQLITE_BUSY`)
**Symptom**:
```
Error: SQLite database is locked
```
**Cause**:
Concurrent processes attempting simultaneous non-WAL transactions.

**Resolution**:
Consult Dad automatically operates in **SQLite WAL (Write-Ahead Logging)** mode with `busy_timeout = 5000ms`.
If a stale lock exists:
```bash
# Check running background processes
ps aux | grep "dad"

# Clean up / prune stale consultations
dad prune --days 7
```

---

### D. Consultation Timeout (`timeout`)
**Symptom**:
```
Consultation failed: [timeout] Advisor execution exceeded timeout limit (120000ms)
```
**Resolution**:
1. Reduce context size by attaching only relevant files instead of entire directories:
   ```bash
   dad ask -f src/auth/token.ts "Why does token refresh deadlock?"
   ```
2. Increase timeout in `.consult-dad/config.json`:
   ```json
   {
     "consultation": {
       "timeout_ms": 180000
     }
   }
   ```

---

### E. Takeover Mode Rejected (`workspace_violation`)
**Symptom**:
```
Error: Mode 'takeover' requires explicit '--allow-write' permission.
```
**Resolution**:
Consult Dad enforces read-only safety by default. Takeover mode makes workspace changes and requires:
```bash
dad ask --mode takeover --allow-write "Implement token singleflight lock"
```
