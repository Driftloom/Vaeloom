# Pagination Standard

> **Status:** Standard declared; runtime NOT yet migrated (contract-only
> change). **Last verified:** 2026-09-21 — audited against
> `apps/api/src/api/routers/*.py`. **Companion:**
> [error-contract.md](./error-contract.md) (error-shape gap + unversioned infra
> paths).

## 1. The standard

- **List endpoints use `limit` + `offset`** for bounded collections, and a
  **cursor** (`since_*` / opaque cursor) for append-only / sync feeds.
- `limit`: `ge=1, le=100` (sync feeds up to `le=500` where already established).
- `offset`: `ge=0`, default `0`.
- Cursors are opaque strings the client passes back verbatim; servers MUST NOT
  require clients to construct cursor values (HLC timestamps are an accepted
  cursor form for CRDT/sync feeds).
- Response envelope for paged lists: `{items, total, limit, offset}` or, for
  cursor feeds, `{items, next_cursor}`. (Exact envelope key unification is part
  of the migration in §4 — see honest scoping.)

Rationale: `limit`/`offset` composes with filtering/sorting without the
page-drift anomalies of `page`-numbering under concurrent writes, and cursors
are the only correct choice for sync feeds. One convention also keeps the
OpenAPI spec and frontend data-fetching hooks (`transformKeys` + SWR) uniform.

## 2. Current-state audit (2026-09-21, runtime unchanged)

### 2a. Already on the standard ✅

| Router (file:line)                    | Params                                                            |
| ------------------------------------- | ----------------------------------------------------------------- |
| `cognition.py:74-75`                  | `limit` (50, ≤100) + `offset` (0)                                 |
| `documents.py:212-213` (search)       | `limit` (50, ≤100) + `offset` (0)                                 |
| `connectors.py:200-201`               | `limit` (300) + `offset` (0)                                      |
| `sovereignty.py:247-251` (delta pull) | `limit` (100, ≤500) + `since_hlc` cursor                          |
| `recommendations.py:34`               | `limit` (20, ≤100, no offset — bounded top-N)                     |
| `gmail.py:82`                         | `max_results` (20, ≤100 — upstream Gmail API naming, intentional) |

### 2b. Outliers — `page` / `page_size` (to be deprecated, NOT changed here) ⚠️

Frontend compatibility forbids renaming these query params at runtime (the web
client sends `page`/`page_size` today). They keep working; the plan in §4
migrates them behind a Sunset window.

| Router (file:line)                                   | Params                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `applications.py:31-32`                              | `page` (1) + `page_size` (20, ≤100)                                                                              |
| `admin_console.py:22-23`, `admin_console.py:306-307` | `page` + `page_size` (20, ≤100); internally already converts to `limit`/`offset` (`admin_console.py:37,326,342`) |
| `audit.py:37-38`                                     | `page` + `page_size` (20, ≤100)                                                                                  |
| `notifications.py:35-36`                             | `page` + `page_size` (20, ≤100)                                                                                  |
| `scheduler.py:45-46`                                 | `page` + `page_size` (20, ≤100)                                                                                  |
| `iam.py:25-26`                                       | `page` + `page_size` (20, ≤100)                                                                                  |
| `agents.py:561-562`, `agents.py:637-638`             | `page` + `page_size` (20, ≤100)                                                                                  |
| `plugins.py:35-36`, `plugins.py:131-132`             | `page` + `page_size` (20, ≤100)                                                                                  |
| `memory.py:89-90`                                    | `page` + `page_size` (25, ≤100)                                                                                  |
| `knowledge_graph.py:102-103`, `:225-226`, `:246-247` | `page` + `page_size` (20, ≤100)                                                                                  |
| `marketplace.py:41-42`                               | `page` + `page_size` (50, ≤100)                                                                                  |
| `connectors.py:148-149` (list)                       | `page` + `page_size` (20, ≤100)                                                                                  |
| `documents.py:177-178` (list)                        | `page` + `page_size` (20, ≤100)                                                                                  |
| `schemas/approval.py:43-44`                          | `page` / `page_size` response fields                                                                             |

## 3. What this change does (and does not) do

- DOES: declare the standard, inventory every outlier with file:line evidence,
  define the deprecation mechanism (§4).
- DOES NOT: rename any runtime query param, change any default, alter any
  response envelope — zero frontend breakage. The OpenAPI spec regenerated
  alongside this doc still shows `page`/`page_size` on the outlier endpoints,
  which is correct: the spec mirrors runtime.

## 4. Deprecation plan (Sunset-header convention)

Follows the lifecycle in [API-Versioning.md](./API-Versioning.md) (Deprecated →
Sunset → Retired, 6 + 6 months):

1. **Phase 0 (this change):** standard declared; outliers inventoried. No
   headers, no behavior change.
2. **Phase 1 — dual-accept:** each outlier endpoint accepts `limit`/`offset`
   (and `cursor` where applicable) _alongside_ `page`/`page_size`, serving
   identical results. OpenAPI documents both; `page`/`page_size` marked
   `deprecated: true`. Responses on legacy params carry: `Deprecation: true`,
   `Sunset: <date +12mo>`,
   `Link: <pagination migration note>; rel="deprecation"`.
3. **Phase 2 — sunset (+6mo):** legacy params still honored; no new features use
   them; frontend migrated to `limit`/`offset`.
4. **Phase 3 — retired (+12mo):** `page`/`page_size` removed from params and
   spec; requests using them get `410 Gone` with a migration link (per the
   versioning lifecycle), or `422` if the endpoint team prefers fail-loud
   validation — decided per-endpoint at migration time, not here.

`gmail.py` (`max_results`) is EXEMPT — it mirrors the upstream Gmail API
parameter name; renaming it would break the mental model, not fix one.

## Related Documents

- [API-Versioning.md](./API-Versioning.md) — Sunset/Deprecation header lifecycle
- [error-contract.md](./error-contract.md) — error-shape gap + infra paths
- [Rate-Limiting.md](./Rate-Limiting.md) — 429 + header contract
