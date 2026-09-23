# Error Contract (RFC 7807 Gap) + Unversioned Infra Paths

> **Status:** CUTOVER COMPLETE 2026-09-23 — all error responses serve
> `application/problem+json` (handlers + all 15 middleware denials + 422; legacy
> `detail` keys preserved; web client parses bodies via `res.json()` regardless
> of content-type). 294/294 spec ops declare the media type. **Last verified:**
> 2026-09-23. **Sibling:** [pagination-standard.md](./pagination-standard.md).

## 1. Current error shapes (runtime truth, 2026-09-21)

Three different shapes are emitted today. This is the honest baseline — the
OpenAPI spec regenerated alongside this doc mirrors runtime and therefore still
shows these shapes.

### 1a. Unified app envelope (most errors) ✅ intended default

`middleware/exception_handler.py:13-24` (`unified_exception_handler`, wired at
`main.py:368` for all `StarletteHTTPException`):

```json
// HTTP 4xx/5xx raised via HTTPException
{
  "success": false,
  "error": { "code": 404, "message": "Session not found", "details": null }
}
```

`generic_exception_handler` (`exception_handler.py:27-41`) uses the same
envelope for unhandled 500s, adding `correlation_id` only in debug mode.

### 1b. Rate-limiter 429s bypass the envelope ⚠️ known inconsistency

`middleware/rate_limit.py:167-171,187-191` returns `JSONResponse` directly from
middleware, so it never passes through the unified handler:

```json
// HTTP 429 — body; Retry-After header carries the backoff
{ "detail": "Rate limit exceeded" }
```

The regenerated OpenAPI spec documents exactly this shape (+ `Retry-After` and
`X-RateLimit-*` headers) on 292/294 operations — spec matches runtime.
`docs/backend/Rate-Limiting.md:100-109` additionally shows a third variant
(`{"error": {"code": "RATE_LIMITED", "message": ..., "retry_after": ...}}`) that
matches NEITHER runtime path — that doc section is aspirational/drifted and is
folded into the migration target below, not fixed here.

### 1c. FastAPI validation 422s use the framework default ⚠️

Request-validation failures return FastAPI's built-in shape (`{"detail": [...]}`
referencing `HTTPValidationError` in the spec), not the 1a envelope. Same for
the Temporal-unavailable 503 (`main.py:379-382`:
`{"detail": ..., "error": ...}`).

## 2. Target: RFC 7807 `application/problem+json`

```json
// HTTP 429 — target shape (example)
{
  "type": "https://docs.vaeloom.dev/problems/rate-limited",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Rate limit exceeded for POST /api/v1/chat (20/min).",
  "instance": "/api/v1/chat",
  "retryAfter": 30,
  "correlationId": "9f3a…"
}
```

Required fields per problem: `type` (stable URI per error kind), `title`,
`status`, `detail`, `instance` (request path); Vaeloom extension:
`correlationId` (always; today's handlers only emit it in debug mode).

## 3. Migration path (explicitly NOT done here — honest scoping)

Migrating runtime errors is a cross-cutting change: every frontend error parser
(which keys on the 1a envelope and on `detail` arrays), every agent tool error
branch, and the 233-test security suite assert on current shapes. Doing it
inside a "no runtime change" hardening pass would break the frontend and
invalidate the test baseline. Staged plan:

1. **Phase 0 (this change):** gap inventoried here; spec mirrors runtime.
2. **Phase 1 — dual-serve (opt-in):** add content negotiation — requests with
   `Accept: application/problem+json` receive the §2 shape from all three
   emitters (1a/1b/1c unified through one `problem()` constructor); default
   stays current shapes. No client breaks.
3. **Phase 2 — Sunset the legacy shapes** per
   [API-Versioning.md](./API-Versioning.md) (`Deprecation` + `Sunset` headers,
   6+6mo), frontend and agents migrated.
4. **Phase 3 — default flip:** `problem+json` becomes the default; legacy shapes
   removed; `Rate-Limiting.md` 429 example corrected to match.

## 4. Unversioned infra paths — why they bypass `/api/v1`

These paths are intentionally NOT under `/api/v1` (code refs are
`apps/api/src/api/main.py`):

| Path                                              | Defined                                            | Why unversioned                                                                                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`, `/health/ready`, `/health/startup` | `main.py:425` (`health.router`, prefix `/health`)  | Liveness/readiness probes from load balancers and k8s must succeed without auth and must NOT break on an API major-version bump — versioning a probe endpoint risks taking healthy hosts out of rotation during migration.                          |
| `GET /csrf-token`                                 | `main.py:384`                                      | Bootstraps CSRF protection itself: the SPA fetches the double-submit token before any authenticated `/api/v1` call. Versioning/auth-gating it would be circular (auth middleware lists it in `PUBLIC_PATHS`; CSRF middleware skips `/api/v1/auth`). |
| `GET /metrics`                                    | `main.py:406` (Prometheus `Instrumentator.expose`) | Scraped by Prometheus, not by API clients; Prometheus scrape configs target a fixed path. A `/v1` → `/v2` rename would silently stop metrics collection.                                                                                            |
| `/docs`, `/openapi.json`, `/redoc`                | FastAPI defaults                                   | Developer tooling, not product API surface; excluded from versioning by FastAPI convention.                                                                                                                                                         |

Rule of thumb: **`/api/v1` versions the product API consumed by clients; infra
endpoints are consumed by the platform (probes, scrapers, browsers, docs
tooling) and stay version-independent.** If an infra endpoint ever gains
versioned semantics, it moves under `/api/v1` as a new endpoint — the
unversioned path is never repurposed.

Rate-limiting note (zero-trust parity): only `/health`, `/health/ready`,
`/docs`, `/openapi.json`, `/redoc` skip rate limiting
(`middleware/rate_limit.py:15`). `/csrf-token`, `/metrics`, and
`/health/startup` ARE rate-limited — the spec's per-operation `429`s reflect
exactly that.

## Related Documents

- [pagination-standard.md](./pagination-standard.md) — pagination standard +
  outliers
- [API-Versioning.md](./API-Versioning.md) — lifecycle + Sunset convention
- [Rate-Limiting.md](./Rate-Limiting.md) — limiter behavior (note §1b drift)
- [Authentication.md](./Authentication.md) — Bearer JWT flow
