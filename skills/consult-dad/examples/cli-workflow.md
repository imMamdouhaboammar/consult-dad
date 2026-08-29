# Consult Dad — End-to-End CLI Workflow Example

This walkthrough illustrates a complete real-world scenario where a worker agent encounters a concurrency deadlock in a token refresh loop, packages evidence, consults Dad, verifies advice, and follows up.

---

### Step 1: Worker Agent Encounters Failure Loop
The agent attempts two separate fixes for a flaky token test:
```bash
# Attempt 1: increase timeout (FAILED)
# Attempt 2: retry with backoff (FAILED)
```

### Step 2: Agent Gathers Evidence & Calls Dad
```bash
dad ask -m diagnose \
  -f src/auth/token.ts \
  -f src/auth/session.ts \
  --test "tests/auth/refresh.test.ts" \
  -e "Error: SQLITE_BUSY: database is locked" \
  --hypothesis "Inverse lock acquisition between user table and token table" \
  "Why does token refresh deadlock under 50 concurrent requests?"
```

### Step 3: Structured Answer Returned
```
👨‍💼 Dad's Verdict:
Deadlock is caused by concurrent workers contending for uncommitted write locks in two separate transactions. You need a SingleFlight deduplication gate before hitting SQLite.

📋 Recommendations:
1. Implement in-memory SingleFlight lock on userId in `src/auth/token.ts`.
2. Wrap SQLite transaction in immediate transaction (`BEGIN IMMEDIATE`).
3. Set WAL busy timeout to 5000ms.

🔬 Verification:
Run `bun test tests/auth/refresh.test.ts` with 50 worker threads.
```

### Step 4: Worker Implements Fix & Tests
The worker implements the `SingleFlight` pattern and executes tests.

### Step 5: Followup with New Metrics
```bash
dad followup dad_01JXYZ "Implemented SingleFlight pattern: 50 concurrent requests resolved in 14ms with 0 lock errors."
```
