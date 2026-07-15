# 15 — Security & Compliance (Enterprise upgrade)
### Read first: `mvp/15-security-compliance.md`. This file gates the whole enterprise folder's exit criterion (see `enterprise/00-master-build-order.md`) — do not treat it as "just another file."

## Objective
Full RBAC, enterprise SSO (already scaffolded in `enterprise/01`), formal GDPR/SOC2 readiness, and — the single most important thing in this entire folder — the consent model that lets an organization provision accounts without ever gaining unconsented access to an individual's memory.

## The consent model (implement this first, and most carefully)
- An organization (tenant) can provision accounts for its population and set **policy** boundaries (allowed connectors, retention windows, ABAC rules from `enterprise/11`).
- An organization **cannot** read an individual member's memory contents without that individual's **explicit, granular, revocable** consent.
- Consent is scoped (e.g. "share my application status with my university's career office" is a different grant than "share my full resume history") — never an all-or-nothing switch.
- Revoking consent **stops future access**; it does not retroactively grant or erase what was already (consensually) seen — be explicit about this distinction in both the implementation and the user-facing copy, since it's a common point of confusion and a real trust risk if handled ambiguously.
- Write this as an adversarial test suite first: a tenant admin attempting to read a member's memory with no consent grant, with a revoked grant, and with a properly scoped grant that doesn't cover the specific data being requested — all three must behave correctly before this feature is considered built at all.

## Requirements
- **Full RBAC:** roles beyond MVP's basic auth (tenant admin, tenant member, individual account, plus any needed for internal ops) with permission checks enforced at the same Permission Engine point as everything else in this project — no parallel authorization system.
- **SSO completion:** wire the SAML/OIDC scaffold from `enterprise/01` fully into the RBAC model.
- **GDPR readiness:** right to access (extends MVP's export), right to erasure (extends MVP's delete-everything), right to rectification (a user can correct a memory record and have that correction properly versioned per `enterprise/04`), data processing agreements as a business/legal deliverable this engineering work needs to support, not generate itself.
- **SOC2 readiness:** formal access control documentation, change management process, and the audit retention from `enterprise/12` — largely process and documentation on top of what's already built, not new engineering surface.
- **Regional data residency:** support at least EU, US, and India data regions (matching the initial target markets) — a tenant's data physically stored in their required region, not just logically tagged.

## Out of scope
Nothing — this file has no deferred scope. If something here seems too big to finish, that's a signal to slow down and get it right, not a signal to cut it.

## Acceptance criteria
- [ ] The consent adversarial test suite (no consent / revoked consent / improperly-scoped consent) passes with zero unauthorized access in every case.
- [ ] A full third-party penetration test, scoped specifically to tenant isolation and the consent model, is performed and all critical/high findings are resolved before any real enterprise design partner is onboarded.
- [ ] GDPR export/erasure/rectification all work correctly and are tested end to end.
- [ ] Data for a tenant configured to the EU region is verifiably stored in EU infrastructure.
