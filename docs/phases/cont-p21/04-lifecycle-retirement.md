# CONT-P21 — 04 Lifecycle / Retirement Plan (WS-21.5, DEL-04)

## Retired this phase (phase rule satisfied: zero consumers + evidence + approval)

- **`version:` top-level key in `docker-compose.yml`** — obsolete per Compose
  Spec (warning on every invocation), zero consumers (ignored field),
  evidence: `config --quiet` exit 0 post-removal, warning gone. Retired with
  comment marker. No other compose file carries it (verified repo-wide).

## Retirement candidates assessed (NOT retired — conditions unmet)

| Candidate | Verdict | Reason |
| --- | --- | --- |
| Custom runner 0002–0009 | KEEP (fix, don't retire) | still the SQLite fallback path; STAB-01 owns the fix |
| FileStateStore fallback | KEEP by design | Composite→File durability tier |
| `require_signature=False` SAML path | ALREADY REMOVED (P13) | — |
| `commonLabels` | DEFER (DEBT-11) | warning-only; mass edit risk > benefit now |
| Legacy docs superseded | DEFER to parallel session | collision avoidance; MAP tracks supersession |

## Lifecycle policy (standing)

Retire only with: zero consumers (grep-proven) + archived evidence + export
where data-bearing + gate approval + communication note. This file is the
register.
