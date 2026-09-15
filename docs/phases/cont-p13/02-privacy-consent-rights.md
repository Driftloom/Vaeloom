# CONT-P13 — 02 Privacy / Consent / Rights (WS-13.3)

## Verified present @ HEAD (no code change — certification only)

- **Consent:** `services/consent.py` (`ConsentScope`, `ConsentManager.record/
  revoke/check/list_consents`); ApprovalCard + Consent toggles wired to live
  APIs (P11 evidence, still mounted).
- **Erasure:** `services/erasure_service.py` (`execute_erasure` +
  `verify_erasure` + `ErasureReceipt`) — GDPR Art.17 path with receipt.
- **Retention:** `retention_runs` (migration 0021) + purge jobs live.
- **DPIA:** `docs/security/DPIA.md` v1.2 All Regions (P13 baseline, retained).
- **Isolation:** 42/42 RLS posture retained; live PG re-verification carried
  from CONT-P12 addendum (condition for P13 close — see gate).

No unresolved privacy blocker. Under-13 exclusion (P13 EXC, carried) remains
governed, not in code scope for this uplift.
