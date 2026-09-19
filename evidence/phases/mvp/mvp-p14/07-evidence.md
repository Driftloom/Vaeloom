# MVP-P14 — 07. Evidence Register

> **Phase:** MVP-P14 — Testing and Quality Engineering 
> **Date:** 2026-08-22 · **Baseline:** `a69d7d7` + P14 (GDPR 31, JWT 32+, 2555, DPIA DRAFT)

| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
|---|---|---|---|---|---|---|---|
| EVD-P14-001 | Collect 2555 (was stale 2527 F-01) | R02,R04 | test collect | `pytest --collect-only -q -o addopts=""` 12.91s/30.85s | 2555 | 2026-08-22 | QA |
| EVD-P14-002 | Security 233 (170 unique F-02) | R04 | test collect | `pytest tests/security --collect-only -q` 2.80s | 233 (170 unique) | 2026-08-22 | QA |
| EVD-P14-003 | JWT 27→32+ warning gone | R03,R04 | test | `conftest.py:9` 32-chars-long!! + 2 quick runs 0 warnings (was 21) | PASS | 2026-08-22 | QA |
| EVD-P14-004 | GDPR 31 ALLOWED (was 12 F-09) | R02,R06 | code + test | `services/gdpr.py:15` 31 tables, `python -c` 31, `test_export_user_data_empty` PASSED 12.07s | PASS | 2026-08-22 | QA |
| EVD-P14-005 | GDPR delete anonymizes 31 tables | R02,R06 | test | `test_delete_user_data_anonymizes` PASSED 13.88s | PASS | 2026-08-22 | QA |
| EVD-P14-006 | RLS 37/42 fail-closed (was stale 4/36, OR'' fail-open F-04/05) | R03,R06 | mig | `0010` 34 + `0019` 3 =37, `0019:51` FIX fail-closed (no `OR ''`), `schema.py` 42 tables | VERIFIED | 2026-08-22 | IAM |
| EVD-P14-007 | DPIA DRAFT region TBD (was COMPLETE F-10) | R03 | doc | `docs/security/DPIA.md:5` 1.1 DRAFT pending DPO | VERIFIED | 2026-08-22 | Privacy |
| EVD-P14-008 | CSRF single-process gap noted (F-06) | R03 | code | `middleware/csrf.py:49` dict + `main.py:232` TODO Redis | EXC-P13-07 | 2026-08-22 | Sec |
| EVD-P14-009 | Ingestion PDF/DOCX bypass honest (F-08) | R03,R04 | code+test | `prompt_injection.py:_get_body` JSON/form only, `document_chunks` not scanned, EXC-P13-05 sharpened | VERIFIED gap | 2026-08-22 | AI Safety |
| EVD-P14-010 | Sanitize NOT verified (F-11) | R03 | code | `0019` docstring corrected, `executor.py` grep 0 sanitizes | EXC-P13-04 | 2026-08-22 | AppSec |
| EVD-P14-011 | Threat-Model BYOK assets (F-17) | R03 | doc | `docs/security/Threat-Model.md:20` +Document chunks +BYOK provider_keys | VERIFIED | 2026-08-22 | Sec |
| EVD-P14-012 | IP allowlist always-mounted (F-18) | R03 | code | `AGENTS.md:86`, `main.py:188` no-op | VERIFIED | 2026-08-22 | Sec |
| EVD-P14-013 | Predecessor honest 84.4/89 waiver | R07,R08 | doc | `09-gate-report.md:26,30` dual, `10-handoff-to-p14.md` honest, `EXECUTION-STATUS.md:34` ⚠️ CONDITIONAL | VERIFIED | 2026-08-22 | QA |
| EVD-P14-014 | Collect determinism | R04 | test | `test_noauth_private.py:90` sorted PUBLIC_PATHS, `debug_test.py` removed | VERIFIED | 2026-08-22 | QA |
| EVD-P14-015 | Requirements R01..R08 traced | R07 | doc | This table + `01-source-register.md` 13 INT+19 EXT + `03-workstreams.md` WS-14.1..5 | VERIFIED | 2026-08-22 | QA |

## Traceability

| Requirement | Design | Code/Doc | Tests | Evidence | Risk |
|---|---|---|---|---|---|
| R01 Scope (risk-based layers) | WS-14.1..5 | `01-source-register`, `03-workstreams` | Collect 2555, gdpr 31 | EVD-P14-001..015 | RISK-P14-01 |
| R02 Evidence (every claim source+repro) | This register | 13 INT+19 EXT + file:line | 2 quick gdpr PASS | EVD-P14-001..015 | RISK-P14-04 |
| R03 Security/Privacy | WS-14.3 | 7 EXCs, JWT 32+, RLS 37/42 fail-closed, GDPR 31, DPIA DRAFT | 233 sec, 2 gdpr | EVD-P14-003..010 | RISK-P14-02 |
| R04 Quality (normal/negative/boundary/failure/recovery) | WS-14.2/14.4 | Negative auth/isolation/injection/deletion | 233 + 2 gdpr | EVD-P14-002..005 | RISK-P14-04 |
| R05 Operations | `04-code-config` | `0019 downgrade`, daemon lifespan | Collect green | EVD-P14-006 | — |
| R06 Data/AI | WS-14.2 | `0018` memory_versions + `document_chunks` | gdpr 31 | EVD-P14-004..006 | — |
| R07 Traceability | This table | — | — | This doc | — |
| R08 Gate ≥95/88 | `09-gate-report` | — | — | EVD-P14-013 | — |

## Verification commands (repro)

```bash
uv run --project apps/api python -m pytest --collect-only -q -o "addopts="   # 2555
uv run --project apps/api python -m pytest tests/security --collect-only -q -o "addopts="  # 233
uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"  # 31
uv run --project apps/api python -m pytest apps/api/tests/test_gdpr.py::TestGDPRService::test_export_user_data_empty -v -o "addopts="  # PASSED
uv run --project apps/api python -m pytest apps/api/tests/test_gdpr.py::TestGDPRService::test_delete_user_data_anonymizes -v -o "addopts="  # PASSED
```
