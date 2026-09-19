# CONT-P19 — 02 Cutover / Migration / Rollback (WS-19.2, DEL-03)

## Rehearsal evidence @ HEAD

- Migration rollback: `test_migrations.py` **12/12** re-run this phase
  (downgrade rolls back, partial downgrade, reapply after downgrade,
  clean create_all) + `test_auth.py` **11/11** (contract stability).
- Deploy rollback: `kubectl rollout undo` step in deploy job (P16 verified);
  kustomize 4/4 builds (P16); app rollback = revert-by-commit (no stateful
  P13–P19 deltas except additive migrations, all downgrade-tested).
- Cutover pattern: expand-contract per-wave with per-tenant flags + shadow
  percent rollout (`agent_shadow_percent`, LangGraph shadow) — authority
  only after measurement (track mission).

## Pilot status (honest)

- **BQ-05/U-01: design-partner sponsor + window = REQUIRES_STAKEHOLDER_DECISION**
  (UNKNOWN since CONT-P02, carried non-blocking through research phases).
  Pilot execution is NOT_EXECUTED — readiness (this phase) is not a substitute
  for pilot evidence. Cutover to any tenant is PROHIBITED until CONT-P20
  validates a sponsored pilot (phase rule: bounded blast radius, exit rights,
  rollback window — criteria defined here, execution gated on sponsor).
