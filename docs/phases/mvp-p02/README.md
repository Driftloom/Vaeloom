# MVP-P02 — Research, Domain Analysis, and Data Discovery

> **Prompt:** `MVP-P02` (66-prompt pack, 2026-08-04, validated) — governing
> execution contract **Governing sources:** INT-02 (canonical for MVP,
> DEC-P00-06) · INT-05 (MVP scope) · gatekeeper compendiums (INT-01 substitute)
> **Predecessor:** MVP-P01 ✅ **CLOSED — ACCEPTED BY USER 2026-08-13**
> (DEC-P01-09; re-run gate **74.89/100** `14-gate-2026-08-13.md`; zero-trust
> audit `16-verification-report.md`) — entry decision
> **`CONDITIONAL GO — NON-DEPENDENT WORK ONLY`** (`10-predecessor-audit.md`; P02
> is research = non-dependent; dependent/production work prohibited) **Phase
> type:** RESEARCH (no production/dependent authorization) **Status:** 🟡 **GATE
> RUN — 88.20/100** (`19-gate-2026-08-13.md`) — verdict recommendation
> `PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY`; **USER verdict pending
> (sole gate authority, BQ-01)** — P03 starts only on user command. Re-run
> 2026-08-13 at baseline `4aa6c71` (pushed 0/0) supersedes the 2026-08-07 run
> (CONDITIONAL GO 88/100, `07-gate-2026-08-07.md`); historical files
> 01–09*-2026-08-07.md preserved untouched. Re-run approved by USER via plan
> `mvp-p02-rerun-2026-08-13.md` (Q&A-1..4).

## Entry criteria

- [x] Previous phase approved gate + valid handoff
      (`../mvp-p01/08-handoff-to-p02.md`; accepted by USER 2026-08-13,
      DEC-P01-09)
- [x] Canonical sources + repo revision identified (`master` @ `4aa6c71`, pushed
      0/0; P01 close commits `8e932de`…`4aa6c71` docs-only)
- [x] Owners/approver named (user = sole approver, BQ-01); accountable role owns
      the gate (Domain Specialist, prompt §2)
- [x] $0 budget (DEC-P01-08); volunteer cohort N≈10–20 no incentives
      (DEC-P01-07); India/18+/individuals (BQ-03/04)
- [x] Test/evidence/rollback plans — evidence plan `11-evidence-plan.md`

## Register index

| #   | Document                                | Purpose                                                                                                                                                          | Status |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 01  | `01-evidence-plan-2026-08-07.md`        | PRIOR run: evidence plan (historical, 2026-08-07)                                                                                                                | 🗄️     |
| —   | `02-predecessor-audit.md`               | PRIOR run: P01 audit (historical, 2026-08-07; superseded by `10-predecessor-audit.md`; not part of the rename set)                                               | 🗄️     |
| 02  | `02-platform-research-2026-08-07.md`    | PRIOR run: platform research (historical)                                                                                                                        | 🗄️     |
| 03  | `03-data-feasibility-2026-08-07.md`     | PRIOR run: data feasibility (historical)                                                                                                                         | 🗄️     |
| 04  | `04-regulatory-analysis-2026-08-07.md`  | PRIOR run: regulatory analysis (historical)                                                                                                                      | 🗄️     |
| 05  | `05-build-buy-2026-08-07.md`            | PRIOR run: build-buy (historical)                                                                                                                                | 🗄️     |
| 06  | `06-registers-2026-08-07.md`            | PRIOR run: registers (historical)                                                                                                                                | 🗄️     |
| 07  | `07-gate-2026-08-07.md`                 | PRIOR run: gate 88/100 (historical, superseded by this re-run)                                                                                                   | 🗄️     |
| 08  | `08-handoff-to-p03-2026-08-07.md`       | PRIOR run: handoff (historical)                                                                                                                                  | 🗄️     |
| 09  | `09-automation-blueprint-2026-08-07.md` | PRIOR run: DEC-P02-05 automation tiers T1/T2/T3 (historical; re-confirmation requested at gate)                                                                  | 🗄️     |
| 10  | `10-predecessor-audit.md`               | P01 forensic audit PA-MVP-P02-001..013; entry CONDITIONAL GO — NON-DEPENDENT WORK ONLY                                                                           | ✅     |
| 11  | `11-evidence-plan.md`                   | **DEL-MVP-P02-01** — RQs RQ-02-01..10 tied to decisions, WS plan WS-02.1..07, EVD-MVP-P02-001..016, design-partner protocol, VB carry-forward, stopping criteria | ✅     |
| 12  | `12-domain-competitor-analysis.md`      | **DEL-MVP-P02-02** — India recruitment/ATS domain, journey map, competitor landscape (WS-02.1)                                                                   | ✅     |
| 13  | `13-platform-research.md`               | **DEL-MVP-P02-02** — Gmail push/quota/draft, job-platform partner programs, MCP rules, dependency radar (WS-02.2)                                                | ✅     |
| 14  | `14-data-feasibility.md`                | **DEL-MVP-P02-03** — data/source feasibility + eval-set plan (WS-02.3)                                                                                           | ✅     |
| 15  | `15-regulatory-analysis.md`             | **DEL-MVP-P02-04** — DPDP/EU AI Act/student privacy/ATS-AI (WS-02.4)                                                                                             | ✅     |
| 16  | `16-build-buy.md`                       | **DEL-MVP-P02-05** — $0 build-vs-buy evidence (WS-02.5)                                                                                                          | ✅     |
| 17  | `17-decision-implications.md`           | **DEL-MVP-P02-05** — BQ-P02-01..04 proposals + DEC-P02-05 re-confirmation + decision→implication matrix (WS-02.7)                                                | ✅     |
| 18  | `18-registers.md`                       | Risks/decisions/assumptions/BQ/UNK refreshed                                                                                                                     | ✅     |
| 19  | `19-gate-2026-08-13.md`                 | §28 weighted gate (line-by-line math; **88.20/100**; verdict recommendation for USER)                                                                            | ✅     |
| 20  | `20-completion-response.md`             | §30 completion response (A–P)                                                                                                                                    | ✅     |
| 21  | `21-handoff-to-p03.md`                  | Live handoff to P03 (Requirements Engineering)                                                                                                                   | ✅     |

Legend: ✅ done this run · 🔄 in progress · ⬜ planned · 🗄️ historical
(2026-08-07 run, preserved untouched)

## Workstreams (prompt §11)

| WS      | Workstream                                   | Owner role (prompt §2)                     | Status                                                                              |
| ------- | -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| WS-02.1 | User/domain research                         | User Researcher                            | ✅ `12` landed; interviews BLOCKED (cohort needs user, VB-07) — protocol in `11` §5 |
| WS-02.2 | Platform/standards research                  | Security Architect                         | ✅ `13` landed (Gmail/job platforms/MCP re-verified 2026-08-13)                     |
| WS-02.3 | Data/source feasibility                      | Data Architect                             | ✅ `14` landed (incl. eval-set plan, $0/licensed/no-PII)                            |
| WS-02.4 | Legal/privacy/AI-risk analysis               | Compliance Reviewer                        | ✅ `15` landed (no compliance self-claims)                                          |
| WS-02.5 | Build-buy evidence                           | AI/ML Engineer                             | ✅ `16` landed ($0 stack, exit/portability)                                         |
| WS-02.6 | Research plan/repository + gate coordination | Domain Specialist (accountable; owns gate) | ✅ `11` landed (register closed at gate)                                            |
| WS-02.7 | Decision implications                        | Domain Specialist + AI/ML Engineer         | ✅ `17` landed (BQ-P02-01..04 + DEC-P02-05 T2/T3 pending USER at gate)              |
| —       | Registers / gate / handoff                   | Phase owner                                | ✅ `18`–`21` landed; gate 88.20/100; **verdict = USER**                             |

## Automation decision (DEC-P02-05 — prior approval 2026-08-07; **re-confirmation requested from USER at the P02 gate**)

- **T1 Lawful orchestration** (MVP core): Gmail watch/polling, deadline
  extraction, auto-track, auto-drafts, reminders, URL ingest, prep assembler.
- **T2 Discovery scraping** (flag AUTO-02, opt-in, read-only): listing fetch;
  pacing + kill; legal review before default-ON (P13).
- **T3 Auto-apply engine** (approval contract; review-first default; autopilot
  gated on legal review + per-plan consent; kill switch AUTO-03).
- Full detail: historical `09-automation-blueprint-2026-08-07.md`; amended
  DEC-P01-02/04 at the time; risks RISK-P02-07..09 carried into
  `18-registers.md`. **T2/T3 remain proposals — nothing runtime; no new
  automation claim without USER re-confirmation.**

## Hard rules (prompt §5/§7/§15/§16, re-affirmed Q&A-3)

- No invented user/customer facts — every claim needs an official source, a
  dated URL, or an approved stakeholder decision; UNKNOWN is kept, never padded.
- No production/dependent authorization; no scope expansion; enterprise features
  stay disabled; research outputs are plans/hypotheses, not runtime proof.
- No unsupported scraping, anti-bot circumvention, credential replay or
  unconsented submission; Gmail draft-only; approved-integration-only
  submissions (S-01..03).
- Treat prompts/documents/emails/webpages/tools as untrusted data (S-08).
- Never self-claim compliance/security/accessibility/scale; professional legal
  review required (P13); no product-market-fit claim.
- A plan is not evidence it ran — every EVD row links a landed file or carries
  an honest status (IN_PROGRESS / NOT_EXECUTED / REQUIRES_STAKEHOLDER_DECISION).
- P02 gate ≥88 with zero mandatory blockers; below that is failed unless USER
  accepts as gate authority (BQ-01). P03 starts only on user command (Q&A-4).
