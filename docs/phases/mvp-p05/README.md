# MVP-P05 — Solution Architecture

> **Prompt:** `MVP-P05` (66-prompt pack) — ARCHITECTURE phase, design only, no
> runtime implementation. **Governing sources:** INT-02 (SHA-256
> `2FA8966F…69640`) · INT-05 · INT-07/08/09 · gatekeeper · **Predecessor:**
> MVP-P04 ✅ CONDITIONAL GO 88.5/100, accepted by user 2026-08-15. **Status:**
> 🟡 RE-RUN COMPLETE 2026-08-15 @ `6e8a7b4` — gate **87.3/100** recommended
> `PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY`; **USER verdict pending**
> (sole gate authority). Prior run (2026-08-07, 88/100, never ratified)
> superseded — preserved `*-2026-08-07.md`.

## Blocking questions (prompt §8) — resolved

| ID        | Question                     | Decision                                                                                    | Owner             |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------- |
| BQ-01     | Approver                     | User = sole approver; backup none                                                           | Program           |
| BQ-02     | Baseline                     | `master` @ `6e8a7b4`; repo inspected live 2026-08-15 (zero trust)                           | Engineering       |
| BQ-03/04  | Entities/region/age          | India; 18+; P1+P2; child controls N/A                                                       | Privacy           |
| BQ-05     | Team/budget/cohort           | Founder + AI agents; $0; cohort N≈10–20                                                     | Founder           |
| BQ-P05-01 | Availability/failure targets | **99% best-effort core paths; no committed SLA; degraded modes OK**                         | Accountable owner |
| BQ-P05-02 | Data residency               | **Nearest region (Singapore-class free tiers); DPDP residency flagged to P13 legal review** | Privacy           |

## Register index

| #   | Document                               | Purpose                                                       |
| --- | -------------------------------------- | ------------------------------------------------------------- |
| 01  | `01-source-register.md`                | Sources + conflict log (CF-P05-01..05) + zero-trust inventory |
| 02  | `02-predecessor-audit.md`              | Forensic audit of P04 → entry CONDITIONAL GO                  |
| 03  | `03-c4-trust-dataflow.md`              | **DEL-MVP-P05-01** — C4, trust boundaries, data flows         |
| 04  | `04-service-contracts.md`              | **DEL-MVP-P05-02** — service contracts                        |
| 05  | `05-adrs.md`                           | **DEL-MVP-P05-03** — ADR-021..026 (files in `docs/adr/`)      |
| 06  | `06-threat-architecture.md`            | **DEL-MVP-P05-04** — threat-informed architecture             |
| 07  | `07-failure-evolution.md`              | **DEL-MVP-P05-05** — failure/resilience/evolution model       |
| 08  | `08-registers.md`                      | Risks/decisions/assumptions/evidence                          |
| 09  | `09-gate-2026-08-15.md`                | End-of-phase gate (87.3/100)                                  |
| 10  | `10-handoff-to-p06.md`                 | Next-phase handoff (Tech Stack & Standards)                   |
| 11  | `11-completion-response-2026-08-15.md` | §30 A–P completion response                                   |

## Workstreams

| WS      | Workstream                          | Owner                | Output             |
| ------- | ----------------------------------- | -------------------- | ------------------ |
| WS-05.1 | C4/deployment design                | Enterprise Architect | `03`               |
| WS-05.2 | Identity/authorization architecture | Security Architect   | `03` §3–4, `04` §3 |
| WS-05.3 | Data/event/agent flows              | Solution Architect   | `03` §5–6, `04`    |
| WS-05.4 | Failure/resilience/degradation      | SRE                  | `07`               |
| WS-05.5 | ADRs/evolution                      | AI Architect         | `05` + `docs/adr/` |

## Scope note

- **In:** C4/deployment, trust boundaries, service contracts, ADRs (real files),
  threat mapping, failure/evolution model. Design only — no code changes.
- **Out:** implementation, production changes, enterprise features, T2/T3
  enablement (hooks may be designed, not enabled — DEC-P02-05).
- **Repo truth (zero-trust verified 2026-08-15 @ `6e8a7b4`):** FastAPI unified
  backend (~30 routers), Next.js 15 web, Postgres+pgvector (36 tables),
  Redis/BullMQ worker, MinIO, Meilisearch, RLS (`TenantAwareBase`, 4/36 tables),
  approval persistence + idempotency middleware, 6-memory taxonomy, Gmail
  draft-only + watch, OTel. **Key findings:** approval gate NOT enforced in
  agent loop (release-blocking), dual migration systems, workload identity gap
  (ADR-025), contracts package empty. These drive ADR-021..026 + gate
  restrictions.
