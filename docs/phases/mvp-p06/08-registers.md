# MVP-P06 — 08. Registers (Risks / Decisions / Assumptions / Evidence) — Re-Run 2026-08-15

> Phase snapshot at baseline `e48f547`. Burndown at each gate.

## 1. Risks

| ID              | Risk                                                                               | Sev           | Mitigation                                                                                | Owner    | Status |
| --------------- | ---------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------- | -------- | ------ |
| RISK-P03-01..05 | carried (docs vs runtime / scope / drift / evidence / expansion)                   | CRIT/HIGH     | Runtime evidence; pins; change control                                                    | per-item | OPEN   |
| RISK-P05-01..09 | carried (approval gate, RLS, Gmail, residency, LLM cost, UX, migration, contracts) | CRIT/HIGH/MED | as P05                                                                                    | per-item | OPEN   |
| RISK-P06-01     | Free/local LLM quality below thresholds (≥80% retrieval, ≥90% extraction)          | HIGH          | eval harness P12/P14; provider choice data-driven; paid fallback only via approved budget | AI Lead  | OPEN   |
| RISK-P06-02     | Embedding dimension change (1536 → local-model dims) cascades to schema            | MED           | ADR-024 rebuild; flag P07 schema + P12 embeddings                                         | Data     | OPEN   |
| RISK-P06-03     | Free-tier limits (rate/quotas) surprise at 100/1,000                               | MED           | P15 load tests; fallback providers; spend log                                             | Platform | OPEN   |
| RISK-P06-04     | Version drift between pinned and lockfile                                          | MED           | Frozen-lockfile CI; EOL watch (NEW: Q&A-5)                                                | Platform | OPEN   |
| RISK-P06-05     | Backend ruff/mypy config added but not yet in CI pipeline                          | LOW           | CI fix included in P06; verify at P14                                                     | Platform | OPEN   |

## 2. Decisions

| ID          | Decision                                                                                                  | Authority    | Date       |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| DEC-P03..05 | carried (requirements baseline 76 rows; release baseline P0+P1=73; ship window scenario-based; etc.)      | User/Program | 2026-08-1x |
| DEC-P05-01  | 99% best-effort availability, no SLA                                                                      | User         | 2026-08-07 |
| DEC-P05-02  | nearest-region hosting; DPDP residency flagged P13                                                        | User         | 2026-08-07 |
| DEC-P05-03  | ADR-021..026 adopted at baseline e48f547                                                                  | Architecture | 2026-08-15 |
| DEC-P06-01  | Stack pinned per repo manifests; prohibitions per phase rule                                              | Architecture | 2026-08-15 |
| DEC-P06-02  | LLM = local/free preferred; mock-first; paid = approved micro-budget only                                 | User         | 2026-08-15 |
| DEC-P06-03  | Enterprise version policy adopted (frozen lockfile, EOL watch, SBOM, cosign keyless, license enforcement) | Engineering  | 2026-08-15 |
| DEC-P06-04  | PaaS-first intent; concrete choice deferred to P16/P19                                                    | Architecture | 2026-08-15 |
| DEC-P06-05  | Minimal safe config added in P06 (ruff/mypy/coverage/.python-version, CI fixes, compose fixes)            | User         | 2026-08-15 |

## 3. Assumptions

| ID         | Assumption                                                     | Owner       | Reversible?        |
| ---------- | -------------------------------------------------------------- | ----------- | ------------------ |
| ASP-P06-01 | Python 3.14 (repo runtime) remains compatible with pinned deps | Backend     | Yes — CI matrix    |
| ASP-P06-02 | Free/local LLM suffices for cohort trial volumes (N≈10–20)     | AI          | Yes — measured P15 |
| ASP-P06-03 | SQL ILIKE + pgvector sufficient for MVP search/retrieval       | Data        | Yes — P15 load     |
| ASP-P06-04 | Single FastAPI service + worker suffices for 100/1,000 design  | Engineering | Yes — verified P15 |

## 4. Deferred ideas (future backlog)

| Idea                                         | Trigger                | Owner       | Notes                                  |
| -------------------------------------------- | ---------------------- | ----------- | -------------------------------------- |
| ESLint flat config migration (v8 → v9)       | P16                    | Frontend    | Current legacy .eslintrc works         |
| eslint-plugin-security                       | P16                    | Security    | —                                      |
| Pre-commit eslint/ruff (not just prettier)   | P16                    | Platform    | —                                      |
| /metrics instrumentator uncommented          | P17                    | SRE         | Currently COMMENTED OUT in main.py:135 |
| gitleaks local config (.gitleaks.toml)       | P16                    | Security    | Action uses defaults                   |
| pip-audit continue-on-error → blocking       | P16                    | Security    | Currently non-blocking                 |
| dependency-review-action                     | P16                    | Security    | New deps not auto-reviewed             |
| osv-scanner                                  | P16                    | Security    | Only implicit via pip-audit            |
| Backend Dockerfile uv lockfile enforcement   | P16                    | Platform    | Currently uses pip install             |
| Gmail push (watch → push path)               | >100 users             | Integration | polling first (DEC-P02-01)             |
| RLS native enforcement (full table coverage) | P07 verify / P14 suite | Security    | currently 4/36 tables                  |
| k8s/terraform prod                           | enterprise track       | Cloud       | PaaS-first MVP (ADR-026)               |
| T2 discovery / T3 autopilot                  | legal review + flags   | Product     | AUTO-02/03 OFF                         |

## 5. Evidence (EVD)

| ID              | Claim                                        | Requirement     | Type                 | Location                              | Result | Date       | Verified by |
| --------------- | -------------------------------------------- | --------------- | -------------------- | ------------------------------------- | ------ | ---------- | ----------- |
| EVD-MVP-P06-001 | Backend version inventory from uv.lock       | MVP-P06-R01/R02 | REPO_VERIFIED        | `01-source-register.md` §4            | PASS   | 2026-08-15 | Agent A     |
| EVD-MVP-P06-002 | Frontend version inventory from package.json | MVP-P06-R01/R02 | REPO_VERIFIED        | `01-source-register.md` §4            | PASS   | 2026-08-15 | Agent A     |
| EVD-MVP-P06-003 | Infrastructure inventory from docker-compose | MVP-P06-R01/R02 | REPO_VERIFIED        | `01-source-register.md` §4            | PASS   | 2026-08-15 | Agent A     |
| EVD-MVP-P06-004 | Supply chain inventory                       | MVP-P06-R03     | REPO_VERIFIED        | `01-source-register.md` §4            | PASS   | 2026-08-15 | Agent A     |
| EVD-MVP-P06-005 | Lockfile strategy documented                 | MVP-P06-R02     | DESIGN               | `04-version-policy.md` §2             | PASS   | 2026-08-15 | Agent C     |
| EVD-MVP-P06-006 | EOL watch configured                         | MVP-P06-R02     | REPO_VERIFIED        | `.github/dependabot.yml`              | PASS   | 2026-08-15 | Agent C     |
| EVD-MVP-P06-007 | SBOM + provenance configured                 | MVP-P06-R02     | REPO_VERIFIED        | `security-scan.yml`, `deploy.yml`     | PASS   | 2026-08-15 | Agent C     |
| EVD-MVP-P06-008 | Lint/format/test tooling inventory           | MVP-P06-R04     | REPO_VERIFIED        | root configs + pyproject.toml         | PASS   | 2026-08-15 | Agent D     |
| EVD-MVP-P06-009 | Security headers configured                  | MVP-P06-R04     | REPO_VERIFIED        | `apps/web/next.config.js`             | PASS   | 2026-08-15 | Agent D     |
| EVD-MVP-P06-010 | Error taxonomy documented                    | MVP-P06-R04     | DESIGN               | `05-engineering-standards.md` §6      | PASS   | 2026-08-15 | Agent D     |
| EVD-MVP-P06-011 | License policy defined                       | MVP-P06-R03     | DESIGN               | `06-dependency-governance.md` §1      | PASS   | 2026-08-15 | Agent E     |
| EVD-MVP-P06-012 | Vulnerability SLA defined                    | MVP-P06-R03     | DESIGN               | `06-dependency-governance.md` §2      | PASS   | 2026-08-15 | Agent E     |
| EVD-MVP-P06-013 | Supply-chain threats mapped                  | MVP-P06-R03     | DESIGN               | `06-dependency-governance.md` §7      | PASS   | 2026-08-15 | Agent E     |
| EVD-MVP-P06-014 | Dependency governance documented             | MVP-P06-R03     | DESIGN               | `06-dependency-governance.md`         | PASS   | 2026-08-15 | Agent E     |
| EVD-MVP-P06-015 | Cost guardrails documented                   | MVP-P06-R05     | DESIGN               | `07-cost-exit-strategy.md` §1         | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-016 | Exit playbooks defined                       | MVP-P06-R05     | DESIGN               | `07-cost-exit-strategy.md` §3         | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-017 | PaaS framework defined                       | MVP-P06-R05     | DESIGN               | `07-cost-exit-strategy.md` §2         | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-018 | BQ-P06-02 user decision (local/free LLM)     | MVP-P06-R03     | STAKEHOLDER_DECISION | DEC-P06-02                            | PASS   | 2026-08-15 | User        |
| EVD-MVP-P06-019 | Prior P06 evidence date-renamed              | MVP-P06-R07     | REPO_VERIFIED        | `docs/phases/mvp-p06/*-2026-08-07.md` | PASS   | 2026-08-15 | Agent A     |
