# CONT-P20 — 05 Stabilization Backlog (WS-20.5, DEL-05)

## Consolidated stabilization backlog (all prior phases, prioritized)

| ID | Item | Source | Priority | Owner | Trigger |
| --- | --- | --- | --- | --- | --- |
| STAB-01 | Fresh-SQLite bootstrap partial (9 tables, signup 500) | DEF-P15-06 | **P1** | Eng | before any SQLite restore-drill or seeded-load claims |
| STAB-02 | RLS live-PG verification (`--postgresql`) | DEF-P14-03 | **P1** | SRE | staging PG available |
| STAB-03 | PG restore drill (RDS path runbook-only) | DEF-P15-08 | P2 | SRE | staging PG + window |
| STAB-04 | Full k6 re-run @ 50VU (seeded user needs STAB-01) | DEF-P15-07 | P2 | SRE | STAB-01 close |
| STAB-05 | DB-versioned prompt store + A/B rollout (W5 residual) | DEF-P14-04 | P2 | AI/ML Eng | CONT-P21 planning |
| STAB-06 | Configmap 5000 vs code-default 100 review | DEF-P16-03 | P3 | SRE | pre-prod hardening |
| STAB-07 | promtool local run + live incident drill | DEF-P17-01/02 | P3 | SRE | staging cluster |
| STAB-08 | Slack `invalid_auth` env failure | DEF-P14-01 | P3 | Eng | token provisioned |
| STAB-09 | xdist full-suite hang (finding 39) | DEF-P14-02 | P3 | QA | runner investigation |
| STAB-10 | BQ-05 sponsor + BQ-06 reviews | U-01 | **P0-gating** | Business | stakeholder decision |

## Limitations published (phase rule)

Pilot traffic, live reconciliation, and production telemetry remain
not-executed pending STAB-10. Everything else above is verified present.
