# ADR-046: Capabilities authorization is workspace-ownership, not role-based

- **Status:** Accepted
- **Date:** 2026-10-11
- **Supersedes:** nothing
- **Affects:** `apps/api/src/api/routers/capabilities.py`, `apps/api/tests/test_capability_authorization.py`, `apps/api/tests/test_github_skills_sync.py`

## Context

The capabilities subsystem had no privilege boundary on any mutation. Any
authenticated workspace member could create, enable, disable, delete and
dispatch capabilities. Three defects compounded it:

**1. An approval-gate bypass.** `POST /{cap_id}/test` called the tool executor
with `agent_scopes=[td.required_scope, "*"]`. The trailing wildcard made every
scope assertion inside `execute_tool` vacuous. `approval_gated_tools()` —
17 write-capable tools including `draft_email`, `send_slack_message`,
`move_file` and `execute_code_sandbox` — is enforced in the orchestrator loop
only, never inside the executor. A row naming a gated tool is trivially
creatable, because `POST /capabilities` deliberately permits shadowing a
built-in name for use as a policy row. The result was that any member could
invoke any approval-gated tool with an arbitrary payload and leave no approval
record.

**2. A silent workspace fallback.** `_verify_workspace_access` substituted the
caller's first workspace by `created_at` when `X-Workspace-Id` was absent. A
client that dropped the header acted on a workspace it never selected and
received a 200 proving it worked. A caller who owns two workspaces could not
tell from the response which one was used. The behaviour was deliberate and
documented — `test_sync_github_falls_back_to_the_users_own_workspace` existed
to make a future change visible.

**3. Unredacted credentials.** `config` is an unvalidated `JSONB` column
returned verbatim by `_serialize_cap` on every read path. The draft validator
itself reasons about `config["headers"]` and `config["env"]`, so those are
expected shapes, and in practice they carry bearer tokens.

## Decision

**The privilege boundary is workspace ownership, not a role.**

`workspaces.user_id` is real, enforced, already-authoritative data. A role is
not: `services.auth_service._create_jwt` does not place a `roles` claim in the
token, so every real user resolves to `user_level = 0`. Enforcing
`dependencies.require_role("editor")` on capability mutations would return 403
to every user in the product. `require_role` is currently used only by
`admin_console`, `iam` and `gdpr`, which sit behind
`enterprise_routes_enabled=False` and are largely dormant.

The alternative — adding role issuance to signup — would mint every new
account an admin-equivalent role, which is not a boundary.

### Applied rules

| Operation | Boundary | Why |
|---|---|---|
| `GET /capabilities`, `GET /{id}` | member | read |
| `POST /capabilities`, `PATCH /{id}` | member | workspace-scoped configuration |
| `DELETE /{id}` | **owner** | destructive |
| `POST /{id}/test` on a `tool` | **owner** | dispatches code in the API process |
| `POST /{id}/test` on skill/agent/plugin | member | validation only, executes nothing |
| `POST /sync-github` | **owner** | up to 200 outbound fetches |

### Other changes in scope

- The wildcard scope is removed. `execute_tool` receives only the tool's own
  declared scope.
- An approval-gated tool is refused with `status="approval_required"` and
  `executed=False` before dispatch.
- The owner check runs **before** the handler's `try` block. That handler ends
  in `except Exception`, which converts anything raised inside it into a 200
  with `status="error"` — an authorization failure raised there would be
  reported to the caller as success. This is a fail-open and is called out in a
  comment at the call site.
- A missing `X-Workspace-Id` returns 400 instead of guessing a workspace.
- Credential-bearing `config` keys are redacted on read. Writes still accept
  the real value, so an editor that echoes the redacted marker would corrupt
  the stored credential — noted as a follow-up, not solved here.

## Consequences

**Breaking.** A client that omits `X-Workspace-Id` now receives 400. The
frontend always sends it (`TenantMiddleware`), so no first-party caller
regresses. `test_sync_github_falls_back_to_the_users_own_workspace` asserted
the old behaviour and has been replaced by
`test_sync_github_without_workspace_header_fails_closed` plus a negative control
proving the route still works when the header is present.

**Deferred.** `require_role` remains the correct end state, but it needs role
issuance, a role store, and a token claim before it can gate a live route. That
is a prerequisite, not a follow-up: until it exists, `require_role` on a live
route is a denial of service. Tracked as a known gap.

Also deferred: a `no-permission` UI state in the capabilities views. A member
who is refused today sees a generic error toast, which is honest but not
actionable.

## Verification

`apps/api/tests/test_capability_authorization.py` — 11 tests, each with a
negative control in the opposite direction:

- gated tool refused; **non-gated tool still executes** (proves the gate is not blanket)
- member cannot dispatch, cannot delete, cannot run the sweep; **owner still can**
- member can still read and configure (proves the gate is not over-broad)
- foreign capability id returns 404 without disclosing the name
- nested, list-valued and header-shaped credential keys all redacted;
  non-secret keys round-trip
