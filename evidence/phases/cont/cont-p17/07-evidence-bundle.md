# CONT-P17 — 07 Evidence Bundle

| EVD | Claim | Location | Independent check |
| --- | --- | --- | --- |
| EVD-P17-01 | /metrics live | boot 2026-09-15 :8001 | HTTP 200, `http_requests_total{handler,method,status}` |
| EVD-P17-02 | Correlation live | same boot | `X-Request-ID: bc7eb5a0-…` header |
| EVD-P17-03 | OTel + middleware | `opentelemetry.py`, `log.py`, `main.py` | setup + mount + graceful-degrade |
| EVD-P17-04 | 31 dashboard panels | 4 JSONs | parsed counts 7/8/8/8 |
| EVD-P17-05 | 24 alert rules | 2 YAMLs | parsed 4 groups |
| EVD-P17-06 | SLO + budgets | `docs/operations/SLO.md` | 6 targets + ladder |
| EVD-P17-07 | Runbook suite | `docs/operations/` + DR + deploy + temporal | 10+ docs inventoried |
| EVD-P17-08 | Shadow flags | `config.py` | langgraph/agent/eval shadow + percent |
| EVD-P17-09 | Cost/privacy ops | `agent_costs`, `_redact`, retention | budgets + 9 keys + 30d |
| EVD-P17-10 | Predecessor valid | `cont-p16` gate + handoff | 96.47 + authorization |
