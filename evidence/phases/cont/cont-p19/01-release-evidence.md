# CONT-P19 — 01 Release Evidence / Approvals (WS-19.1, DEL-01/02)

## Release candidate pin (v0.2.0)

| Attribute | Value |
| --- | --- |
| Version | `0.2.0` (`config.service_version` == `pyproject.version` — consistent) |
| Commit | `eed07107` + this phase commit |
| OpenAPI | 162 paths, v0.2.0, parses |
| Migrations | 42 files, head `0042_users_tenant_id`, downgrade/reapply proven |
| Kustomize | 4/4 builds (base 98, prod 100) |
| SBOM/provenance | CI steps (Syft/cosign) + prompt sha256 lineage + commit chain |

## Go-no-go (DEL-02)

| Gate | Verdict |
| --- | --- |
| P12 agent/model/retrieval/memory 96.16 + 96.1 re-sign | GO |
| P13 security uplift 96.49 (SAML closed) | GO |
| P14 testing/certification 96.91 | GO |
| P15 capacity/DR 95.72 | GO (thinnest margin, owned) |
| P16 platform/delivery 96.47 (deploy path restored) | GO |
| P17 observability 96.73 (live /metrics) | GO |
| P18 documentation 96.65 (ADR index) | GO |
| Waves 0-5 harness ceilings | GO (all gated) |
| Security posture | red-team 0/18, noauth 105/105, judge 1.0 |
| Open defects | all owned (registers P12→P18); zero mandatory blockers |

**Release verdict: GO — candidate v0.2.0 authorized for pilot staging
(pending BQ-05 sponsor).**
