# MVP-P05 — 10. Handoff to MVP-P06 (Technology Stack & Engineering Standards)

> **Phase:** MVP-P05 → MVP-P06 · **Date:** 2026-08-15 (re-run) · **Baseline:**
> repo `master` @ `6e8a7b4` · **Gate state:** 🟡 **RECOMMENDED
> `PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY`** (87.3/100,
> `09-gate-2026-08-15.md`); **USER verdict pending** (sole gate authority,
> BQ-01). **P06 starts ONLY on user command.** Prior run (2026-08-07,
> CONDITIONAL GO 88/100, never ratified) superseded; history preserved
> (`*-2026-08-07.md`).

## 1. What P06 receives (validated — do not assume, re-verify)

| Item                                                                                                                 | Where                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Source register + standards re-verified 2026-08-15 + zero-trust repo inventory @ `6e8a7b4` + conflicts CF-P05-01..05 | `01-source-register.md`                                                                 |
| P04 forensic audit + entry decision (CONDITIONAL GO — NON-DEPENDENT WORK ONLY)                                       | `02-predecessor-audit.md` (PA-MVP-P05-001..009; 9 PASS)                                 |
| C4 / trust boundaries / data flows (DEL-01) grounded in HEAD reality (30 routers, 36 tables, RLS, watch)             | `03-c4-trust-dataflow.md`                                                               |
| Service contracts (DEL-02): API/approval/identity/queue/projection/connector contracts                               | `04-service-contracts.md`                                                               |
| ADR-021..026 (DEL-03): real files in `docs/adr/` + summary                                                           | `05-adrs.md`, `docs/adr/ADR-021..026*.md`                                               |
| Threat-informed architecture (DEL-04): OWASP Agentic/LLM mapping + residual register                                 | `06-threat-architecture.md`                                                             |
| Failure/evolution + SLOs (DEL-05): 99% best-effort, deferred backlog                                                 | `07-failure-evolution.md`                                                               |
| Registers: 10 risks OPEN, 5 decisions (DEC-P05-01..05), 4 assumptions, 10 EVD                                        | `08-registers.md`                                                                       |
| Gate (87.3/100) + this handoff + §30 completion response                                                             | `09-gate-2026-08-15.md`, `10-handoff-to-p06.md`, `11-completion-response-2026-08-15.md` |
| P00–P04 chain (requirements baseline 76 rows, stories, matrix, release baseline P0+P1 = 73)                          | `../mvp-p00/` … `../mvp-p04/`                                                           |

## 2. P06 focus (Tech Stack & Engineering Standards)

1. **Pin the stack from repo reality** (CF-P05-01): Next.js 15 + FastAPI (Python
   3.14) + SQLAlchemy 2 + PostgreSQL/pgvector + Redis (BullMQ-compatible worker)
   - MinIO/S3 + Meilisearch — declare versions, lint/format/typecheck/test
     standards (nx/pnpm targets exist).
2. Standards: OpenAPI (pin minor at P08; `docs/backend/openapi.yaml` currency
   UNVERIFIED), RFC 9700 OAuth/PKCE, WCAG 2.2 AA, NIST SSDF 800-218, commit/tag
   conventions, package governance, dependency pinning + audit (supply-chain
   threat LLM03 open).
3. Engineering standards for ADR-021/022/023 implementations: **single migration
   path** (resolve dual systems CF-P05-04), idempotency + approval API shapes,
   RLS patterns (GUC set + coverage), projection rebuild jobs.
4. Environment matrix (dev docker-compose → staging → prod PaaS, ADR-026) +
   secrets flow (SecretManager) + CI gate rules (11 workflows exist).

## 3. Constraints carried

- $0 budget (DEC-P01-08); nearest-region PaaS (BQ-P05-02, flagged P13); 99%
  best-effort, no SLA (BQ-P05-01).
- Repo truth outranks prose; single FastAPI service + worker; no NestJS app.
- **Approval-gate enforcement (RISK-MVP-P05-02) = release-blocking** — verified
  at `14a1936`: sole call site `orchestrator/loop.py:82-83` hardcodes
  `has_approval=False`, `agent_approvals` never read back. P07/P11 must consult
  persisted decisions + wire `approval_manager` + add `payload_hash` + immutable
  decisions before any send-capable path; Gmail draft-only until per-user T3
  enablement.
- RLS coverage verify/complete P07 + isolation suite P14; workload identity
  ADR-025 = design gap → P07/P11; 6-memory taxonomy verify P07/P12 (ADR-022).
- No compliance claims without legal review (P13); no production authority
  (P19); T2/T3 OFF (AUTO-02/03).

## 4. Blocked-on-USER items carried into P06

| Item                      | Needed from USER                                  | Impact if unresolved                          |
| ------------------------- | ------------------------------------------------- | --------------------------------------------- |
| Gate verdict (this phase) | Approve / amend 87.3/100 conditional              | P06 blocked until verdict recorded            |
| VB-07 (cohort signup)     | Founder-network cohort access                     | Interviews UNKNOWN; proxy evidence stands     |
| VB-08 (synthetic resumes) | Consent for synthetic corpus generation           | Eval corpus NOT_EXECUTED; public sets suffice |
| Ship-window date          | Cohort existence + external blockers (DEC-P04-02) | Window stays scenario-based                   |

## 5. Prohibited work (P06 may NOT)

- No requirements changes outside approved change control
  (`../mvp-p03/07-change-control.md`).
- No T2/T3 runtime activation without USER re-confirmation + legal review (P13).
- No compliance/security/accessibility/scale claims without evidence +
  professional review.
- No scope expansion into enterprise features; no fabricated user research.
- No production/dependent implementation without authority, backup, rollback,
  monitoring and named approver; code implementation owned P10+.
