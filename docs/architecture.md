# Consult Dad Architecture

```
┌──────────────┐
│ Worker Agent │
└──────┬───────┘
       │
  Skill / MCP / CLI / Hook
       │
       ▼
┌─────────────────┐
│ Consultation API│
└────────┬────────┘
         │
    Escalation Policy
         │
         ▼
  Context Pack Builder
         │
         ▼
    Advisor Router
      /  |  \
     /   |   \
  Codex Claude Generic
  CLI   CLI  Command
     \   |   /
      \  |  /
  Consultation Result (consult-dad.answer.v1)
         │
         ▼
    Worker Agent
         │
  executes itself
```

## Architectural Tenets

1. **Role, Not Model**:
   - Dad is an escalation role and protocol, not a proprietary LLM.
   - Any agent (Codex, Claude, custom CLI) can fill the Dad role via an `AdvisorAdapter`.
2. **Consult First, Take Over Only When Asked**:
   - Consult Dad is strictly read-only by default.
   - Dad produces structured judgment; the Worker writes code and verifies.
3. **Handle-Based Continuity**:
   - State and thread resumption are identified by `consultation_id` handles (`dad_01H...`).
   - Enables stateless HTTP or stdio MCP transports to resume threads reliably.
4. **Zero Hidden State**:
   - SQLite manages queryable records.
   - Filesystem stores raw artifacts (`request.json`, `events.jsonl`, `answer.json`, `stderr.log`).
