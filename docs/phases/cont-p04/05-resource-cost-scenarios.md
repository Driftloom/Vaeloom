# CONT-P04 — 05 Resource / Cost Scenarios — No Invented Values

**Deliverable:** `DEL-CONT-P04-05` | **Owner:** FinOps Specialist + Release
Manager

## Scenarios (no procurement invented per `BQ-06 REQUIRES_STAKEHOLDER_DECISION`)

| Scenario          | Resource                                                         | Basis                                      | Cost Where Measured            | Guardrail                                                 |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------ | ------------------------------ | --------------------------------------------------------- |
| Staffing          | `Product 1, Eng 3, SRE 1`                                        | `MVP-P04 88.5` RACI `22 backlog`           | `commit plan 280 commits`      | `capacity 20 RPS headroom 60%` triggers hiring `CONT-P15` |
| AI/Provider spend | `embedding text-embedding-3-small` `llm_model claude-3-5-sonnet` | `config.py llm_model` `AGENT_RPM 30` quota | `$0.02/1k` `mvp-p15 93.1`      | `AGENT_CONCURRENCY 5` budget `scrape_quota 20/h`          |
| Infra             | `TF 12 modules s3+DDB` `K8s HPA min3 max10 cpu70 mem80`          | `mvp-p16 92.8`                             | `12 TF validate`               | `+headroom 60%` triggers `CONT-P15`                       |
| Support readiness | `on-call 15m/30m SEV1-4` `runbooks 4`                            | `mvp-p17 93.2`                             | `check-health.sh 3 probes 30s` | `SLO 99.9% 43.2m`                                         |

**Budget guard:** `REQUIRES_STAKEHOLDER_DECISION` for `BQ-06` — no invented
procurement; real spend via `AGENT_REACT_ENABLED` shadow before action.

## Reserve Capacity

- **Remediation 20%:** per `05-non-goals backlog` `CONT-P01`
  `22 backlog quarterly`
- **Security/Data quality/Docs 15%:** per overlay 144
