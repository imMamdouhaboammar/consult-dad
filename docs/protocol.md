# Consult Dad Protocol Specification

## Lifecycle State Machine

```
created ──► queued ──► running ◄──► input_required
                         │
         ┌───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼
     completed         failed        timed_out       canceled
```

## Protocol Schemas

- **Request Schema**: `schemas/consultation-request.v1.json` (`consult-dad.request.v1`)
- **Answer Schema**: `schemas/consultation-answer.v1.json` (`consult-dad.answer.v1`)
- **State Schema**: `schemas/consultation-state.v1.json` (`consult-dad.state.v1`)

## Contract Highlights

- `confidence`: `"high" | "medium" | "low"`
- `worker_action`: `"continue" | "retry" | "escalate" | "abort"`
- `needs_followup`: `boolean`
- `max_depth`: `1` (enforced at broker and escalation policy layer)
