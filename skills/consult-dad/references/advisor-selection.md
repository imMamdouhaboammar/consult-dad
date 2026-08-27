# Advisor Selection & Registry Reference

Consult Dad avoids hardcoded model hierarchies. All advisors are registered with capability metadata and dynamic probing.

## Registration Example

```typescript
registry.register({
  adapter: new CodexAdapter({ id: "staff" }),
  priority: 100,
  capabilities: ["debugging", "architecture", "code-review", "concurrency"],
  description: "Senior Staff Debugger & Concurrency Specialist"
});

registry.register({
  adapter: new ClaudeAdapter({ id: "architect" }),
  priority: 90,
  capabilities: ["architecture", "design", "tradeoffs", "threat-modeling"],
  description: "Principal Systems Architect"
});
```

## Routing Rule

When no explicit advisor is passed, Consult Dad scores candidates by:
1. Availability and authentication probe
2. Capability keyword overlap (mode + question)
3. Configured priority
