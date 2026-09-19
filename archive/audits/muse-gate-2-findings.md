# Muse Gate 2 — Findings (audit-first, fix-only-proven-defects)

**Policy:** each finding was reproduced at runtime BEFORE any fix. Fixes are
minimal and behavior-preserving for legitimate callers. Security regression
re-run after every fix.

## GATE2-F1 — Agent registry PUT/DELETE ignore tenant scope (P0, FIXED)

- **Impact:** any authenticated user could rewrite (`system_prompt` included) or
  deactivate ANY agent row: proven 200 with `description=PWNED` and 204
  deactivation cross-workspace; service layer had no tenant predicate at all, so
  cross-tenant writes were reachable wherever RLS does not backstop (dev default
  uses a superuser role; SQLite has no RLS). Violates handoff invariants #2/#3.
- **Reproduction:** `test_muse_gate2_registry_scope.py` (pre-fix: 200/204;
  post-fix: tenant-mismatch → 404).
- **Root cause:** `agent_service.update_agent/deactivate_agent` resolved rows by
  id only; router dropped the JWT tenant.
- **Fix:** tenant predicate threaded through (fail closed on mismatch AND on
  missing tenant for writes); router passes JWT tenant. Same-tenant shared
  registry semantics preserved (registry rows are tenant-scoped by design;
  `workspace_id` is NULL by construction — documented, not altered).
- **Verification:** 5 proof tests + 37-test agent suites green; Phase A 30/30
  green.

## GATE2-F2 — Direct agent execution ignores workspace binding + status (P1, FIXED)

- **Impact:** `POST /{agent_id}/run` + `/{agent_id}/execute` (unconditionally
  mounted) executed inactive agents (proven: 200) and honored caller-supplied
  `dto.input.workspace_id` without membership check (proven: foreign override
  accepted). No tool side effects on this path (LLM-only, output recorded) —
  disclosure + spend + policy bypass, not RCE.
- **Reproduction:** same file (pre-fix: 200/200; post-fix: 404/404 + positive
  control still 200).
- **Root cause:** no status predicate (error message claimed otherwise); BYOK
  workspace taken from caller input.
- **Fix:** deny unless `status == 'active'`; effective workspace = agent binding
  wins, else caller override must pass membership (404-safe); user-less daemon
  path unchanged (envelope auth governs there).

## GATE2-F3 — Approval lookup accepted swapped payloads (P0, FIXED last wave, RE-VERIFIED)

- **Impact (historical):** `_lookup_approval_internal` accepted any
  self-consistent row for any requested payload (reason-HMAC compared against
  the stored hash instead of the caller hash).
- **Re-verification this gate:** single-use consume, replay denial, swap denial,
  keyed-HMAC tamper skip, and legitimate-token-still-usable all proven at
  runtime (`TestScenarioConsequential`, 3 tests green).
- **Status:** CLOSED, no code change needed.

## GATE2-P2 observations (documented, not release-blocking)

1. **Tenant-less JWT widening:** `if tenant_id:` read filters go unfiltered
   without a tenant claim; RLS backstops PG. Writes hardened to fail closed
   (F1). Systemic auth cleanup out of gate scope.
2. **Conftest MockUUID vs live PG:** pytest model declarations render UUID binds
   as VARCHAR, so RAG-via-prod-factory always degrades in-process. Mitigated
   with injectable session factories + SQLite-hermetic tests.
3. **Singleton-shadow test hygiene:** bare `monkeypatch.setattr` on the
   `llm_service` singleton leaves shadowing `__dict__` entries (pytest restores
   by assignment). Hot spots converted to class-level patching; ~60 legacy sites
   remain (documented; suite green).
4. **`execute_code_sandbox` is bounded, not sandboxed:** same-host subprocess +
   substring blocklist (bypassable). Approval-gated + timeout + tmp-cwd.
   Overstated wording corrected in tool/agent descriptions. Residual risk
   accepted only behind approval.
5. **Card `card_max or settings` precedence:** a registered fallback card's
   default `max_react_rounds=5` overrides an explicit operator setting.
   Documented; operator guidance is to set per-card values.
6. **`execute_code_sandbox` blocklist bypassability** (same as 4, recorded here
   for the MCP/tool section): substring matching is not a security boundary; the
   approval gate is.
