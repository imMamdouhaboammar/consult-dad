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


## Write Authorization Policy

The broker is the authoritative enforcement boundary for consultation write authority.

- `consult`, `diagnose`, `review`, `decide`, and `challenge` are always read-only. A request that sets `constraints.read_only: false` in any of these modes is rejected before advisor resolution or persistence.
- `takeover` is accepted only when the request explicitly carries `constraints.read_only: false`.
- The CLI exposes that explicit authorization as `dad ask --mode takeover --allow-write ...`.
- The MCP `dad_consult` tool has no write-authorization channel, so takeover is unavailable and fails closed.
