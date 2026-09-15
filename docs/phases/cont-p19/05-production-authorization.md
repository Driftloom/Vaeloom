# CONT-P19 — 05 Production Authorization (WS-19.5, DEL-05)

## Authorization decision

**Candidate v0.2.0 is AUTHORIZED for pilot staging ONLY.** Enterprise launch
/ all-tenant cutover is NOT authorized (requires CONT-P20 sponsored-pilot
validation + BQ-05/BQ-06 stakeholder decisions).

## Authorization boundaries

- Allowed: pilot-staging deploy to a bounded tenant/cell with sponsor,
  shadow-first traffic, per-tenant flags, rollback window, exit rights.
- Prohibited: production traffic without sponsor; silent permission
  expansion; unverified dual writes; any claim of production-ready/
  certified/compliant beyond the gated evidence in this track.
- Rollback authority: SRE may revert-by-commit + `rollout undo` + migration
  downgrade (all rehearsed) without further gate on SLO breach or security
  signal.
