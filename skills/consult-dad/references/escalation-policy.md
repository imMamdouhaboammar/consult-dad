# Escalation Policy Reference

## Deterministic Signals

LLM self-confidence is an unreliable metric for escalation. Consult Dad enforces deterministic signals:

| Signal | Threshold / Triggers | Default Mode |
|---|---|---|
| **Failure Loop** | 2 materially different failed attempts | `diagnose` |
| **Architecture Decision** | Schema, migration, database, concurrency, public API, auth, backward compatibility | `decide` |
| **Contradictory Evidence** | Hypothesis contradicts test/log facts | `challenge` |
| **Verification Failure** | Code looks complete but test suite fails | `diagnose` |
| **Destructive Action** | Data deletion, history rewrite, migration rollback, permission changes | `review` |

## Safety Limits

- `max_depth: 1` — An advisor cannot recursively trigger another consultation.
- `max_consultations_per_task: 3` — Prevents infinite looping or runaway token usage on a single task.
- `read_only: true` by default — Dad is strictly an advisor, not an implementer.
