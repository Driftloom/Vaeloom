# ADR-025: Workload Identity for FastAPI Worker ↔ API / Connectors

| Metadata     | Value                                           |
| ------------ | ----------------------------------------------- |
| **Status**   | PROPOSED — design-only, GAP (implement P07/P11) |
| **Date**     | 2026-08-15                                      |
| **Deciders** | Engineering Team                                |
| **Owner**    | Security Architect                              |

## Context

NFR-16 requires **no user credentials** in workers/service contexts and
machine-to-machine auth (queue worker ↔ API, API ↔ connectors) via workload
identity, not user sessions. Inspection @ `6e8a7b4` (`01-source-register.md` §4,
Gaps row) found **no service-token/HMAC mechanism** in the backend — grep for
`service_token` / `service-token` / `X-Service-*` across `apps/api/src/backend`
returned zero hits. **Honest: nothing is implemented, nothing is verified —
design-only gap.**

## Decision

Adopt **workload identity via HMAC-signed service tokens** for worker ↔ API and
API ↔ connectors, extending the TypeScript `service-auth` pattern to Python.

- Issued service tokens scoped to the worker/connector role.
- HMAC request signing or short-lived bearer tokens; no user creds, no shared
  secrets committed to code.
- Align with RFC 9700 OAuth BCP (EXT-06, P08) on any OAuth-bearing path.

Design-only: no implementation exists at HEAD; no runtime capability claimed.

## Consequences

**Positive:** Satisfies NFR-16; a leaked credential is limited to a scoped
service identity; clean path for connectors without user sessions.

**Negative:** **Known gap** — until P07/P11 implementation, worker ↔ API and API
↔ connector machine auth is ungoverned (carried gap, `01-source-register.md` §4
Gaps); adds key-distribution and rotation machinery not yet present.

## Reversibility / Rollback

Yes — greenfield (nothing to remove); token scheme swappable before adoption.

## Verification (P07/P11)

Implement issuance/signing; verify workers carry no user creds, tokens are
scoped, rotation works (NFR-16; RFC 9700 alignment at P08).
