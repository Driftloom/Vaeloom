# MVP-P13 → MVP-P14 Handoff

> **From:** MVP-P13 — Security, Privacy, and Compliance  
> **To:** MVP-P14 — Testing and Quality Engineering  
> **Date:** 2026-08-22  
> **Status:** COMPLETE  
> **Gate:** 89/100 — PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY  
> **Baseline:** `0feb7ff` (HEAD) + P13 hardening (41 M + 0018 + daemon)

---

## 1. Approved Scope, Requirements, Decisions

### What P13 delivered

- **5 workstreams:** WS-13.1 Threat/abuse modeling, WS-13.2
  IAM/isolation/secrets, WS-13.3 Privacy/consent/rights, WS-13.4 AI/regulatory
  governance, WS-13.5 Security testing/incidents — all VERIFIED
  (`03-workstreams.md`)
- **5 deliverables:** DEL-01 threat models (`Threat-Model.md`,
  `Security-Architecture.md`, `OWASP.md`), DEL-02 DPIA v1.0 + AI-Governance
  v1.0 + privacy docs, DEL-03 controls/rights (`consent.py`, `gdpr.py`,
  `approval.py`, `middleware/*`), DEL-04 compliance map (`Compliance.md`,
  `SOC2.md`), DEL-05 independent test decision (`05-test-results.md` + bandit +
  pip-audit) — all VERIFIED (`07-evidence.md`)
- **8 requirements:** MVP-P13-R01..R08 traced in `07-evidence.md` matrix — all
  satisfied, gate 89/100 ≥88
- **Decisions:** 10 ADRs carried + 10 new DEC-P13-01..10 in `08-registers.md`
  (conditional IP allowlist, Tenant inner than Auth, RLS 4/36, 14-pattern regex,
  3 scopes, 12 tables, B608 FP, 0018 fix, enterprise gated)

### Scope that remains out-of-scope (must stay disabled)

Enterprise SSO/SCIM (except SCIM router mounted for completeness but gated),
institution admin, billing, marketplace, multi-region cells, cross-user memory,
unsupported job-platform automation — all gated via
`enterprise_routes_enabled=false` (`main.py:258`, `AGENTS.md` ADRs).

### Phase-specific rule proven

Threat-model injection, memory poisoning, connector tokens, replay, isolation,
deletion — all modeled + tested (see `06-security-privacy.md` threat-specific
table).

---

## 2. Commit, Release, Environment

- **Commit:** `0feb7ff` on `master` —
  `fix: mount SCIM router, fix settings permissions, clean ruff lint, fix frontend warnings`
- **Working tree:** 41 M + 12 ?? (all additive) — includes
  `0018_graph_memory_end_to_end.py` (memory_versions + document_chunks),
  `background_daemon.py`, `supervisor.py`,
  `test_csrf.py`/`test_prompt_injection.py`/`test_tenant_isolation.py`/`test_privacy_flows.py`,
  `DPIA.md`, `AI-Governance.md`, frontend pages
- **Environment:** SQLite per-test via `tmp_path` + `NullPool`, Python 3.12.13
  (`.python-version`), `uv` + `pytest-xdist -n 4`, `mock_llm` +
  `mock_connector_test` autouse, `JWT_SECRET` + `ENCRYPTION_KEY` +
  `DATABASE__URL` via env (not `.env` auto-read), `OTEL_SDK_DISABLED=true`
  locally
- **Verification baseline:** `01-source-register.md` 13 INT + 19 EXT pinned;
  external standards re-verified 2026-08-22 (MCP 2026-07-28, OWASP 2026
  ASI01–10, NIST RMF, RFC 9700, OpenAPI 3.2.0 88 paths live)

---

## 3. Deliverables & Evidence

### Deliverables P14 Receives

| ID             | Artifact                                                      | Version/Owner/Review                              | Location                                                                                                                       |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| DEL-MVP-P13-01 | Threat models                                                 | Security Team · 2026-07-12/2026-08-22 · REVIEWED  | `docs/security/Threat-Model.md`, `Security-Architecture.md`, `OWASP.md` + `docs/phases/mvp-p13/03-workstreams.md` WS-13.1      |
| DEL-MVP-P13-02 | Privacy/AI impact assessments                                 | Privacy Engineer / AI Safety Lead · v1.0 REVIEWED | `docs/security/DPIA.md`, `AI-Governance.md`, `Privacy.md`, `GDPR.md`                                                           |
| DEL-MVP-P13-03 | Controls/rights workflows                                     | IAM Engineer / Privacy Engineer                   | `services/consent.py`, `gdpr.py`, `approval.py`, `middleware/tenant.py`, `auth.py`, `csrf.py`, `ip_filter.py`, `encryption.py` |
| DEL-MVP-P13-04 | Compliance map                                                | Compliance Specialist                             | `docs/security/Compliance.md`, `SOC2.md`, `Data-Retention-Policy.md`                                                           |
| DEL-MVP-P13-05 | Independent test decision                                     | AppSec Engineer                                   | `docs/phases/mvp-p13/05-test-results.md` (233/233 + bandit + pip-audit)                                                        |
| Evidence       | 20 EVD rows, traceability matrix                              | Phase owner                                       | `docs/phases/mvp-p13/07-evidence.md`                                                                                           |
| Registers      | 9 risks, 10 decisions, 6 assumptions, 6 exceptions, 6 changes | Phase owner                                       | `08-registers.md`                                                                                                              |
| Gate report    | 89/100 CONDITIONAL, 0 mandatory blockers                      | Security Architect                                | `09-gate-report.md`                                                                                                            |
| Phases docs    | 10 files `01`–`10`                                            | Phase owner                                       | `docs/phases/mvp-p13/`                                                                                                         |

### Evidence summary for P14

- 233 security tests (172 pre + 61 new) — `test_csrf.py:15`,
  `test_prompt_injection.py:29`, `test_tenant_isolation.py:6`,
  `test_privacy_flows.py:11`
- Bandit SAST 0 HIGH / 38 MEDIUM B608 (false positives)
- pip-audit 2 pkgs (pytest UNIX, starlette PYSEC-2026-161/248/249 → must-fix
  ≥1.3.1)
- Full suite 2459 pass / 4 skipped / 2 xfailed / 0 failed (2527 collected)

---

## 4. Contracts, Schemas, Config

- **OpenAPI:** `docs/backend/openapi.yaml` — 88 paths,
  `tests/test_openapi_spec.py:4` live match. P14 must keep pinned.
- **Schemas:** `schemas/provider_key.py`, `memory.py`, `approval.py` — Pydantic;
  frontend `api.ts`/`api-client.ts` `transformKeys()` snake→camel.
- **Alembic:** `0009`–`0018` linear, `0018` adds `memory_versions` +
  `document_chunks` (SQLite fallback via `create_all`). `downgrade` tested.
- **Config:** `config.py:validate_settings()` fails fast on weak `jwt_secret`;
  `DATABASE__URL` double-underscore; `mvp_scope_enforced=true`;
  `enterprise_routes_enabled=false`; `prompt_injection_check` env-toggle;
  `ip_allowlist=""` → middleware not mounted (conditional).

---

## 5. Test / Security / Privacy / Performance / Operations Results

- **Security (P13 focus):** 233/233 pass, isolation proven, injection blocked
  with `X-Injection-Detected: true` 400, CSRF 403 without token, GDPR
  export/delete pass.
- **Privacy:** consent scopes 3, DPIA v1.0, AI-Gov v1.0, Data-Retention 90 days
  operational, residency per `Compliance.md`.
- **Performance:** not re-benchmarked this phase; P12 had no benchmarks either —
  P15 to measure p50/p95/p99 with `pytest --cov` + load.
- **Operations:** audit immutable + correlation IDs + MetricsMiddleware +
  `background_daemon.py` (schedules 60s, Gmail 06:00 UTC, calendar 08:00, jobs
  02:00) — `main.py:lifespan` starts/stops daemon, SRE owned.

---

## 6. Open Risks / Exceptions / Blockers

**Zero mandatory blockers.** 6 conditional exceptions
(owner/controls/expiry/monitoring/prohibited work) in `08-registers.md`:

1. EXC-P13-01 RLS 4/36 — P15 trigger
2. EXC-P13-02 IP allowlist conditional — prod decision
3. EXC-P13-03 starlette CVE ≥1.3.1 — **P14 must-fix before prod**
4. EXC-P13-04 input sanitization ADR-031 partial — P14 wiring
5. EXC-P13-05 regex-only detection (no LLM classifier) — P14
6. EXC-P13-06 under-13 policy-only — launch region decision BQ-04 contingent

**Assumptions:** 6 active (ASM-P13-01..06) — SQLite mirror, test HMAC 27-byte,
mock LLM, processor DPA, upgrade compat, under-13.

**Risks:** 9 active (RISK-01..05 + 06–09, carried 09/10) — all non-critical per
§24.

---

## 7. Assumptions (carried)

- SQLite test mirror adequate (validate on PG staging P14)
- 27-byte HMAC warning is test-only (prod ≥32 via `validate_settings`)
- Mock LLM represents real provider for security tests
- BYOK under user's DPA accepted via consent scopes (DPO review pending)
- Starlette upgrade non-breaking (verify in P14 staging)
- Under-13 via policy sufficient for MVP (13+ cohort)

---

## 8. Rollback / Recovery

- **Migrations:** `alembic downgrade 0018` → 0017 → 0016 reversible; SQLite
  fallback `create_all` reloads.
- **Middleware:** Remove `add_middleware` lines in `main.py:170`; `PUBLIC_PATHS`
  revert `auth.py`.
- **Daemon:** Stop via `lifespan` shutdown, no data loss (jobs re-queued).
- **Code:** All changes additive, `git diff 0feb7ff` shows 41 M reversible; no
  destructive changes per `allow_destructive_changes=false`.
- **Support:** `docs/security/Audit-Policy.md` + `SOC2.md` incident/breach +
  `Penetration-Test-Procedure.md`.

---

## 9. Next Entry Criteria (P14 — Testing and Quality Engineering)

Per prompt copy-ready §6, §26–27, plus this handoff:

- [ ] Previous phase has approved gate + valid handoff — **this document, 89/100
      CONDITIONAL, 0 mandatory blockers, baseline `0feb7ff`**
- [ ] Canonical sources + repo revision + environment identified — **see §2**
- [ ] Required access exists — check P14 needs PG staging if verifying real RLS
- [ ] Owners/reviewers/approver named — **P13: Security Architect (gate), IAM
      Eng, Privacy Eng, AI Safety Lead, AppSec, Compliance Specialist**
- [ ] Requirements/dependencies traceable, no critical blocker makes work unsafe
      — **233/233 + 20 EVD, zero critical blockers**
- [ ] Test/evidence/rollback/docs plans exist — **`05-test-results.md` +
      `07-evidence.md` + `08-registers.md` + rollback §8 above**
- [ ] Security/privacy/data/AI/operations classified —
      **`06-security-privacy.md` § Threat-specific table**
- [ ] **Restrictions acknowledgment:** implementer must note EXC-P13-01..06
      restrictions, especially #3 starlette ≥1.3.1 pre-prod

### Prohibited Work Until Restrictions Cleared

- Production deployment with real user personal data until DPIA DPO sign-off +
  starlette upgrade
- New tables/queries without `workspace_id` filter (EXC-P13-01)
- New tools without sanitization + prompt injection pattern review
  (EXC-P13-04/05)
- Claims of 36-table RLS or LLM-based detection (would be false)
- Child-directed marketing or school cohort under 13 without age gate
  (EXC-P13-06)

### Verification Commands P14 Starts With

```bash
# Trust base (from P12 handoff §5)
git log -n 5 --oneline && git status --short --branch && git rev-parse HEAD

# Security — must reproduce 233/233 before P14 adds tests
cd apps/api && uv run --project apps/api python -m pytest tests/security/ -v -o "addopts="
cd apps/api && uv run --project apps/api python -m pytest tests/security/test_csrf.py -v -o "addopts="
cd apps/api && uv run --project apps/api python -m pytest tests/security/test_prompt_injection.py -v -o "addopts="
cd apps/api && uv run --project apps/api python -m pytest tests/security/test_tenant_isolation.py -v -o "addopts="
cd apps/api && uv run --project apps/api python -m pytest tests/security/test_privacy_flows.py -v -o "addopts="

# Full regression (expect 2527 collected, 2459 pass, 4 skipped, 2 xfailed, 0 failed)
cd apps/api && uv run --project apps/api python -m pytest -q -o "addopts=-n 4"
cd apps/api && uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o "addopts=-n 4"

# P13 must-fix tracking (before prod, P14 owns)
pip-audit  # starlette PYSEC-2026-161/248/249 must be clear
bandit -r apps/api/src/api -ll

# P14 owns: live-provider eval, RLS 32 remaining, LLM classifier, input sanitization, starlette upgrade
```

### What P14 Must Validate, Not Assume

1. **Predecessor (this handoff) is accurate** — re-run at least the 6 commands
   above, sample 5 EVD file:line references, verify 88-path OpenAPI has not
   drifted.
2. **RLS 4/36 not silently assumed to be 36/36** — grep new queries for
   `workspace_id` filter.
3. **Injection protection is regex-only** — do not claim LLM classifier exists;
   verify 14 patterns vs 29 tests.
4. **DPIA is pending DPO** — do not ship to EU until signed.

---

## 10. References

- Gate: `docs/phases/mvp-p13/09-gate-report.md` (89/100)
- Workstreams: `03-workstreams.md` | Code: `04-code-config.md` | Tests:
  `05-test-results.md` | Security: `06-security-privacy.md`
- Evidence: `07-evidence.md` (20 rows) | Registers: `08-registers.md` (9 risks,
  10 decisions, 6 assumptions, 6 exceptions, 6 changes)
- Source register: `01-source-register.md` (13 INT + 19 EXT pinned)
- Predecessor audit: `02-predecessor-audit.md` (93/100 GO)
- Deliverables (canonical): `docs/security/DPIA.md` v1.0, `AI-Governance.md`
  v1.0, `Threat-Model.md`, `Compliance.md`, etc.

**Handoff Owner:** Phase owner (Security Architect) + Engineering Lead —
Approved for P14 start on user command.
