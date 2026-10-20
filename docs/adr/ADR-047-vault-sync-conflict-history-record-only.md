# ADR-047: Vault-sync conflict resolution is record-only; reports merge a device registry

- **Status:** Accepted
- **Date:** 2026-10-18
- **Supersedes:** nothing
- **Affects:** `apps/api/src/api/routers/vault_sync.py`, `apps/api/src/api/models/schema.py`, `apps/api/alembic/versions/0070_vault_sync_conflict_history.py`, `apps/web/src/components/memory/VaultSyncPanel.tsx`, `apps/web/src/lib/api-client.ts`, `apps/api/tests/test_vault_sync.py`

## Context

**1. Resolutions left no durable record.** The active conflict ledger exists
only inside `connector.config["conflicts"]` (JSON): `VaultClientConflict` is
`{id, file, conflict_file, local_head, remote_head, detected_at}`. There is no
conflicts table. Resolving filtered the JSON entry out in place, and the next
client `report` replaces the whole ledger anyway — so once the queue drained,
there was no evidence anywhere that a conflict had ever existed or how it was
resolved. The UI could not offer history, and a stale client re-report could
resurrect a conflict the user had already adjudicated.

**2. Machines were a single slot.** `report` overwrote one scalar `machine`
plus shared timestamps. A workspace syncing from two machines could only ever
show the last reporter; "which devices sync this workspace" was unanswerable
and would have to be answered with a fabricated "current device" claim.

## Decision

**The server records conflict resolutions; it never applies them. The report
merges what each machine says instead of overwriting a single slot.**

### Conflict history (migration 0070)

- New table `vault_sync_conflict_history` (one workspace-scoped connector per
  workspace): `ENABLE` + `FORCE` RLS + workspace policy following the
  0067–0069 pattern; `downgrade()` is the exact reverse of `upgrade()`; the
  migration ends with the carried-forward `_assert_schema_wide_coverage` tail
  (literal `incomplete RLS coverage`).
- `POST /vault-sync/conflicts/{conflict_id}/resolve` — the path param is the
  **client** conflict id, never the server history row id. Insert-once by
  `(connector_id, conflict_id)`; **first-wins**: a re-resolve never mutates the
  recorded row and the response echoes the originally recorded `resolution`
  (`keep-local` | `accept-incoming`). The active-ledger removal happens in the
  same transaction.
- Copy contract: "resolution recorded — local client applies on next sync".
  The daemon owns application; claiming the server applied it would be false.
- `GET /vault-sync/conflicts/history?workspace_id=&limit=&offset=` →
  `{items, total}` (total before pagination), tenant-scoped like its siblings.

### Device registry (no migration)

- `report` upserts `cfg["devices"][machine] = {client_version, last_heartbeat,
  status, last_pull_time, last_push_time, last_error}`; a missing machine
  stores under `"unknown"`. Top-level `machine`/timestamps remain an alias of
  the latest reporter (back-compat).
- Re-reported entries already present in history are filtered, so a stale
  client cannot resurrect an adjudicated conflict.
- `GET /vault-sync/status` derives `devices[]` from the registry, sorted by
  `last_heartbeat` desc, reusing the top-level status domain
  (`in_sync|conflict|syncing|error`); all existing fields kept.
- The frontend labels the latest reporter **"last reported"**, never
  "current" — a browser cannot know which machine is live.

## Consequences

**Additive for first-party callers.** The frontend was updated in the same
change; `devices` is a new response field and the history endpoint is new.
Third-party consumers reading `status` keep every existing field.

**Honest failure modes.** With the API down, the panel shows its designed
`ErrorState` + "Request sync" (verified by the required e2e spec and the live
outage drill); "Request sync" renders the router's `executed:false` shape —
the server records the request, it does not run git.

**Known gaps, deliberately not solved here.** The AI tool `sync_vault`
historically fabricated sync state around this router; that was removed in the
same overhaul (it now mirrors the router's request-recorder shape). The
active ledger is still JSON-only — history covers adjudicated conflicts, not
unresolved ones; surfacing unresolved conflicts as rows would be a future
decision, not this one.

## Verification

- `apps/api/tests/test_vault_sync.py` — 27 tests incl. negative controls:
  resolve→history roundtrip, re-resolve does not duplicate or mutate, resolved
  conflict does not resurrect on re-report, cross-tenant isolation (exact
  codes), two machines → both retained with the latest marked.
- `pnpm verify:pg` — apply → isolate → rollback against a disposable pg16
  (PASSED 2026-10-18; the downgrade probe refuses when a row's type only a
  temporary pack allows).
- Live evidence: seeded two-machine vault rig with real conflicts
  (Scenario 6, `wave3-s6-vault-panel.png`), outage drill across six memory
  routes + panel (`wave3-v1-*-apidown.png`), required e2e
  `apps/web/e2e/memory-honesty.spec.ts` (vault error + retry).
