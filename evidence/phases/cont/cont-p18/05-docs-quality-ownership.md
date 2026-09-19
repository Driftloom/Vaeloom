# CONT-P18 — 05 Docs Quality / Ownership (WS-18.5, DEL-05)

## Quality gates (verified present @ HEAD)

- `docs-validate.yml`: Vale prose lint + markdownlint-cli2 + lychee link
  check + custom validation block — CI-authoritative (binaries absent
  locally; no local forgery).
- New `docs/adr/README.md`: all 44 relative links resolve to existing files
  (generated from directory listing — mechanically sound).

## Ownership (DEL-05)

| Area | Owner | Cadence |
| --- | --- | --- |
| ADRs + index | Architecture (Platform Eng) | at-merge update |
| API contract | Engineering (generator-owned `openapi.yaml`) | per-route change |
| Operations/runbooks | SRE | per-incident review |
| Phase evidence | QA (frozen at gate — do not modify) | immutable |
| DOCUMENTATION-MAP | parallel session (in flight) | coordinate, don't collide |

## Coordination note

Parallel session holds uncommitted edits to `DOCUMENTATION-MAP.md`,
`02-system-architecture.md`, `03-agent-workflow.md`,
`04-memory-knowledge-graph.md`, `agent-inventory.md`, `AI-Agents.md`,
`Authentication.md`, `Authorization.md`, `Connectors.md`,
`Frontend-Architecture.md`, `ATS-Scoring.md`, `Security-Architecture.md`,
`temporal/catalog.md` — this phase deliberately avoided all of them.
