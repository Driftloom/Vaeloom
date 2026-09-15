# CONT-P18 — 03 User / Admin / Customer Docs (WS-18.3, DEL-02)

## Verified @ HEAD

- Usage + integration + UX guidelines present (`usage-guide.md`,
  `Integration-Guide.md`, `frontend/UX-Guidelines.md`).
- Permissions/rights/limits documented via consent flows + approval cards
  (P11 wiring) + workspace RBAC matrix (`backend/Authorization.md`).
- Failure behavior: user-facing error cards (budget/quota/approval) are
  code-defined strings in `loop.py:_ceiling_error_card` — consistent copy,
  no doc drift possible.
- Deprecation notices: none required (expand-contract migrations, no
  removals in CONT track to date).
