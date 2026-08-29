# Consult Dad — Model Context Protocol (MCP) Integration Guide

Consult Dad provides a standard MCP server implementation that exposes tools, resources, and prompt templates to AI agents over stdio or SSE.

---

## 1. Quick Integration Configuration

### Claude Desktop / Claude Code (`~/.claude/settings.json` or `claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "consult-dad": {
      "command": "dad",
      "args": ["serve"]
    }
  }
}
```

### Cursor IDE (`.cursor/mcp.json` or `~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "consult-dad": {
      "command": "dad",
      "args": ["serve"]
    }
  }
}
```

### Gemini CLI / Antigravity
```json
{
  "mcpServers": {
    "consult-dad": {
      "command": "dad",
      "args": ["serve"]
    }
  }
}
```

### Roo Code / Cline / Windsurf (`mcp.json`)
```json
{
  "mcpServers": {
    "consult-dad": {
      "command": "dad",
      "args": ["serve"],
      "disabled": false,
      "autoApprove": [
        "dad_consult",
        "dad_followup",
        "dad_status",
        "dad_result",
        "dad_list_advisors"
      ]
    }
  }
}
```

---

## 2. MCP Capabilities Exposed

### Tools
1. **`dad_consult`**: Primary consultation entrypoint.
   - Parameters: `goal` (string), `question` (string), `mode` (string), `current_hypothesis` (string), `attempts` (array), `failing_tests` (array), `errors` (array), `relevant_files` (array), `git_diff` (string).
2. **`dad_followup`**: Resume an existing consultation thread.
   - Parameters: `consultation_id` (string), `update` (string).
3. **`dad_status`**: Check consultation status and metadata.
   - Parameters: `consultation_id` (string).
4. **`dad_result`**: Fetch structured answer.
   - Parameters: `consultation_id` (string).
5. **`dad_cancel`**: Abort an ongoing consultation.
   - Parameters: `consultation_id` (string).
6. **`dad_list_advisors`**: List registered advisors and capabilities.
7. **`dad_explain_route`**: Explain which advisor would be selected for a given mode and prompt.

### Resources
- `dad://consultations/latest`: Direct view of the most recent consultation.
- `dad://consultations/{id}`: Detailed view of a specific consultation record and event timeline.
- `dad://advisors`: Live status matrix of all configured advisors.

### Prompts
- `dad_escalation_triage`: Structured template for determining if escalation is warranted before making changes.
- `dad_consult_brief`: Compact template for packaging failing test evidence into a Dad consultation.
