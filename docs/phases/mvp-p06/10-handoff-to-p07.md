# MVP-P06 — 10. Handoff to MVP-P07 (Data Architecture & Database Design)

> **Phase:** MVP-P06 → MVP-P07 · **Date:** 2026-08-15 (re-run) · **Upgraded:**
> 2026-08-17 · **Baseline:** repo `master` @ `e48f547` · **Gate state:** 🟡
> **PHASE CONDITIONALLY APPROVED — CONFLICTS RESOLVED, CARRIED FAILURES**
> (69.9/100 raw; ~73-75 after conflict resolution, `09-gate-2026-08-15.md`);
> **USER verdict pending** (sole gate authority, BQ-01). **P07 starts ONLY on
> user command.** Prior run (2026-08-07, CONDITIONAL GO 88/100, never ratified)
> superseded; history preserved (`*-2026-08-07.md`).

## 1. What P07 receives (validated — do not assume, re-verify)

| Item                                                                                                                 | Where                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Source register + standards re-verified 2026-08-15 + zero-trust repo inventory @ `e48f547` + conflicts CF-P06-01..08 | `01-source-register.md`                                                                 |
| P05 forensic audit + entry decision (CONDITIONAL GO — NON-DEPENDENT WORK ONLY)                                       | `02-predecessor-audit.md`                                                               |
| Technology decision matrix (DEL-01): stack pinned from repo truth                                                    | `03-technology-decision-matrix.md`                                                      |
| Version policy (DEL-02): enterprise-grade frozen lockfile, EOL watch, SBOM, cosign keyless                           | `04-version-policy.md`                                                                  |
| Engineering standards (DEL-03): lint/typecheck/test, commit/branch/PR, API, errors, observability                    | `05-engineering-standards.md`                                                           |
| Dependency governance (DEL-04): license, vuln SLA, secrets, provenance, supply-chain threats                         | `06-dependency-governance.md`                                                           |
| Cost/exit strategy (DEL-05): PaaS framework, $0 guardrails, exit playbooks                                           | `07-cost-exit-strategy.md`                                                              |
| Config edits: backend ruff/mypy/coverage, .python-version, CI fixes, compose fixes, dependabot pip                   | Various                                                                                 |
| Registers: 14 risks, 9 decisions, 4 assumptions, 13 deferred, 23 EVD                                                 | `08-registers.md`                                                                       |
| Gate + handoff + completion response                                                                                 | `09-gate-2026-08-15.md`, `10-handoff-to-p07.md`, `11-completion-response-2026-08-15.md` |
| P00–P05 chain (requirements baseline 76 rows, stories, matrix, ADRs, architecture)                                   | `../mvp-p00/` … `../mvp-p05/`                                                           |

## 2. P07 focus (Data Architecture & Database Design)

1. **Resolve dual migration systems** (CF-P05-04): unify `alembic/versions/` +
   `src/backend/migrations/` into single migration path
2. **Verify/complete RLS** (ADR-023): currently 4/36 tables; GUC `app.tenant_id`
   never SET
3. **Verify/complete approval persistence** (ADR-021): `has_approval=False`
   hardcode in `orchestrator/loop.py:82-83`; no payload_hash column
4. **Verify 6-memory taxonomy** (ADR-022): `0004_memory_taxonomy.py` exists;
   verify all 6 types + supersession
5. **Design data architecture**: schema, indexes (pgvector HNSW/IVFFLAT),
   projections, event sourcing, audit trail
6. **Workload identity** (ADR-025): design service-token/HMAC mechanism (design
   gap)

## 3. Constraints carried

- $0 budget (DEC-P01-08); nearest-region PaaS (DEC-P05-02, BQ-P05-02); 99%
  best-effort, no SLA (DEC-P05-01)
- Repo truth outranks prose; single FastAPI service + worker; no NestJS app
- Approval-gate enforcement = release-blocking (RISK-P05-02): wire
  approval_manager into agent loop, add payload_hash, immutable decisions before
  any send-capable path
- RLS coverage verify/complete P07 + isolation suite P14; workload identity
  ADR-025 = design → P07/P11
- 6-memory taxonomy verify P07/P12
- No compliance claims without legal review (P13); no production authority
  (P19); T2/T3 OFF (AUTO-02/03)

## 4. Blocked-on-USER items carried into P07

| Item                      | Needed from USER                                    | Impact if unresolved               |
| ------------------------- | --------------------------------------------------- | ---------------------------------- |
| Gate verdict (this phase) | Approve / amend CONDITIONAL GO (69.9/100, below 88) | P07 blocked until verdict recorded |
| VB-07 (cohort signup)     | Founder-network cohort access                       | Interviews UNKNOWN                 |
| VB-08 (synthetic resumes) | Consent for synthetic corpus generation             | Eval corpus NOT_EXECUTED           |
| Ship-window date          | Cohort existence + external blockers                | Window stays scenario-based        |

## 5. Prohibited work (P07 may NOT)

- No requirements changes outside approved change control
- No T2/T3 runtime activation without USER re-confirmation + legal review
- No compliance/security/accessibility/scale claims without evidence +
  professional review
- No scope expansion into enterprise features
- No production/dependent implementation without authority; code implementation
  owned P10+
- No weakening of constraints/tests to create a pass
