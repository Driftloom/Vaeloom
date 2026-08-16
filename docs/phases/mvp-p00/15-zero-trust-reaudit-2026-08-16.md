# MVP-P00 — 15. Zero-Trust Re-Audit (2026-08-16)

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Date:** 2026-08-16
> **Method:** zero-trust — every prior claim re-checked against the actual repo
> and web-verified standards; no old report taken at face value. **Scope:**
> documentation/verification only — no source changes. **Baseline:** P00
> evidence pinned at `3ad6bca68ca827050cb0e1c4c323f2ba4fee88ac`; repo HEAD at
> audit time `2f12d944d5e8247763ad0af7711134d4403b3f06` (0/0 vs origin).
> **Register root:** `docs/phases/mvp-p00/`

## 1. Purpose

The user asked for a fresh, independent, zero-trust audit of the P00 intake
work: deeply understand the project, verify claims against evidence (not old
reports), use web research to re-check the external standards overlay, upgrade
the existing docs, and explain everything end to end.

## 2. What was actually re-verified (commands run 2026-08-16)

| #   | Claim                                   | How verified                                                                                                                                     | Result                                                                                                                                                                                   |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 66-prompt pack SHA256SUMS integrity     | `Get-FileHash` each manifest entry (75 entries) vs `SHA256SUMS.md`                                                                               | **75/75 PASS, 0 mismatch, 0 missing** ✅                                                                                                                                                 |
| 2   | Canonical in-repo hashes (INT-02/03/04) | `Get-FileHash` on `docs/vaeloom-mvp-e2e-enterprise-hardened.md`, `vaeloom-mvp-e2e.md`, `vaeloom-enterprise-e2e.md`                               | INT-02 `F32A2A85…`, INT-03 `38540987…`, INT-04 `F22D3F9B…` — **match 2026-08-12 pin** ✅                                                                                                 |
| 3   | MVP scope lock in code                  | Read `config.py:69-70` + `orchestrator/router.py:178-232`                                                                                        | `mvp_scope_enforced=True`, `enterprise_routes_enabled=False`; `MVP_CANONICAL_AGENTS` 8-name gate + `_handle_out_of_scope` enforcement — **as documented** ✅                             |
| 4   | Backend test inventory                  | `Get-ChildItem apps/backend/tests -Recurse -Filter test_*.py`                                                                                    | **130 test files** (unchanged) ✅                                                                                                                                                        |
| 5   | Test collection at current HEAD         | `python -m pytest tests/ --co -q` (env contract: JWT_SECRET, ENCRYPTION_KEY, DATABASE__URL=sqlite, LLM_API_KEY=mock-key, OTEL_SDK_DISABLED=true) | **2335 tests collected in 53s** at working tree incl. uncommitted P06/P07 changes ✅ (no collection/import regression)                                                                   |
| 6   | Backend source counts                   | `git ls-files 'apps/backend/src/backend/**'` + disk scan                                                                                         | **217 committed .py / 220 on disk** (3 uncommitted: erasure/export/provenance services) ✅ corrected                                                                                     |
| 7   | Routers / middleware / schemas / agents | Disk scans                                                                                                                                       | 26 routers, 12 middleware, 26 schemas, 23 agent dirs + memory pkg ✅                                                                                                                     |
| 8   | Services count                          | Disk scan                                                                                                                                        | **46 committed / 49 on disk** (was "46"; corrected) ✅                                                                                                                                   |
| 9   | Migrations                              | Disk scans `alembic/versions` + `src/backend/migrations`                                                                                         | alembic 0001–0002 committed + **0003–0006 uncommitted**; runner migrations 0002–0007 (6). Prior "7 migrations" = blended count; **corrected**                                            |
| 10  | Docs corpus / ADRs                      | Disk scans                                                                                                                                       | **574 `.md`** (was 492), **26 ADRs** (was 20 — ADR-021…026) ✅ corrected                                                                                                                 |
| 11  | CI workflows                            | `Get-ChildItem .github/workflows`                                                                                                                | 11 workflows ✅                                                                                                                                                                          |
| 12  | Git sync                                | `git status --short --branch`                                                                                                                    | 0 ahead / 0 behind origin; HEAD `2f12d94` ✅                                                                                                                                             |
| 13  | Working-tree cleanliness                | `git status --porcelain`                                                                                                                         | **UNCOMMITTED P06/P07 work** — new migrations 0003–0006, 3 new services, schema.py consent/retention/provenance fields, main.py + tenant.py edits, backup/restore scripts ⚠️ new finding |

## 3. Repo-state findings (new, not in the 2026-08-12 P00 docs)

1. **Baseline drift (CF-07):** the repo has moved from the P00-pinned `3ad6bca`
   to `2f12d94` (P01–P05 executed and committed). P00 evidence must remain
   pinned at `3ad6bca` to stay reproducible; nothing about the P00 numbers
   changed.
2. **Uncommitted in-flight work:** P06 (tech stack) and P07 (data architecture)
   have written deliverables (gates dated 2026-08-15) plus uncommitted backend
   code (alembic 0003–0006, erasure/export/provenance services, schema
   consent/retention/provenance/oauth-scope fields, tenant middleware change).
   These are P06/P07-owned and outside P00's change authority. The 2026-08-12
   full-suite green run (2333/0/2xf) was at `3ad6bca`; a fresh full-suite run at
   the moved HEAD is P07-gate-owned — **do not re-claim the green run for
   `2f12d94` without re-running**.
3. **Collection sanity at HEAD:** 2335 tests still collect, so the in-flight
   changes did not break collection/imports as of 2026-08-16.

## 4. External-standards overlay — web-verified 2026-08-16 (see register 01 §3)

Materially-new (★) items the 2026-08-06 snapshot did not capture:

- **OWASP GenAI LLM Top 10 → 2026 edition** (published 2026-08-03/04; the 2025
  edition is archived). All docs citing "2025" must read "2026".
- **OWASP Top 10 Agentic Applications 2026 is FINAL** (ASI01–ASI10).
- **MCP spec `2026-07-28` is stable** — major revision (stateless core,
  `server/discover`, MRTR, header routing, EMA auth extension, DCR deprecated →
  CIMD, Tasks extension). Pin this revision; design servers stateless.
- **EU AI Act:** Art. 50 transparency obligations **live 2026-08-02**
  (confirmed). High-risk rules **delayed** by Reg. (EU) 2026/1744 → Annex III
  2027-12-02, Annex I 2028-08-02; 2 new Art. 5 prohibitions 2026-12-02.
- **India DPDP Rules 2025:** finalized & notified **2025-11-13/14**; DPB live;
  consent-manager registration **Nov 2026**; full compliance **2027-05-13**.
- **COPPA:** amended rule **fully in force 2026-04-22**; COPPA 2.0 (S.836)
  passed Senate 2026-03-05 (not yet law).
- **Gmail API:** quota model standardized **2026-05-01** (1.2M
  units/min/project, per-method units; exceeding may bill later in 2026); watch
  7-day expiry.
- **GitHub Apps:** user access tokens (fine-grained, ~8h expiry) now standard;
  REST API version header `2026-03-10`.
- **SLSA v1.2** adds the Source Track; **NIST SSDF v1.2** is draft (v1.1 final);
  **OpenAPI 3.2.0** and **Arazzo 1.1.0** confirmed current; **OpenTelemetry**
  spec 1.60.0 (moving target).

## 5. Claims that did NOT change (still true)

- P00 gate re-score **75.69/100** (`09` §8) and verdict recommendation
  `PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY`.
- Full backend suite green at `3ad6bca`: **2333 passed / 0 failed / 2 xfailed**
  (2026-08-12); security suite 172/172; jest 37/37; e2e 39/39 across 3 browsers.
- Coverage honest measurement **94%** (641 missing lines); AGENTS.md "100%"
  claim retired (RISK-P00-13).
- No deployment/SLO/production/a11y/load evidence exists → no production-ready
  claims (BQ-02 deferred to P19).
- BQ-01/03/04/05 answered (USER, India, 18+, founder team, invite-only cohort).
- Scope conflict CF-05/06 (23 agents + enterprise routes vs 8-agent MVP) OPEN.

## 6. Doc upgrades applied (2026-08-16)

| File                                      | Upgrade                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `01-source-register.md`                   | Header baseline/HEAD/drift; EXT §3 re-verified (★ rows) with dates+URLs; CF-07 added; INT-12 re-audit note; new §8 re-audit summary                                            |
| `02-asset-inventory.md`                   | Baseline/HEAD updated; counts corrected (src 217/220, services 46/49, docs 574, ADRs 26, migrations split committed/uncommitted); finding 7 (drift); evidence commands updated |
| `03-maturity-and-evidence-matrix.md`      | Header + §4/§6 updated; §6.1 re-audit block; counts corrected                                                                                                                  |
| `04-risk-decision-assumption-register.md` | RISK-P00-14 (standards drift), RISK-P00-15 (baseline drift/uncommitted), DEC-P00-09 added                                                                                      |
| `05-phase-map-and-governance.md`          | P06/P07 rows → IN FLIGHT (uncommitted); header re-audit note                                                                                                                   |
| `README.md`                               | Header + row 15 + core truth 6 added                                                                                                                                           |
| `15-zero-trust-reaudit-2026-08-16.md`     | **This file**                                                                                                                                                                  |

## 7. Gate impact

No gate re-score was performed: the P00 completion-pass score (75.69/100) and
its evidence basis at `3ad6bca` are unchanged by this audit. The audit adds
visibility (baseline drift, uncommitted P06/P07 work, refreshed external
standards) and registers RISK-P00-14/15 + DEC-P00-09. The gate verdict remains
**pending USER** (sole authority, BQ-01).

## 8. Recommended next steps

1. **User decides** the P00 gate verdict (75.69/100; restrictions in
   `13-readiness-and-done.md`).
2. P06/P07 to commit + verify their in-flight work, including a **fresh full
   backend suite run at the moved HEAD** (not a re-claim of `3ad6bca`'s run).
3. Carry the web-verified standards (register 01 §3 ★) into each owning phase
   (P08 MCP, P13 legal/AI, P14 WCAG, P15 SLO, P16 SLSA/SSDF).
4. Update AGENTS.md counts (docs 574, ADRs 26, services on disk 49) and the
   OWASP LLM "2026" reference where stale.
