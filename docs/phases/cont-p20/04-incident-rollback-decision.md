# CONT-P20 — 04 Incident / Rollback Decision (WS-20.4, DEL-03/04)

## Incident register (DEL-03)

**No open incidents.** No anomalies observed across P15 boot probe, P17
metrics probe, P20 synthetic probe (all clean, trees cleaned after).

## Rollback decision framework (DEL-04)

| Signal | Threshold | Action | Authority |
| --- | --- | --- | --- |
| SLO burn 75–100% | feature freeze | SRE |
| SLO 100% / security signal | revert-by-commit + `rollout undo` + migration downgrade | SRE, no further gate |
| Synthetic 3-strike | `alert-on-failure.sh` → on-call | auto + SRE |
| Spend/quota breach | loop hard-stop cards (Wave 1) | automatic |
| Adversarial bypass in pilot | pause autonomy, re-run red-team | AI Safety Lead |

**Rollback decision @ close: NO ROLLBACK — nothing deployed beyond probes;
RC v0.2.0 stands authorized for pilot staging.**
