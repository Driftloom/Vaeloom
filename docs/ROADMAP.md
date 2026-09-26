# Vaeloom Roadmap

> **Last updated:** 2026-09-15 — **Owner:** Product + Platform Current release:
> **0.2.0** (OpenAPI 254 paths / 315 ops, 44 ADRs, RLS 42/42). MVP track P00–P21
> complete; CONT track complete through P04; ENT track not started. Execution
> status lives in the 66-phase prompts overlay
> (`docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/EXECUTION-STATUS.md`).

## Next: SOC 2 Type I

- Freeze control narratives (access, change, backup, incident) against the
  `0.2.0` implementation: RLS 42/42 evidence, audit-log tamper detection,
  API-key rotation records, CSRF/IP-allowlist config.
- Close audit-owned gaps first: empty `testing/smoke|security|chaos|fuzz`
  suites, unmeasured coverage/WCAG/perf claims (EXC-P14-01..03, P15 owns).
- Auditor readiness review, then Type I report (design effectiveness).

## Then: ENT Track Evidence (ent-p00–p21)

- Wire ENT-track SAML (`services/saml.py`, real `signxml`) to the router or
  formally defer; promote RBAC from DI helper to enforced middleware (F-21).
- Execute the 22 ENT phases with gate reports, registers, and handoffs under
  `docs/phases/ent-pXX/` per the governing phase prompts.
- Graduate the 10 enterprise-gated routers behind `enterprise_routes_enabled`
  with per-router evidence.

## Then: Observability Enablement

- Remove the FastAPI 0.141.1 OTel shim (`.agents/findings/37`) on upgrade;
  confirm auto-instrumentation + `/metrics` + correlation IDs end to end.
- Turn Grafana dashboards (3 dashboards, 23 panels) and 9 alert rules into
  SLO-burn alerts tied to the published 99.9% target.
- Ship the pending release workflow (CI has api/frontend/docker/deploy, no
  release job) with SBOM/SLSA L2 attestation per release.

## Then: Mobile Audit Execution

- Execute `docs/MOBILE_AUDIT.md` findings against the React Native architecture
  (`docs/frontend/Mobile-Architecture.md`).
- Cover offline cache, push-notification, and biometric-auth paths in E2E
  (currently 60 e2e: 24 gating + 36 visual).
- Align mobile API usage with the versioned `/api/v1/` contract and the
  `transformKeys()` casing rule.

## Then: SOC 2 Type II

- Operate Type I controls for the observation window with continuous evidence
  (audit exports, retention runs, access reviews).
- Remediate any Type I exceptions; Type II audit (operating effectiveness).

## Non-Goals (this horizon)

- Rewriting frozen phase evidence (`docs/phases/`) or SHA-pinned prompts.
- New public API versions (`/api/v2/`) before ENT evidence lands.
