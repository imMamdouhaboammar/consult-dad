# Developing & Configuring Advisor Adapters

Every advisor adapter implements the `AdvisorAdapter` interface:

```typescript
export interface AdvisorAdapter {
  readonly id: string;
  probe(): Promise<AdvisorAvailability>;
  start(request: ConsultationRequest): Promise<AdvisorRun>;
  resume(run: AdvisorRun, delta: FollowupRequest): Promise<AdvisorRun>;
  cancel(run: AdvisorRun): Promise<void>;
  result(run: AdvisorRun): Promise<ConsultationAnswer>;
}
```

## Available Adapters

1. **`CodexAdapter`** (`src/adapters/codex.ts`): Interacts with OpenAI Codex CLI (`codex exec -s read-only --json -`).
2. **`ClaudeAdapter`** (`src/adapters/claude.ts`): Interacts with Claude Code CLI (`claude --print -p`).
3. **`GenericCommandAdapter`** (`src/adapters/generic-command.ts`): Wraps any executable command piping the structured brief via stdin and parsing stdout.
4. **`FakeAdvisorAdapter`** (`src/adapters/fake.ts`): Mock adapter for deterministic testing and local debugging.
