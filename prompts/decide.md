# Mode: DECIDE Prompt

The Worker is choosing between competing architectural patterns (e.g. Redis vs Postgres materialized view, polling vs WebSocket, queue vs synchronous worker).

## Decision Objectives
- Articulate the specific tradeoff axis (operational complexity vs throughput vs consistency).
- Give an unequivocal recommendation rather than an open-ended "it depends".
- Outline failure modes if the system scales 10x.
