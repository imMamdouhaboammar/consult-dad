# Consultation Protocol Reference

## Schemas

### Request Schema: `consult-dad.request.v1`
```json
{
  "schema": "consult-dad.request.v1",
  "consultation_id": "dad_...",
  "mode": "diagnose | consult | review | decide | challenge | takeover",
  "caller": { "agent": "worker-name", "role": "worker" },
  "goal": "Description of ultimate objective",
  "question": "Exact question or choice",
  "current_hypothesis": "Theory of what is failing",
  "attempts": [
    { "action": "What was tried", "outcome": "What happened" }
  ],
  "evidence": {
    "failing_tests": [],
    "errors": [],
    "relevant_files": [],
    "git_diff": null
  },
  "constraints": {
    "read_only": true,
    "workspace_root": "/path/to/repo"
  },
  "decision_needed": "Specific advice requested"
}
```

### Answer Schema: `consult-dad.answer.v1`
```json
{
  "schema": "consult-dad.answer.v1",
  "consultation_id": "dad_...",
  "status": "completed",
  "advisor": { "id": "staff", "adapter": "codex" },
  "verdict": "Clear, concise analytical conclusion",
  "recommendation": ["Step 1", "Step 2"],
  "assumptions": ["Assumption 1"],
  "risks": ["Risk 1"],
  "verification": ["Command or test to run"],
  "confidence": "high | medium | low",
  "worker_action": "continue | retry | escalate | abort",
  "needs_followup": false
}
```
