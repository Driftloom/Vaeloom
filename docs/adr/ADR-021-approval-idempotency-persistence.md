# ADR-021: Approval & Idempotency Persistence

| Metadata     | Value                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------ |
| **Status**   | ADOPTED — IMPLEMENTED_UNVERIFIED (verify hash binding, expiry, decision immutability at P07/P11) |
| **Date**     | 2026-08-15 (design re-run); first documented 2026-08-07                                          |
| **Deciders** | Engineering Team                                                                                 |
| **Owner**    | Security Architect                                                                               |

## Context

Consequential actions (email send, document mutations, consent/GDPR) must be
user-approved with immutable, expiring decisions (FR-50/51), and replay must not
re-execute the side effect. Prior P05 (2026-08-07) treated this as a gap;
zero-trust inspection @ `6e8a7b4` (`01-source-register.md` §4) shows it now
partially exists, so this records design as implemented-but-unverified.

## Decision

Persist approvals and idempotency records; do not rely on transient state.

- **Approvals** — `agent_approvals` (migration `0003_approvals.py`), managed by
  `services/approval.py`. PENDING rows carry `payload`, `reason`,
  `requested_by`, `workspace_id`, `expires_at` (default 60 min); decisions
  recorded against the row.
- **Idempotency** — `middleware/idempotency.py` + `idempotency_records`
  (`0006_idempotency.py`). Consequential POST/PUT/PATCH with an
  `Idempotency-Key` header hashed (SHA-256 `method|path|body`); identical replay
  returns stored response flagged `Idempotency-Replayed: true`; different
  payload → 422. Retention 24h.
- **Gmail** — draft-only (`clients/gmail_client.py`, no send) until per-user T3
  enablement (DEC-P02-01, DEC-P01-03).

## Consequences

**Positive:** Immutable, payload-bound, expiring approvals satisfy FR-50/51;
replay-safe consequential routes (consent/grant, consent/revoke, gdpr/delete,
approvals) with audit trail.

**Negative:** Coverage limited to consent/GDPR/approvals prefixes (breadth
UNVERIFIED); `payload` stored raw without a hash column — binding semantics,
expiry enforcement, and decision immutability UNVERIFIED; replays after 24h
retention re-execute.

## Reversibility / Rollback

Yes — additive tables + flag-gated middleware; downgrade drops
`agent_approvals`/`idempotency_records` without data-model rewrite.

## Verification (P07/P11)

Confirm payload-hash binding, expiry, decision immutability; extend
`CONSEQUENTIAL_PREFIXES` to all consequential routes (CF-P05-05).
