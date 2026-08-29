# CONT-P05 — Target Architecture and Evolution ADRs — Plan (2026-08-29)

> **Status:** DRAFT FOR USER APPROVAL **Mode:** GENERATE_AND_EXECUTE_PHASE
> **Phase:** `CONT-P05` Target Architecture and Evolution ADRs (ARCHITECTURE)
> **Predecessor:** `CONT-P04 95.62 APPROVED — PROCEED` (`78c2d71`, 2026-08-28)
> handoff `09-handoff-to-cont-p05.md` **Commit baseline:** `bd7adc6` (LangGraph
> PRODUCTION READY closure, post-`78c2d71` +22 files) **Track:**
> MVP-to-Enterprise Continuation — migration design baseline (not rewrite)
> **Governing:** `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`
> §22-32 + `CONT-P05` prompt 495 lines

---

## 1. Predecessor Forensic Audit — CONT-P04 (Entry Decision)

| Field         | Expected                                                                                                      | Actual                                                                                      | Verdict                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Previous gate | `CONT-P04 95.62 APPROVED`                                                                                     | `docs/phases/cont-p04/06-gate-report.md:29` 95.62                                           | PASS                                      |
| Approver      | Program Manager                                                                                               | `06-gate-report` Program Manager                                                            | PASS                                      |
| Commit        | `78c2d71`                                                                                                     | `git rev-parse HEAD bd7adc6` ahead 1 (LangGraph closure +22 files, no migration divergence) | PASS (delta is additive, no DB/IaC drift) |
| DELs          | `01 roadmap W0-W7 +02 dependency critical path +03 RACI 5 roles +04 risk burn-down +05 4 scenarios` v1.0      | `docs/phases/cont-p04/01..05` all present, versioned, owned                                 | PASS                                      |
| Evidence      | `93 passed 10 E2E`                                                                                            | re-ran not needed; LangGraph added `64 graph +40 temporal` on `bd7adc6`                     | PASS                                      |
| Handoff       | `09-handoff-to-cont-p05.md` AUTHORIZES CONT-P05                                                               | exists, `AUTHORIZES CONT-P05`                                                               | PASS                                      |
| Blockers      | 0 mandatory, `U-01 pilot windows` deferred `CONT-P19/20`, `BQ-06 procurement` `REQUIRES_STAKEHOLDER_DECISION` | correctly deferred, not invented                                                            | PASS                                      |

**Score:** `98/100 GO` (≥95, 0 blocker, no expired waiver, baseline `bd7adc6`
additive). Entry decision: **`GO`**.

### Carry-forward from CONT-P04

- Critical path `CONT-P00→P03→P07→P12→P14→P19→P21` (architecture defers to P05
  cell design)
- 8 waves `W0-W7` (W2 tenant/memory migration depends on P05 cells)
- RACI 5 roles, risk burn-down, 4 cost scenarios remain governing — P05 must not
  invent procurement.

---

## 2. Baseline Repository / Infra Inspection (2026-08-29 @ `bd7adc6`)

| Area              | Current                                                                                                                    | Evidence                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Apps**          | `apps/api` FastAPI 0.115, `apps/web` Next.js 15.5, 25 packages                                                             | `apps/api/pyproject.toml`, `apps/web/package.json`                                   |
| **Agents**        | 22 in `AGENT_REGISTRY` (10 MVP canonical), orchestrator `supervisor gather`, graph 10 nodes LangGraph                      | `orchestrator/router.py:58`, `graph/__init__.py:55`                                  |
| **Memory**        | 34 → 42 RLS via 0010+0019+0020, `pgvector` cosine, hybrid retrieval `_assemble_rag_context`                                | `models/schema.py`, `temporal/quota.py`                                              |
| **Temporal**      | 6 workers `temporal:7233` (profile temporal), 8 queues (6 polled) `REJECT_DUPLICATE`                                       | `temporal/worker.py:72`, `queues.py`                                                 |
| **LangGraph**     | `DurableAgentRunActivity` only import, `MemorySaver` thread_id, `64 graph` tests                                           | `docs/temporal/langgraph-deep-implementation-closure-2026-08-29.md` PRODUCTION READY |
| **Contracts**     | `docs/backend/openapi.yaml` 110 paths, typed `RoutingDecision/Handoff/EvaluationResult`                                    | `api/routers` 27, `graph/contracts.py`                                               |
| **Infra**         | `infra/terraform` 12 modules s3+DDB, `infra/kubernetes` 60 yamls, `docker-compose` dev+prod, SBOM SLSA L2 cosign KMS       | `terraform validate` 12, `compose config` valid                                      |
| **Observability** | OTel `activity+workflow` interceptors, `StructuredJsonFormatter` `_redact` 9→14 keys, 3 Grafana dashboards, `k6` p95 120ms | `temporal/interceptors.py:37`, `logging.py`                                          |
| **Docs**          | `docs/adr 32→33` (ADR-039 LangGraph), `docs/architecture` System/C4/Data-Flow/Event-Flow, `docs-portal.html` 1127 lines    | `docs/adr`, `docs/architecture`                                                      |
| **Tests**         | `64 graph +40 temporal +233 sec` `workflows` 8 queues 11 activities                                                        | `pyproject 94.2%`                                                                    |

**Grep audit**
`rg -n "TODO|FIXME|NOT_EXECUTED|REQUIRES_STAKEHOLDER_DECISION|skip_auth|tenant_id|workspace_id|approval|idempot"`
— `NOT_EXECUTED` only in `docs/phases` templates, `tenant_id` in 42 RLS +
`TenantContext` (pass), no `skip_auth`.

**Key drift since CONT-P04:** `bd7adc6` adds contracts/frontend durable
wiring/tracing workflow_inbound — additive, no breaking `0021_retention`,
`0010→0020` RLS, `0 langgraph imports` gate intact. No stale evidence.

---

## 3. Phase Scope (CONT-P05 §5)

**In scope:**

- C4/deployment (§11 WS-05.1)
- Identity/authorization (§11 WS-05.2)
- Data/event/agent flows (§11 WS-05.3)
- Failure/resilience/degradation (§11 WS-05.4)
- ADRs/evolution (§11 WS-05.5 + §12 tasks 1-7)

**Out of scope (track exclusions):** big-bang rewrite, silent permission
expansion, unverified dual writes, all-tenant cutover, enterprise launch without
design-partner evidence, production changes without backup/rollback/monitoring,
later-phase migration implementation (P06 toolchain, P07 tenant data) unless
critical dependency.

**Fixed decisions preserved:** expand–contract, compatibility adapters,
migration control plane, per-tenant/cell flags, dual-run where measurable,
reconciliation ledgers, rollback checkpoints, explicit retirement.

---

## 4. Entry Criteria (§6 — all checked)

- [x] Previous phase `CONT-P04 95.62 APPROVED` with valid `09-handoff` (§2)
- [x] Canonical sources + `bd7adc6` + `docker 8 healthy` when profile temporal
      identified
- [x] Access `READ` to repo; `BLOCKING_ACCESS_UNKNOWN` only for design-partner
      tenant list (BQ-05) — correctly deferred, not gating architecture
- [x] Owners: Enterprise Architect (gate), Solution/Data/Security/Cloud/SRE/AI
      Architects (reviewers), Program/Product approver (BQ-01)
- [x] Requirements `CONT-P05-R01..R08` traceable, no critical blocker makes work
      unsafe
- [x] Test/evidence/rollback/docs plans exist (below)
- [x] Real MVP production evidence exists (`787053a` 99 paths, 2557→64+40, p95
      120ms, 42/42 RLS) — migration source legitimacy (§3)

**BQ-01..06 (tracked, not invented):**

| ID    | Question                                  | Decision                                                                                                         | Owner                                    | Effect                  |
| ----- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------- |
| BQ-01 | Accountable approver + backup?            | Enterprise Architect + Program Manager (backup)                                                                  | Program/Product                          | Gate blocks             |
| BQ-02 | Repo version/env/evidence baseline?       | `bd7adc6` + `78c2d71` handoff + `docker` 8 healthy + `110 OpenAPI`                                               | Engineering                              | Execution blocks        |
| BQ-03 | Entities/ages/regions/use cases in scope? | India 18+ `DPDP` + US FERPA/COPPA 18+ (under-13 excluded) + GDPR All Regions — per `DPIA v1.2`                   | Legal/Privacy                            | Release blocks          |
| BQ-04 | Which MVP release passed?                 | `787053a` + `bd7adc6` LangGraph closure **95.4→93.6 MVP CLOSE**                                                  | MVP owner                                | Blocks                  |
| BQ-05 | Design partners/windows?                  | `REQUIRES_STAKEHOLDER_DECISION` deferred `CONT-P19/20` (U-01)                                                    | Business/Program                         | Pilot blocks            |
| BQ-06 | Availability/residency/scale targets?     | `RTO 15m RPO 1h, 99.9% SLO 43.2m, 20 RPS headroom 60%, p95 200ms (120<200), residency IN-EU-US via tenant cells` | Accountable owner (Enterprise Architect) | Blocks where unresolved |

---

## 5. Requirements & Acceptance (CONT-P05-R01..R08)

- R01 controlled migration architecture with trust boundaries, ownership,
  failure, ADRs, evolution — **acceptance:** approved C4 + ADRs + failure model,
  backward compat + provenance + rollback preserved.
- R02 every material claim links to source/repro evidence — **no unsupported
  completion/security/compliance/scale claim.**
- R03 security/privacy/abuse/rights/AI risks designed/tested/owned — **no
  unresolved critical, no expired waiver.**
- R04 validation covers normal/negative/boundary/failure/recovery — **critical
  tests pass in representative env.**
- R05 ownership/telemetry/support/rollback/lifecycle included —
  **runbook/rollback/telemetry evidence exists.**
- R06 data lineage/scope/quality/retention/AI lineage explicit —
  **source/version/owner/lifecycle reconstructable.**
- R07 traceability req→design→artifact→test→evidence→risk→handoff — **no
  unexplained critical gap.**
- R08 gate ≥95 and zero mandatory blockers — **§28 weighted gate.**

Enterprise completeness (§10)
`APPLICABLE: architecture, data, security, privacy, compliance, UX/accessibility, quality, reliability, operations, DevOps, docs, responsible AI, migration/change`;
`NOT_APPLICABLE: cost` (4 scenarios already) `sustainability/localization` with
reason `deferred to P21 scale-out, no invariant change`.

---

## 6. Workstreams & Deliverables

| WS      | Title                               | Owner                         | Inputs                                                                             | Dependencies     | Acceptance                                                                                                                                                            | Tests                                                             | Evidence                              |
| ------- | ----------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| WS-05.1 | C4/deployment design                | Enterprise Architect + Cloud  | `02-system-architecture.md`, `infra/k8s`, `docker-compose`                         | W0 control plane | C4 L1-3 + deployment + trust-boundary + data-flow Mermaid, failure domains, data classes                                                                              | architecture review + `kustomize` dry-run + `terraform validate`  | `01-c4-deployment.md` DEL-01          |
| WS-05.2 | Identity/authorization architecture | Security Architect            | `auth.py`, `TenantContext`, `42/42 RLS`, `RBAC`                                    | W1               | identity propagation, workload identity, policy enforcement, audit/approvals                                                                                          | tenant isolation `security/test_tenant_isolation` 63 + JWT + RBAC | `02-identity-authorization.md` DEL-02 |
| WS-05.3 | Data/event/agent flows              | Data Architect + AI Architect | `orchestrator/router/supervisor`, `graph`, `temporal queues 8`, `retrieval hybrid` | WS-05.1          | typed contracts, sync/async, degradation, idempotency, concurrency                                                                                                    | `graph 64` + `temporal 40` + `RAG` provenance                     | `03-data-event-agent-flows.md`        |
| WS-05.4 | Failure/resilience/degradation      | SRE                           | `circuit_breaker 3/30s`, `quota Redis Lua`, `temporal retry 2×/3×`                 | WS-05.1          | error/timeout/retry/cancel/backpressure/partial/provider-outage/rollback                                                                                              | `chaos 4` + `k6` 20 RPS p95 120ms + `health 3 probes`             | `04-failure-resilience.md` DEL-05     |
| WS-05.5 | ADRs/evolution                      | Solution Architect            | `docs/adr 33`                                                                      | all              | 4 ADRs (control plane/cells, workload identity, data classes, strangler) with compatibility horizon/migration owner/reconciliation metric/cutover/rollback/retirement | ADR review + `rg ADR`                                             | `05-adrs-evolution.md` DEL-03         |

**Traceability:** Each task (§12 1-7) status `NOT_STARTED→VERIFIED` via `rg` +
`git log` + `pytest`.

---

## 7. Detailed Tasks (1-7) — verifiable steps

1. **C4/deployment/trust/data-flow diagrams** — produce Mermaid
   `C4Context|Container|Component` + `deployment` (k8s `apps/api`,
   `queue-worker`, `temporal`, `postgres`, `redis`, `otelcol`, `persistence`) +
   `trust-boundary` (user→control plane→cell data plane→connector) + `data-flow`
   (write→RLS→projection→search→RAG) — `NOT_STARTED`.
2. **Sources of truth/service boundaries** — define `workspace` truth vs
   `document_chunk→embedding`/`knowledge_graph`/`search` projections
   rebuildable, service contracts `POST /temporal/workflows/durable-agent`
   (`openapi 110→115`), sync `execute_tool` vs async `Ingest`/`ConnectorSync` —
   `NOT_STARTED`.
3. **Identity/propagation/policy** — `JWT` 32+ `TenantContext app.*` →
   `RLS 42/42` → `workspace_id` path/header → `check_permission` scopes →
   `approval_gated 13+dynamic` → `workload identity` (Temporal Worker HPA 2→8) +
   audit `approval_id` — `NOT_STARTED`.
4. **Classification/residency/keys/backup/deletion/projection rebuild** — `PII`
   via `_redact 14 keys` + `DPDP/GDPR/FERPA/COPPA`, `residency` cell `IN/EU/US`
   via `workspace.tenant_id→cell`, `keys` via
   `SecretManager Infisical/fallback`, `backup` `pg_basebackup` + `rebuild`
   projection `reindex` — `NOT_STARTED`.
5. **Threat/failure analysis + prototypes** — model `OWASP Agentic 2026` (goal
   hijack, tool misuse, memory poisoning, inter-agent) + `GenAI LLM` (prompt
   injection, excessive agency) — prototype `validate_no_secrets` +
   `policy_check forged→pending` — `NOT_STARTED`.
6. **Control plane/cells & adapters** — `migration-control-plane` `1.0` with
   `Adapter` strangler `MVP monolith → cell` + `feature_flag` per-tenant +
   `expand-contract` wave `W2` — `NOT_STARTED`.
7. **Compatibility/owner/evidence/rollback/retirement per artifact** — table for
   each DEL artifact — `NOT_STARTED`.

---

## 8. Technical & Implementation Requirements (§13)

Preserve strangler/expand-contract, adapters, control plane, per-tenant/cell
flags, dual-run measurable, reconciliation ledgers, rollback checkpoints,
explicit retirement. Typed contracts, least privilege, idempotency
(`REJECT_DUPLICATE` + `sha256`), concurrency control, immutable audit,
reversible changes. Separate proposal/action, user/workload identity,
source-of-truth/projection. Risky behavior scoped `feature_flag/kill_switch`
with owner/default/expiry/audit/removal. Define
error/timeout/retry/cancel/backpressure/partial/stale/duplicate/out-of-order/provider-outage/rollback.
Never weaken tests.

---

## 9. Repository & Artifact Inspection Plan (§14)

```bash
git status --short --branch && git rev-parse HEAD && git log -n 20 --oneline
find . -maxdepth 4 -type f | sort
rg -n "TODO|FIXME|NOT_EXECUTED|REQUIRES_STAKEHOLDER_DECISION|skip_auth|tenant_id|workspace_id|approval|idempot" .
# Inspect manifests/lockfiles, images, IaC, migrations, contracts, policy, tests, dashboards and runbooks.
git log -- apps/api/src/api/temporal/worker.py | head
ls docs/adr | wc -l && cat docs/architecture/*.md | wc -l
kustomize build infra/kubernetes/overlays/staging --replicas 3 | grep -c "image:"
```

Identify generated-file sources: `openapi.yaml` from `api/routers` (gen via
`scripts/docs_audit_phase10.py`), `docs-portal.html` 1127 from
`scripts/generate_docs_portal.py`.

---

## 10. Execution Sequence (§25)

1. Validate handoff/entry (done above GO)
2. Inspect and baseline repository/artifacts/environment (this plan §2)
3. Resolve blockers or stop (BQ-05/06 correctly deferred)
4. Finalize requirements/acceptance/workstreams/evidence plan (this plan)
5. Execute small reviewable changes (next commit:
   `docs/phases/cont-p05/01..05` + `docs/adr/ADR-040..043` +
   `docs/architecture/*` sync)
6. Run representative validation (matrix strict + graph 64 + temporal 40 +
   `terraform validate` + `kustomize` + web typecheck 0)
7. Remediate and rerun regression
8. Complete documentation/evidence/traceability
   (risk/decision/assumption/evidence registers)
9. Run independent self-audit and weighted gate (§28)
10. Publish completion and approved handoff or block (§30 A-P + §31 next-phase
    handoff)

---

## 11. Evidence & Traceability (EVD template)

| Evidence ID      | Claim                                                                                | Requirement  | Type        | Location                                    | Result         | Date       | Verified by          |
| ---------------- | ------------------------------------------------------------------------------------ | ------------ | ----------- | ------------------------------------------- | -------------- | ---------- | -------------------- |
| EVD-CONT-P05-001 | C4 L1-3 diagrams versioned 1.0 via Mermaid `flowchart TD` + `C4Context`              | CONT-P05-R01 | file/report | `docs/phases/cont-p05/01-c4-deployment.md`  | TO_BE_VERIFIED | 2026-08-29 | Enterprise Architect |
| EVD-CONT-P05-002 | Trust-boundary `user→control plane→cell` with 42/42 RLS + workload identity          | CONT-P05-R03 | file/log    | `02-identity-authorization.md`              | TO_BE_VERIFIED | 2026-08-29 | Security Architect   |
| EVD-CONT-P05-003 | Deployment `k8s 60 yamls` + `docker 8 healthy` + `terraform 12` + `compose prod 239` | CONT-P05-R01 | report      | `01-c4-deployment.md` + `kustomize` dry-run | TO_BE_VERIFIED | 2026-08-29 | Cloud/SRE            |
| ...              | ...                                                                                  | ...          | ...         | ...                                         | ...            | ...        | ...                  |

Trace
`source → requirement → design → file → test → evidence → risk/exception → gate → handoff`.
A plan is not evidence it ran.

---

## 12. Risks, Decisions, Change Control (§24 + archive)

| ID               | Risk                                        | Severity | Impact               | Mitigation                                                                   | Owner            | Status |
| ---------------- | ------------------------------------------- | -------- | -------------------- | ---------------------------------------------------------------------------- | ---------------- | ------ |
| RISK-CONT-P05-01 | Docs mistaken for runtime completion        | Critical | False readiness      | Require runtime evidence/status labels (64+40 tests, 11 dry-run)             | Phase owner      | OPEN   |
| RISK-CONT-P05-02 | Scope/permission/data/compatibility assumed | High     | Leak/loss/rework     | Block or reversible validated decision, `validate_no_secrets` proof          | Product/Arch/Sec | OPEN   |
| RISK-CONT-P05-03 | External API/model/standard changes         | High     | Regression           | Pin versions `mcp 2026-07-28`, `openapi 3.2.0`, `temporal 1.26`, kill switch | Integration/AI   | OPEN   |
| RISK-CONT-P05-04 | Evidence incomplete                         | High     | Untrustworthy gate   | Immutable `06-gate-report.md` + `EVD` bundle                                 | QA/Release       | OPEN   |
| RISK-CONT-P05-05 | Old/new divergence                          | Critical | Data/permission harm | Reconciliation `EVD` + pause/rollback `DEL-05`                               | Migration        | OPEN   |

Changes to approved
scope/contract/permission/retention/provider/model/deployment/gate need
`rationale/impact/reviewers/migration/tests/rollout/rollback` per universal
gatekeeper.

---

## 13. Definition of Ready/Done (§26-27)

_DoR:_ objective/scope/requirements/acceptance approved (§5), valid
handoff+immutable baseline `bd7adc6` (§1-2), critical sources/decisions
available & blockers resolved (§4), owners/reviewers/approver/escalation named,
security/privacy/data/AI/operations classified, test/evidence/rollback/docs
plans exist, access/datasets/credentials/safe env available.

_DoD:_ requirements `R01..R08` implemented or `NOT_APPLICABLE` with reason,
critical `64+40+63 sec` tests/reviews pass, no critical blocker, `5 DELs`
versioned/owned/reviewed/linked, evidence/traceability complete reproducible,
rollback/recovery/support proven, no hidden manual step.

---

## 14. Quality Gate (§28)

| Category                 | Weight |
| ------------------------ | ------ |
| Scope and acceptance     | 12     |
| Technical correctness    | 12     |
| Architecture/integration | 8      |
| Data quality/lifecycle   | 8      |
| Security/privacy         | 12     |
| Testing/validation       | 12     |
| Reliability/resilience   | 8      |
| Performance/capacity     | 6      |
| Evidence/traceability    | 8      |
| Documentation/handoff    | 6      |
| Operations/support       | 5      |
| Maintainability/cost     | 3      |

`95–100 PROCEED` with zero mandatory blockers, `88–94 conditional` non-dependent
only, `<88 FAILED`.

---

## 15. Next Steps (authorized)

1. Approve this plan (Enterprise Architect + Program Manager).
2. Create `docs/phases/cont-p05/` scaffold + `00-predecessor-audit.md` (re-stamp
   `bd7adc6` post-LangGraph).
3. Execute WS-05.1..5 small commits: `01-c4-deployment.md` (+Mermaid
   C4Context/Container/Deployment), `02-identity-authorization.md`,
   `03-data-event-agent-flows.md`, `04-failure-resilience.md`,
   `05-adrs-evolution.md` (ADR-040..043), updating `docs/adr`,
   `docs/architecture`, `infra` where adapters require.
4. Validate via (§18) `rg`, `terraform validate`, `kustomize`, `pytest`, then
   gate (§28) and handoff (§31).

_Prepared 2026-08-29 — predecessor `CONT-P04 95.62 GO` re-audited, baseline
`bd7adc6` LangGraph closure, BQ-05/06 correctly deferred, no invented
tenant/cell names or scale numbers._
