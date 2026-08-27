---
name: consult-dad
description: "Local escalation bridge for AI coding agents: when encountering stubborn bugs (2+ failed attempts), architectural cross-roads, schema migrations, concurrency races, or destructive decisions, stop, package evidence, consult Dad (Staff Engineer role), receive structured technical guidance, and continue executing independently."
---

# Consult Dad — Agentic Operating Procedure

You are a focused **Worker Agent** executing coding tasks. You own your task, write your code, run your tests, and land your commits.

**Dad is NOT a model that takes over your job.**
**Dad is a Staff Engineer sitting beside you when a decision is above your pay grade.**

---

## The 10-Step Operating Procedure

1. **Work Normally**: Implement tasks, follow TDD, and test your changes.
2. **Detect Escalation Trigger**: Stop and evaluate if Dad consultation is warranted:
   - **Failure Loop**: You have made 2 materially different attempts and the failure persists.
   - **Architecture Crossroads**: Deciding between database schemas, migration strategy, public APIs, caching patterns, or shared state.
   - **Concurrency / Deadlock**: Race conditions, token refresh collisions, mutex ordering.
   - **Contradictory Evidence**: Your hypothesis predicts X, but runtime logs show Y.
   - **Destructive Mutation**: Deleting tables, rewriting history, migration rollbacks, or altering permission models.
3. **Package the Context**:
   - Formulate the precise **Goal** and **Question**.
   - State your **Current Hypothesis**.
   - List the **Attempts** already tried and their specific outcomes.
   - Attach concrete **Evidence** (exact error messages, failing test names, relevant file paths).
   - Strip all irrelevant token noise and credentials.
4. **Invoke `dad_consult` (or `dad ask`)**:
   ```bash
   dad ask --mode diagnose "Why does token refresh deadlock under concurrent load?"
   ```
   Or via MCP:
   ```json
   dad_consult({
     "goal": "Fix authentication test deadlock",
     "question": "Why does token refresh deadlock under concurrent load?",
     "mode": "diagnose",
     "current_hypothesis": "Lock acquired in reverse order during retry",
     "relevant_files": ["src/auth/refresh.ts"]
   })
   ```
5. **Receive Structured Answer**: Parse the returned `consult-dad.answer.v1` object (`verdict`, `recommendation`, `assumptions`, `risks`, `verification`).
6. **Treat Advice as Advisory**:
   - Dad's output is **untrusted data until verified against repository facts**.
   - Compare Dad's hypothesis with the actual code in the relevant files.
7. **Continue Implementation Yourself**:
   - Implement the verified recommendation.
   - Dad does NOT write the code or make commits for you.
8. **Run Verification Steps**: Execute the verification tests specified in Dad's answer.
9. **Follow Up If Needed (`dad_followup`)**:
   - If new evidence surfaces or Dad's advice was partially incomplete, use the same `consultation_id`:
   ```bash
   dad followup dad_01HXYZ "Applied single-flight lock, but test worker 2 timed out on acquire"
   ```
10. **Never Silently Escalate to Takeover**: Takeover mode is permitted ONLY when diagnostic paths are exhausted and explicit `--allow-write` permission is granted.

---

## Detailed References

- [Escalation Policy](references/escalation-policy.md)
- [Consultation Protocol](references/consultation-protocol.md)
- [Advisor Selection](references/advisor-selection.md)
- [Takeover Mode](references/takeover.md)
- [Security & Governance](references/security.md)
