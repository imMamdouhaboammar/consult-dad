# Multi-Agent Orchestration & Escalation Patterns

In multi-agent systems (e.g. Agency, Antigravity Swarms, AutoGen, CrewAI, LangGraph), agents frequently delegate entire tasks. However, unconstrained delegation leads to confusion of ownership and runaway context costs.

**Consult Dad introduces Escalation of Judgment:**

```
Worker Agent (Executes Task) ──[Hits Obstacle]──> Consult Dad (Staff Advisor)
     │                                                     │
     │ <───────────── Structured Technical Advice ─────────┘
     ▼
Worker Agent (Implements verified fix & tests)
```

---

## Escalation vs Delegation Matrix

| Dimension | Delegation (Worker to Worker) | Escalation (Worker to Dad) |
|---|---|---|
| **Ownership** | Transferred away from caller | Retained by the worker agent |
| **Execution** | Done by the target agent | Done by the worker agent |
| **Scope** | Whole feature / ticket | Specific decision / deadlock / diagnosis |
| **Recursion** | Unbounded depth | Max depth = 1 (Strictly non-recursive) |
| **State** | Shared branch / commit | Structured read-only JSON answer |

---

## Multi-Agent Supervisor Pattern

In a supervisor-worker cluster:
1. **Supervisor** assigns work cards to **Worker Agents**.
2. When a **Worker Agent** encounters 2 failed test cycles, it calls `dad_consult` (MCP or CLI).
3. The Worker Agent logs the `consultation_id` in its progress report.
4. The Supervisor reads the Dad verdict and verifies that the Worker applied the technical recommendations.
5. If the Worker resolves the problem, execution proceeds. If 3 consecutive Dad consultations fail to resolve the impasse, the Supervisor halts the task and escalates to the Human Controller.
