# DEL-ENT-P14-03 — Defect and Waiver Register

**Deliverable ID:** DEL-ENT-P14-03  
**Phase:** ENT-P14 — Testing and Quality Engineering  
**Version:** 1.0.0  
**Owner:** QA Lead  
**Reviewer:** Application Security Engineer + Security Architect  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable path:** `evidence/phases/ent/ent-p14/03-defect-waiver-register.md`

---

## 1. Open Defects

| DEF-ID     | Summary                                                       | Severity | Component                           | Found                       | Owner                    | Status             | Target                      |
| ---------- | ------------------------------------------------------------- | -------- | ----------------------------------- | --------------------------- | ------------------------ | ------------------ | --------------------------- |
| DEF-P14-01 | Prompt injection detection depth insufficient (partial block) | HIGH     | `services/loop.py` + S1 Jev routing | ENT-P13 red team            | AI Safety Lead           | OPEN — TRACKED     | ENT-P14 enhanced classifier |
| DEF-P14-02 | Trivy HIGH CVE in Python 3.12-slim base image                 | HIGH     | `Dockerfile.api`                    | ENT-P13 Trivy scan          | DevOps                   | OPEN — TRACKED     | ENT-P16 base image pin      |
| DEF-P14-03 | 8 new security test files not yet implemented                 | MEDIUM   | `tests/security/`                   | ENT-P13 DEL-P13-05          | AppSec Engineer          | OPEN — IN PROGRESS | ENT-P14                     |
| DEF-P14-04 | WCAG 2.2 axe-core automated test coverage = 0                 | MEDIUM   | `apps/web/`                         | ENT-P14 gap analysis        | Frontend Lead            | OPEN — IN PROGRESS | ENT-P14                     |
| DEF-P14-05 | OpenAPI contract tests not automated                          | MEDIUM   | `tests/contract/`                   | ENT-P14 gap analysis        | API Lead                 | OPEN — IN PROGRESS | ENT-P14                     |
| DEF-P14-06 | SAML router not wired to live endpoint                        | LOW      | `services/saml.py`                  | ENT-P13 decision DEC-P13-03 | IAM Engineer             | DEFERRED — ENT-P16 | ENT-P16                     |
| DEF-P14-07 | DPDP data nominee not implemented                             | MEDIUM   | Account/rights service              | ENT-P13 DPIA                | Privacy Engineer         | DEFERRED — ENT-P15 | ENT-P15                     |
| DEF-P14-08 | COPPA age gate not implemented                                | MEDIUM   | Registration flow                   | ENT-P13 DPIA                | Privacy Engineer + Legal | DEFERRED — ENT-P16 | ENT-P16                     |

---

## 2. Resolved Defects (ENT-P14 scope)

| DEF-ID     | Summary                                                               | Resolution                                                                | Resolved                 |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| DEF-P14-09 | test_noauth_private.py non-deterministic collection order (frozenset) | Fixed: `sorted(PUBLIC_PATHS)` — determinism under xdist                   | 2026-08-22 (prior phase) |
| DEF-P14-10 | Mock LLM instance attr leakage across tests                           | Fixed: patch BOTH class AND singleton; conftest autouse                   | 2026-08-29 (prior phase) |
| DEF-P14-11 | RLS service policy `USING (true)` on ~25 tables                       | Tracked: `docs/security/RLS-SERVICE-POLICY-EXPOSURE.md`; remediation plan | Ongoing monitoring       |

---

## 3. Waiver Register

| WAIVER-ID  | Subject                                        | Rationale                                                                    | Controls                                                       | Approver           | Expiry           | Prohibited downstream                             |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------ | ---------------- | ------------------------------------------------- |
| WAI-P14-01 | SAML router not live                           | No current enterprise customer requiring SAML; OIDC covers all active IdPs   | OIDC fully tested; `services/saml.py` exists with real signxml | CISO               | ENT-P16 delivery | Do not claim SAML is tested                       |
| WAI-P14-02 | External pentest not completed                 | Dev phase; internal red team 9/10 blocked; full feature set not yet deployed | Internal red team evidence; CI SAST/DAST                       | CISO               | ENT-P19 delivery | Do not claim pentest-verified to external parties |
| WAI-P14-03 | COPPA/DPDP child-data controls not implemented | No under-13 (COPPA) or under-18 India (DPDP) users in current pipeline       | Age self-attestation at registration; no child-directed UX     | Legal Reviewer     | ENT-P16 delivery | Do not market to under-18 India or under-13 users |
| WAI-P14-04 | Trivy HIGH CVE in base image                   | Patch available; upgrade requires CI validation                              | Internal network only; no public exposure in dev phase         | Security Architect | ENT-P16 delivery | Do not ship to production with current base image |

---

## 4. Flaky Test Register

| Test                       | File | Reason                              | Quarantine date | Owner | Expiry |
| -------------------------- | ---- | ----------------------------------- | --------------- | ----- | ------ |
| None currently quarantined | —    | 731/731 deterministic in serial run | —               | —     | —      |

**Flaky test count: 0** — full serial run `-o addopts=""` is 100% deterministic.

> [!NOTE] xdist parallel runs (`-n auto`) can expose non-determinism in test
> collection order. All `frozenset` → `sorted(list)` fixes were applied in prior
> phases. Current baseline: stable under `-n 4`.

---

## 5. Test Skips

| Test | File | Skip reason                                       | Owner | Must fix before |
| ---- | ---- | ------------------------------------------------- | ----- | --------------- |
| None | —    | No `@pytest.mark.skip` without reason in codebase | —     | —               |

**Zero unexplained skips.**

---

_Deliverable DEL-ENT-P14-03 v1.0.0 — QA Lead — 2026-09-29_
