# MVP-P10 → MVP-P11 Handoff

## Phase Summary

Frontend implemented against P09 design, verified by real runs:

- A11y: skip link + landmarks, Modal focus trap/restore, global focus-visible,
  reduced-motion kill switch, aria-current/aria-live/role=log, emoji aria-hidden
- Trust/approval: ApprovalCard (diff/expiry/provenance/confidence/risk/scopes/
  T3 warning/kbd a-r) — UI complete vs P08 contract; **not wired (P11)**
- Rights: typed-confirm erasure + backup-expiry receipt; Consent Scopes section
  (T3 toggle disabled-gated); consentApi + gdprApi wrappers
- Memory: MemoryCorrectionPanel with supersession copy (live memoryApi.update)
- Chat: AI disclosure on agent messages; role="log"
- Shell: Sidebar → 6 IA spaces, enterprise gated, aria-current
- Tokens: success/warning/info added; Toast system added

## Evidence

| ID                   | Claim                       | Artifact                         |
| -------------------- | --------------------------- | -------------------------------- |
| EVD-MVP-P10-001..009 | code/test/security evidence | `07-evidence.md` (all real runs) |
| EVD-MVP-P10-010      | ratification                | PENDING user                     |

## Gate: CONDITIONAL APPROVED — RESTRICTIONS APPLY (88/100)

| Restriction                                                                                     | Target phase |
| ----------------------------------------------------------------------------------------------- | ------------ |
| 1. Wire ApprovalCard + consent state to live backend; supersession semantics must match UI copy | P11          |
| 2. Contract tests: generated client vs OpenAPI; verify consent/gdpr paths                       | P11          |
| 3. Full WCAG 2.2 AA audit + usability sessions (≥80% task success, SUS ≥70)                     | P14          |
| 4. No new routes/deps without change control; enterprise gated                                  | ongoing      |

## Open issues carried

- RISK-P10-01..04 (register §1)
- RISK-P09-01..05 (carried)
- Full E2E/a11y/UX evidence → P14 · cohort usability → P14 (VB-07)
- UNK-02 creds → P19 · UNK-P03-01 legal → P13

## Scope for MVP-P11 (Backend Implementation)

- Implement approval API per P08 §03.2 (propose/decide/execute/revoke,
  payload_hash, expiry, idempotency) — release-blocking for send paths
- Implement P07 migrations 0003–0007 (approval tables, memory taxonomy CHECK +
  supersedes_id + deleted_at, RLS + composite keys, provenance/consent/
  retention columns) with rollback; gate `Base.metadata.create_all` behind
  `ENV != prod`
- Wire consent endpoints + GDPR export/delete per P08 §03.5; Gmail watcher
  endpoints per P08 §03.4 (draft-only, kill-switch pause)
- Static OpenAPI 3.1 at `docs/contracts/openapi.yaml` + CI openapi-diff
- Contract tests for approval flows (payload-bound, expiry, replay 409,
  idempotent execute)

## Constraints for successor

- Backend: FastAPI unified app `apps/api`; `models/schema.py` 33 tables; alembic
  0001/0002 exist — 0003..0007 on top; 1626 tests must stay green (SQLite tests
  use `Base.metadata.create_all` — keep behind ENV check)
- CSRF `SKIP_PREFIXES` must remain `/api/v1/auth` only (AGENTS.md item 4)
- transformKeys snake↔camel contract (AGENTS.md item 3) — response shapes must
  match what the frontend expects
- Python 3.14 note: `__athrow__` removed — use `athrow()`
- Frontend changed files list in `04-code-config.md` — do not regress
