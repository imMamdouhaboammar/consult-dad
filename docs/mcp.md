# Model Context Protocol (MCP) Integration

Consult Dad exposes an MCP server for agent-to-advisor escalation.

## Starting the Server

```bash
bun run src/mcp/stdio.ts
# or after build
dad serve --stdio
```

## Available MCP Tools

| Tool | Purpose | Key Arguments |
|---|---|---|
| `dad_consult` | Start a new consultation | `goal`, `question`, `mode`, `relevant_files` |
| `dad_followup` | Continue an existing thread | `consultation_id`, `message` |
| `dad_status` | Query state/history | `consultation_id` |
| `dad_result` | Retrieve structured answer | `consultation_id` |
| `dad_cancel` | Terminate consultation | `consultation_id` |
| `dad_list_advisors` | View advisor health | none |
| `dad_explain_route` | Understand advisor choice | `question`, `mode` |
