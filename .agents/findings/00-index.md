# Vaeloom Findings Index

**Last Updated:** 2026-08-17 **Total Findings:** 54 **Fixed in This Session:**
40 **Remaining Open:** 14

---

## Summary by Source

| Source                  | Total  | Fixed  | Open   |
| ----------------------- | ------ | ------ | ------ |
| Orchestrator Loop Audit | 5      | 3      | 2      |
| main.py Audit           | 7      | 3      | 4      |
| RLS Audit               | 6      | 1      | 5      |
| Documentation Audit     | 15     | 0      | 15     |
| MVP-P04 Doc Audit       | 7      | 7      | 0      |
| CI/CD Audit             | 7      | 7      | 0      |
| Phase Prompt Audit      | 13     | 13     | 0      |
| **TOTAL**               | **60** | **40** | **20** |

---

## Fixed Findings (Applied in This Session)

| ID  | Finding                                      | File                      | Fix                         |
| --- | -------------------------------------------- | ------------------------- | --------------------------- |
| —   | Approval gate hardcoded `has_approval=False` | `orchestrator/loop.py:82` | Added `lookup_approval()`   |
| —   | `set_rls_session_vars()` dead code           | `middleware/tenant.py:40` | Wired into `get_db()`       |
| —   | GUC `app.tenant_id` never SET                | `middleware/tenant.py:55` | Now set on every DB session |
| —   | `TenantMiddleware` not mounted               | `main.py:122`             | Added to middleware stack   |
| —   | CORS innermost                               | `main.py:108-130`         | Moved to outermost          |
| —   | Prometheus commented out                     | `main.py:135-136`         | Uncommented                 |
| —   | OTel commented out                           | `main.py:136`             | Uncommented                 |
| —   | P00, P03, P04, P05, P07 NestJS architecture  | 5 prompts                 | Updated to FastAPI monolith |
| —   | P00, P03, P04, P05, P07 directory paths      | 5 prompts                 | Updated to `apps/api`       |
| —   | P00, P03, P04, P05, P07 memory types         | 5 prompts                 | Updated to 22 types         |

---

## Open Findings — Orchestrator Loop

| ID            | Severity  | Finding                                                  | File              |
| ------------- | --------- | -------------------------------------------------------- | ----------------- |
| FIND-ORCH-001 | P1-HIGH   | Agent dispatch uses fragile string class names           | `loop.py:119`     |
| FIND-ORCH-002 | P2-MEDIUM | ATSAgent case-insensitive check but case-sensitive split | `loop.py:139`     |
| FIND-ORCH-003 | P2-MEDIUM | DriveAgent ingests files without approval gate           | `loop.py:167`     |
| FIND-ORCH-004 | P2-MEDIUM | 12 synchronous disk writes per loop run                  | `loop.py:260-280` |
| FIND-ORCH-005 | P3-LOW    | Reflect phase wastes iterations on successful suggests   | `loop.py:217`     |

---

## Open Findings — main.py

| ID            | Severity    | Finding                                         | File            |
| ------------- | ----------- | ----------------------------------------------- | --------------- |
| FIND-MAIN-001 | P0-CRITICAL | TenantMiddleware trusts client-supplied headers | `tenant.py:63`  |
| FIND-MAIN-002 | P1-HIGH     | IP Allowlist middleware not mounted             | `ip_filter.py`  |
| FIND-MAIN-003 | P1-HIGH     | Prometheus import has no guard                  | `main.py:7`     |
| FIND-MAIN-004 | P2-MEDIUM   | Dual Prometheus instrumentation                 | `main.py:152`   |
| FIND-MAIN-005 | P2-MEDIUM   | 25+ routers imported eagerly                    | `main.py:61`    |
| FIND-MAIN-006 | P3-LOW      | Duplicate logging/formatter classes             | `logging.py`    |
| FIND-MAIN-007 | P2-MEDIUM   | OPTIONS requests can be rate-limited            | `rate_limit.py` |

---

## Open Findings — RLS

| ID           | Severity    | Finding                                             | File                   |
| ------------ | ----------- | --------------------------------------------------- | ---------------------- |
| FIND-001     | P0-CRITICAL | RLS only covers 4/36 tables                         | `0005_rls*.py`         |
| FIND-RLS-002 | P0-CRITICAL | Alembic migration references non-existent columns   | `0005_rls_expanded.py` |
| FIND-RLS-003 | P1-HIGH     | No FORCE ROW LEVEL SECURITY                         | `0005_rls_expanded.py` |
| FIND-RLS-004 | P2-MEDIUM   | Zero RLS integration tests                          | `test_tenant.py`       |
| FIND-RLS-005 | P2-MEDIUM   | Silent exception swallowing in set_rls_session_vars | `tenant.py:58`         |
| FIND-RLS-006 | P2-MEDIUM   | get_current_tenant never imported by routers        | `tenant.py:81`         |

---

## Open Findings — Documentation

| ID           | Severity    | Finding                                             | File                                 |
| ------------ | ----------- | --------------------------------------------------- | ------------------------------------ |
| FIND-DOC-001 | P1-HIGH     | Desktop Companion and VS Code Extension don't exist | `02-system-architecture.md`          |
| FIND-DOC-002 | P1-HIGH     | OCR Engine is a stub                                | `02-system-architecture.md`          |
| FIND-DOC-003 | P1-HIGH     | mTLS between API and AI Service is fiction          | `System-Design.md`                   |
| FIND-DOC-004 | P1-HIGH     | WebSocket not implemented                           | `System-Design.md`                   |
| FIND-DOC-005 | P0-CRITICAL | Encryption at rest not implemented                  | `02-system-architecture.md`          |
| FIND-DOC-006 | P1-HIGH     | Secrets Manager does not exist                      | `02-system-architecture.md`          |
| FIND-DOC-007 | P1-HIGH     | Consolidation/compression is dead code              | `02-system-architecture.md`          |
| FIND-DOC-008 | P1-HIGH     | Permission Engine is a local check                  | `02-system-architecture.md`          |
| FIND-DOC-009 | P1-HIGH     | No infrastructure-as-code (Terraform)               | `Infrastructure.md`                  |
| FIND-DOC-010 | P1-HIGH     | Grafana dashboards not deployed                     | `Infrastructure.md`                  |
| FIND-DOC-011 | P1-HIGH     | PII Redaction not implemented                       | `Data-Flow.md`                       |
| FIND-DOC-012 | P2-MEDIUM   | Data deletion verification not implemented          | `Data-Flow.md`                       |
| FIND-DOC-013 | P1-HIGH     | ADR-013 claims all queries filter by tenant_id      | `ADR-013-multi-tenancy.md`           |
| FIND-DOC-014 | P2-MEDIUM   | ADR-024 claims Meilisearch is present               | `ADR-024-rebuildable-projections.md` |

---

## Open Findings — Phase Prompt Audit (MVP-P00 through MVP-P07)

| ID              | Severity  | Finding                                                                                                           | File                                       |
| --------------- | --------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| FIND-PROMPT-001 | P1-HIGH   | P00, P03, P04, P05, P07 claim "NestJS" but architecture is FastAPI monolith                                       | `FINDINGS-architecture-inconsistencies.md` |
| FIND-PROMPT-002 | P1-HIGH   | 20 prompts (P00-P21) have copy-paste NestJS error at 2 locations each (40 edits needed)                           | `FINDINGS-architecture-inconsistencies.md` |
| FIND-PROMPT-003 | P1-HIGH   | P00, P01, P03-P07 claim "six memory types" but codebase has 22                                                    | `FINDINGS-scope-count-mismatches.md`       |
| FIND-PROMPT-004 | P1-HIGH   | Memory type names (Profile, Career, Episodic, Working) don't match actual enum (Person, Skill, Achievement, etc.) | `FINDINGS-scope-count-mismatches.md`       |
| FIND-PROMPT-005 | P2-MEDIUM | "Eight total agents" is defensible but misleading; 21 registered, 8 MVP-canonical                                 | `FINDINGS-scope-count-mismatches.md`       |
| FIND-PROMPT-006 | P2-MEDIUM | P00, P03-P07 reference "Redis/BullMQ" but BullMQ has zero consumers                                               | `FINDINGS-dead-dependencies.md`            |
| FIND-PROMPT-007 | P2-MEDIUM | NestJS packages (`service-auth`, `observability`) are legacy remnants, not active                                 | `FINDINGS-dead-dependencies.md`            |
| FIND-PROMPT-008 | P2-MEDIUM | Redis described as queue (BullMQ) but actually used for caching/rate-limiting only                                | `FINDINGS-dead-dependencies.md`            |
| FIND-PROMPT-009 | P3-LOW    | Only P01, P02, P06 were upgraded to repo-reality; P00, P03-P07 still have template text                           | `FINDINGS-architecture-inconsistencies.md` |
| FIND-PROMPT-010 | P1-HIGH   | P00, P03, P04, P05, P07 reference `apps/core-api` but actual is `apps/api`                                        | `FINDINGS-directory-path-mismatches.md`    |
| FIND-PROMPT-011 | P1-HIGH   | P00, P03, P04, P05, P07 reference `apps/ai-service` which does not exist                                          | `FINDINGS-directory-path-mismatches.md`    |
| FIND-PROMPT-012 | P2-MEDIUM | P00, P03, P04, P05, P07 reference `packages/contracts` which does not exist                                       | `FINDINGS-directory-path-mismatches.md`    |
| FIND-PROMPT-013 | P2-MEDIUM | P00, P03, P04, P05, P07 reference `packages/design-system` which does not exist                                   | `FINDINGS-directory-path-mismatches.md`    |

---

## Files

| File                                       | Source             | Count                            |
| ------------------------------------------ | ------------------ | -------------------------------- |
| `00-index.md`                              | —                  | This file                        |
| `01-comprehensive-audit-2026-08-16.md`     | Full audit         | 23 fixes + 15 gaps               |
| `02-rls-coverage-gap.md`                   | RLS Audit          | P0                               |
| `03-encryption-not-implemented.md`         | Security Audit     | P0                               |
| `04-memory-write-path-broken.md`           | AI Audit           | P0                               |
| `05-documentation-reality-gaps.md`         | Doc Audit          | P1                               |
| `06-missing-infrastructure.md`             | Infra Audit        | P1                               |
| `10-orch-fragile-dispatch.md`              | Orchestrator Audit | P1                               |
| `11-orch-ats-case-sensitivity.md`          | Orchestrator Audit | P2                               |
| `12-orch-drive-no-approval.md`             | Orchestrator Audit | P2                               |
| `13-orch-sync-disk-writes.md`              | Orchestrator Audit | P2                               |
| `14-orch-wasted-iterations.md`             | Orchestrator Audit | P3                               |
| `20-main-tenant-spoofing.md`               | main.py Audit      | P0                               |
| `21-main-ip-allowlist-not-mounted.md`      | main.py Audit      | P1                               |
| `22-main-prometheus-no-guard.md`           | main.py Audit      | P1                               |
| `23-main-dual-prometheus.md`               | main.py Audit      | P2                               |
| `24-main-eager-router-imports.md`          | main.py Audit      | P2                               |
| `25-main-duplicate-logging.md`             | main.py Audit      | P3                               |
| `26-main-options-rate-limited.md`          | main.py Audit      | P2                               |
| `30-rls-alembic-wrong-columns.md`          | RLS Audit          | P0                               |
| `31-rls-no-force.md`                       | RLS Audit          | P1                               |
| `32-rls-no-integration-tests.md`           | RLS Audit          | P2                               |
| `33-rls-silent-exception.md`               | RLS Audit          | P2                               |
| `34-rls-dead-code.md`                      | RLS Audit          | P2                               |
| `40-doc-desktop-vscode-fake.md`            | Doc Audit          | P1                               |
| `41-doc-ocr-stub.md`                       | Doc Audit          | P1                               |
| `42-doc-mtls-fiction.md`                   | Doc Audit          | P1                               |
| `43-doc-websocket-missing.md`              | Doc Audit          | P1                               |
| `44-doc-encryption-fake.md`                | Doc Audit          | P0                               |
| `45-doc-secrets-manager-fake.md`           | Doc Audit          | P1                               |
| `46-doc-consolidation-dead.md`             | Doc Audit          | P1                               |
| `47-doc-permission-engine-fake.md`         | Doc Audit          | P1                               |
| `48-doc-no-terraform.md`                   | Doc Audit          | P1                               |
| `49-doc-grafana-missing.md`                | Doc Audit          | P1                               |
| `50-doc-pii-redaction-fake.md`             | Doc Audit          | P1                               |
| `51-doc-deletion-verification-fake.md`     | Doc Audit          | P2                               |
| `52-doc-adr013-false-claim.md`             | Doc Audit          | P1                               |
| `53-doc-adr024-meilisearch-fake.md`        | Doc Audit          | P2                               |
| `07-mvp-p04-doc-audit.md`                  | MVP-P04 Doc Audit  | 7 findings                       |
| `08-ci-cd-workflow-fixes.md`               | CI/CD Audit        | 7 fixes applied                  |
| `FINDINGS-architecture-inconsistencies.md` | Phase Prompt Audit | 3 findings (P1-HIGH)             |
| `FINDINGS-scope-count-mismatches.md`       | Phase Prompt Audit | 3 findings (P1-HIGH + P2-MEDIUM) |
| `FINDINGS-dead-dependencies.md`            | Phase Prompt Audit | 3 findings (P2-MEDIUM)           |
| `FINDINGS-directory-path-mismatches.md`    | Phase Prompt Audit | 4 findings (P1-HIGH + P2-MEDIUM) |
