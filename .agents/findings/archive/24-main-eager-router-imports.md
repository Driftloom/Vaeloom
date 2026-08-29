# Finding: 25+ Routers Imported Eagerly

| Metadata     | Value                         |
| ------------ | ----------------------------- |
| **ID**       | FIND-MAIN-005                 |
| **Severity** | P2-MEDIUM                     |
| **Status**   | OPEN                          |
| **Source**   | main.py Audit                 |
| **File**     | `apps/api/src/api/main.py:61` |

## Description

25 router modules are imported in a single line. If ANY router has an import
error (missing dependency, syntax error), the entire application fails to start
with an opaque error.

## Evidence

```python
from .routers import health, auth, workspaces, memory, agents, events, search,
    integrations, billing, documents, resumes, applications, plugins, chat,
    notifications, connectors, scheduler, analytics, audit, iam, knowledge_graph,
    recommendations, webhooks, admin_console, gmail
```

## Impact

- Single import failure kills entire application
- Difficult to debug which router is broken
- Cannot run subset of features

## Remediation

Use lazy-loading or try/except-per-router pattern. Consider a router registry.
