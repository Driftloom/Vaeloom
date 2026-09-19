# MVP-P06 — Technology Stack & Engineering Standards

> **Prompt:** `MVP-P06` (66-prompt pack) — TECHNOLOGY_SELECTION phase
> **Governing sources:** INT-02 · INT-05 · INT-07/08/09 · gatekeeper
> **Predecessor:** MVP-P05 ✅ CONDITIONAL GO 87.3/100, accepted 2026-08-15
> **Status:** 🟡 RE-RUN COMPLETE — docs 01–11 written 2026-08-15; gate 69.9/100
> (BELOW 88 threshold); ALL 8 CONFLICTS RESOLVED; **PHASE CONDITIONALLY APPROVED
> — CONFLICTS RESOLVED, CARRIED FAILURES**; USER verdict accepted. Enterprise
> upgrade 2026-08-17: prompt file + all deliverables updated with MCP/OWASP
> standards, coverage fix (94%), gate state consistency, SHA pinning docs. Prior
> run (2026-08-07, gate 88/100 CONDITIONAL GO, never ratified) superseded;
> history preserved (`*-2026-08-07.md`). P07 starts only on user command.

## Blocking questions (prompt §8) — resolved

| ID | Question | Decision | Owner |
| --------- | --------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| BQ-01..05 | Approver/baseline/region/team (carried) | user; `master` @ `e48f547`; India 18+; $0 cohort | per-item |
| BQ-P06-01 | Mandated/prohibited tech | Adopt repo stack; phase rule prohibitions; $0 constraints | Architecture |
| BQ-P06-02 | LLM provider strategy | Local/free preferred; anthropic/openai fallback gated; mock_llm for tests | User |

## Q&A — RESOLVED

| ID | Question | Resolution |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| Q&A-1 | Prior P06 evidence handling | Date-rename to `*-2026-08-07.md`, write fresh at new baseline |
| Q&A-2 | Fix-vs-document for broken configs | Document gaps + add minimal safe standards config |
| Q&A-3 | Deployment target | PaaS-first intent; concrete choice deferred to P16/P19 |
| Q&A-4 | LLM strategy | Re-confirm: local/free preferred, paid fallback gated |
| Q&A-5 | Version policy | Enterprise-grade: frozen lockfile, EOL watch, SBOM, cosign keyless, license enforcement |

## Register index

| # | Document | Purpose |
| --- | -------------------------------------- | ------------------------------------------------------------------ |
| 01 | `01-source-register.md` | Sources + conflicts (CF-P06-01..08 — ALL RESOLVED) |
| 02 | `02-predecessor-audit.md` | Audit of P05 → entry CONDITIONAL GO |
| 03 | `03-technology-decision-matrix.md` | **DEL-MVP-P06-01** — stack pins from repo truth |
| 04 | `04-version-policy.md` | **DEL-MVP-P06-02** — enterprise version policy |
| 05 | `05-engineering-standards.md` | **DEL-MVP-P06-03** — standards + config edits |
| 06 | `06-dependency-governance.md` | **DEL-MVP-P06-04** — supply-chain governance |
| 07 | `07-cost-exit-strategy.md` | **DEL-MVP-P06-05** — cost/operability/exit |
| 08 | `08-registers.md` | Risks/decisions/assumptions/evidence |
| 09 | `09-gate-2026-08-15.md` | §28 weighted gate (69.9/100; conflicts resolved, carried failures) |
| 10 | `10-handoff-to-p07.md` | Next-phase handoff (Data Architecture) |
| 11 | `11-completion-response-2026-08-15.md` | §30 A–P completion response |

## Workstreams

| WS | Workstream | Owner | Output |
| ------- | -------------------------------- | ---------------------- | ------ |
| WS-06.1 | Technology evaluation | Solution Architect | `03` |
| WS-06.2 | Version/support policy | Platform Engineer | `04` |
| WS-06.3 | Engineering/repository standards | Backend+Frontend Leads | `05` |
| WS-06.4 | Supply-chain governance | Security Engineer | `06` |
| WS-06.5 | Cost/operability/exit | FinOps Specialist | `07` |

## Scope note

- **In:** evaluation, version policy, standards, dependency governance,
 cost/exit, minimal safe config edits (Q&A-2)
- **Out:** enterprise features; premature k8s/Kafka/graph/vector-db/OpenSearch;
 production changes; T2/T3 enablement
- **Repo truth:** versions from live manifests (evidence EVD-MVP-P06-001..004)

## Re-run note

This is a re-run at baseline `e48f547` (P05 close). Prior run (2026-08-07, gate
88/100 CONDITIONAL GO, never ratified) is preserved as `*-2026-08-07.md`. This
re-run refreshes all evidence at the new baseline with zero-trust inspection.
Config edits (Q&A-2) applied: backend ruff/mypy/coverage, .python-version, CI
dead-path fixes, docker-compose.prod healthcheck/mount fixes, dependabot pip.

## Enterprise Upgrade (2026-08-17)

Upgraded all 12 files to enterprise grade:

| File | Key Changes |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Prompt file | Fixed architecture (removed NestJS), updated MCP/OWASP standards, added repo-reality truth rule, added enterprise rigor gaps |
| 03-technology-matrix | Added security/agent scoring dimensions, MCP compatibility, OWASP ASI mapping, EOL risk column |
| 04-version-policy | Added SHA pinning gap documentation, license enforcement partial fix, reproducibility verification |
| 05-engineering-standards | Fixed `apps/backend/` → `apps/api/`, coverage 97→94%, added TS/Python strict standards, fixed Prometheus status |
| 06-dependency-governance | Added OWASP ASI04 mapping, expanded supply-chain threat map |
| 07-cost-exit-strategy | Minor fixes |
| 09-gate-report | Formalized recalculation, added blocker definitions, confidence assessment |
| 10-handoff | Fixed gate state (FAILED → CONDITIONAL GO) |
| 11-completion-response | Fixed coverage (94%), EVD references (001-023), metrics status |
| README | Added enterprise upgrade summary |

## Cross-Document Consistency (verified 2026-08-17)

| Value | Consistent across all docs |
| ----------- | ---------------------------------- |
| Coverage | 94% |
| Test count | 2333 pytest |
| Python | 3.12 (CI) / 3.14 (local via uv) |
| Gate state | CONDITIONAL GO |
| Path | `apps/api/` |
| NestJS | LEGACY PACKAGES ONLY, NOT DEPLOYED |
| BullMQ | INSTALLED, NO CONSUMERS DEPLOYED |
| Meilisearch | NOT_INSTALLED |
| Qdrant | DEAD CODE |
| Apache AGE | PROVISIONED, UNUSED |
