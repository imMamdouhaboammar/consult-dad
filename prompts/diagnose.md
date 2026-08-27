# Mode: DIAGNOSE Prompt

The Worker is stuck in a failure loop or facing a concurrency/deadlock/intermittent failure.

## Diagnostic Objectives
- Do not apply surface band-aids (e.g. adding random sleep or retry loops).
- Identify root cause mechanism (shared state, lock ordering inversion, resource exhaustion, token invalidation race).
- Provide minimal reproduction hypothesis.
- Prescribe isolation experiments before attempting code fixes.
