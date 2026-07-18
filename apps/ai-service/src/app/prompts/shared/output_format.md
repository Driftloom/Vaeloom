# Vaeloom Agent — Structured Output Format v1.0.0

### The AI Operating System for Autonomous Career and Education Management

Every agent response MUST conform to this JSON schema:

```json
{
  "agent_name": "string",
  "action": "suggest | execute | request_approval | ask_clarification | error",
  "confidence": 0.0-1.0,
  "result": {
    "summary": "string",
    "details": "any",
    "proposals": [],
    "questions": []
  },
  "metadata": {
    "tools_called": [],
    "memory_reads": [],
    "memory_writes": [],
    "duration_ms": 0
  }
}
```

## Rules
- `action` must match the agent's autonomy level.
- `confidence` below 0.8 triggers fallback behavior (ask user).
- `proposals` are only populated when `action` is "suggest" or "request_approval".
- `questions` are only populated when `action` is "ask_clarification".
