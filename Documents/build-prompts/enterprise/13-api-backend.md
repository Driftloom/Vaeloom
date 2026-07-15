# 13 — API & Backend Services (Enterprise upgrade)

## Read first
`mvp/13-api-backend.md`.

## Objective
Open the internal API from MVP into a real public API/SDK platform with webhooks, formal versioning, and tiered rate limits.

## Requirements
- **Public API:** expose a subset of MVP's internal endpoints (file 13) as a documented, authenticated public API — API keys scoped per-integration, distinct from user session auth, checked through the same Permission Engine.
- **Webhooks:** let external systems subscribe to Meridian events (extends the internal event bus from `mvp/05`) — e.g. `application.status_changed`, `memory.updated` — with signed payloads and retry-with-backoff delivery.
- **Versioning policy:** formal API versioning (e.g. `/v1/`, `/v2/`) with a documented deprecation policy — MVP's internal API had no external consumers to break; this one will.
- **Rate-limit tiers:** move from MVP's flat per-workspace limiting to tiered limits by plan/integration type, configurable per API key.
- **SDK generation:** generate typed client SDKs (TypeScript, Python at minimum) from the OpenAPI spec MVP already produces — this should be close to automatic given MVP's spec discipline.

## Out of scope
Changing the core resource model or Permission Engine enforcement point from MVP — this upgrade adds an external-facing layer on top, it doesn't restructure the internal API.

## Acceptance criteria
- [ ] A third-party test integration successfully authenticates with an API key and performs a scoped, permitted action, and is blocked from an out-of-scope one.
- [ ] A subscribed webhook correctly fires, with a valid signature, on a triggering event, and retries correctly on a simulated delivery failure.
- [ ] Calling a deprecated version still works but returns a documented deprecation warning header.
- [ ] Generated SDKs compile/import cleanly and successfully make a real call against a test environment.
