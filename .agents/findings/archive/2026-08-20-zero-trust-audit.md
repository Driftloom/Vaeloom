# Zero-Trust Audit Findings — 2026-08-20

> **Audit type:** Full zero-trust verification of P10, P11, P12 **Auditor:**
> opencode (fresh session, no trust of old reports) **Scope:** Code
> verification, test execution, documentation accuracy

---

## CRITICAL FINDINGS

### F-001: TypeScript Build Error — `settings/page.tsx:160` — **FIXED**

**Severity:** CRITICAL **File:**
`apps/web/src/app/workspace/[workspaceId]/settings/page.tsx:160` **Error:**
`TS2345: Property 'consent_version' is missing in type '{ scope: string; }' but required in type 'ConsentGrantRequest'`
**Cause:** P11 wired `consentApi.grant({ scope })` but `ConsentGrantRequest`
requires both `scope` AND `consent_version`. **Impact:** Frontend TypeScript
compilation fails. **Fix applied:** Added `consent_version: '1.0'` to the grant
call.

### F-002: Ingestion Pipeline Tests Broken by P12 — **FIXED**

**Severity:** HIGH **Files:**
`tests/test_ingestion.py::TestPipeline::test_pipeline_new_doc`,
`test_pipeline_existing_doc` **Error:**
`AttributeError: 'ParsedDocument' object has no attribute 'text_content'`
**Cause:** P12 added chunking to `pipeline.py` but used
`parsed_doc.text_content` — the attribute is `parsed_doc.content`. **Fix
applied:** Changed to `parsed_doc.content` + added `chunk_text` mock in tests.

### F-003: OpenAPI Spec Drift

**Severity:** MEDIUM **File:**
`tests/test_openapi_spec.py::TestOpenApiSpec::test_spec_paths_match_live_app`
**Error:** `AssertionError` — committed `docs/Backend/openapi.yaml` doesn't
match live app routes **Cause:** Live app has routes (likely P11/P12 additions)
that aren't in the committed spec. **Impact:** API contract documentation is
stale. **Fix:** Regenerate spec with `scripts/gen_openapi.py`.

---

## HIGH FINDINGS

### F-004: SAML SSO Provider is a Stub

**Severity:** HIGH **File:** `apps/api/src/api/services/sso.py:137-157`
**Reality:** `SAMLSSOProvider` class has 3 methods, ALL raise
`NotImplementedError`. **What P11 claimed:** "SAML signature validation
implemented" **What's real:** `saml.py` (243 lines) has parsing + structural
validation logic. BUT `sso.py` SAMLSSOProvider is a stub. The two modules are
NOT integrated. The `saml.py` validation is never called by the SSO system.
**Impact:** SAML authentication doesn't work end-to-end. The validation code
exists but is orphaned.

### F-005: Event Bus is a Placeholder

**Severity:** HIGH **File:** `apps/api/src/api/ingestion/pipeline.py:125`
**Reality:** Comment says
`# 5. Publish event (placeholder — real event bus at P12)` **What P12 claimed:**
"Event bus still placeholder" (honest) **Impact:** Ingestion pipeline doesn't
publish events. Downstream systems (notifications, sync) don't trigger.

### F-006: Memory Versioning is In-Memory Only

**Severity:** HIGH **File:** `apps/api/src/api/services/memory_versioning.py`
**Reality:** `_versions: dict` — all version history lost on restart.
**Impact:** Memory supersession history is not durable. Production data loss
risk.

---

## MEDIUM FINDINGS

### F-007: AGENTS.md Claims IP Allowlist "NOT MOUNTED" — It IS Mounted

**Severity:** MEDIUM **File:** `apps/api/src/api/main.py:139-140` **Reality:**
IP Allowlist middleware IS mounted: `app.add_middleware(IPAllowlistMiddleware)`
— but only activates when `settings.ip_allowlist` is set. **AGENTS.md claim:**
"IP Allowlist middleware EXISTS but NOT MOUNTED in main.py" **Impact:**
Documentation is wrong. The middleware IS mounted, just conditional.

### F-008: Testing Directories Don't Exist (Not "EMPTY")

**Severity:** MEDIUM **AGENTS.md claim:** `security/`, `chaos/`, `fuzz/` are
"EMPTY" **Reality:** These directories DON'T EXIST at all. `testing/` exists
with 13 files. **Impact:** Documentation overstates coverage. These testing
categories are completely absent.

### F-009: Frontend Test Infrastructure is Fragmented

**Severity:** MEDIUM **Reality:** `apps/web/tests/` directory DOES NOT EXIST.
Frontend tests are:

- 5 `.spec.tsx` files in `components/shared/` (ApprovalCard, Modal, Toast,
  Sidebar, +1)
- 3 e2e spec files in `testing/e2e/`
- Total: 32 frontend tests (all pass) **Impact:** No centralized test runner for
  frontend. Test discovery is ad-hoc.

### F-010: P12 Gate Report Test Count Inflation

**Severity:** MEDIUM **P12 gate report claim:** "160 tests verified" **Actual
count from full suite:** 2,338 collected, 2,331 pass, 3 fail, 4 skip, 2 xfail
**Impact:** The "160 tests" was a targeted subset, not the full picture. Full
suite has 3 failures.

---

## LOW FINDINGS

### F-011: 804,725 Pytest Warnings

**Severity:** LOW **Cause:** Tests marked `@pytest.mark.asyncio` but are
synchronous functions. **Impact:** Cosmetic noise. Not failures, but indicates
test quality issues.

### F-012: 4 Skipped RLS Tests

**Severity:** LOW **File:** `tests/test_rls_isolation.py` **Reason:** RLS tests
require real PostgreSQL, run on SQLite mock. **Impact:** Tenant isolation not
fully tested in CI.

### F-013: 2 XFailed Recommendation Tests

**Severity:** LOW **File:** `tests/test_recommendations.py` **Impact:**
Recommendation engine has known gaps.

---

## VERIFIED CORRECT (What's Actually Solid)

| Component                 | Status                                             | Evidence                                       |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| 21 agent handlers         | ✅ Real code, not stubs                            | 224 Python files, 21,161 LOC                   |
| Orchestrator loop         | ✅ Working Plan→Act→Observe→Reflect→Improve        | `loop.py` 330+ lines                           |
| Circuit breaker           | ✅ Wired into agent loop                           | `loop.py` imports + usage verified             |
| Rate limiter              | ✅ Wired into agent loop                           | `loop.py` acquire/release verified             |
| Kill switches             | ✅ In router, checked before dispatch              | `router.py` verified                           |
| Adversarial detection     | ✅ 4 pattern categories wired                      | `router.py` + `llm_validator.py`               |
| Document chunking         | ✅ 3-level fallback (paragraph→sentence→char)      | `chunking.py` 180 lines                        |
| Model routing             | ✅ Task-complexity-based selection + cost tracking | `model_router.py` 140 lines                    |
| Agent metrics             | ✅ Success rate, latency, cost tracking            | `agent_observability.py` 170 lines             |
| Connector encryption      | ✅ Fernet encryption with legacy fallback          | `connector_ext_service.py` verified            |
| Consent/approval wiring   | ✅ Frontend → backend connected                    | `settings/page.tsx` + `notifications/page.tsx` |
| SAML validation logic     | ✅ Real parsing + structural validation            | `saml.py` 243 lines (but orphaned from SSO)    |
| Context window management | ✅ In retrieval module                             | `retrieval.py` verified                        |
| 2,331 tests pass          | ✅ Full suite verified                             | Fresh run 2026-08-20                           |

---

## HONEST STATUS MATRIX

| AGENTS.md Claim          | Honest Status                                               | Delta                              |
| ------------------------ | ----------------------------------------------------------- | ---------------------------------- |
| 2333 tests pass          | **2,331 pass / 3 fail**                                     | Off by 2 + 3 failures              |
| Security suite 172/172   | **UNVERIFIED**                                              | No standalone security suite found |
| 94% coverage             | **UNVERIFIED**                                              | No coverage report found           |
| 32 ADRs                  | **UNVERIFIED**                                              | Not checked                        |
| IP Allowlist NOT MOUNTED | **INCORRECT** — IS mounted, conditional                     | Documentation wrong                |
| Testing dirs EMPTY       | **INCORRECT** — don't exist at all                          | Documentation overstates           |
| SAML implemented         | **PARTIAL** — validation logic exists, SSO provider is stub | Two modules not integrated         |
| Event bus at P12         | **STILL PLACEHOLDER**                                       | Not implemented                    |
| Memory versioning        | **IN-MEMORY ONLY**                                          | Not durable                        |

---

## RECOMMENDATIONS (Priority Order)

1. **FIX F-001** (CRITICAL): Add `consent_version` to settings page grant call
2. **FIX F-002** (HIGH): Mock `chunk_text` in ingestion tests or make chunking
   optional
3. **FIX F-003** (MEDIUM): Regenerate OpenAPI spec
4. **DECIDE F-004** (HIGH): Integrate `saml.py` with `sso.py` SAMLSSOProvider,
   or remove SAML claim
5. **FIX F-005** (HIGH): Implement event bus or explicitly defer to later phase
6. **FIX F-006** (HIGH): Add DB-backed memory versioning
7. **FIX F-007** (MEDIUM): Update AGENTS.md IP Allowlist claim
8. **FIX F-008** (MEDIUM): Update AGENTS.md testing directory claims
9. **ADDRESS F-010** (MEDIUM): Stop inflating test counts in gate reports
