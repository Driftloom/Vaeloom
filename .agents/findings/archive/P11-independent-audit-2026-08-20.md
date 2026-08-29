# P11 Independent Zero-Trust Audit — 2026-08-20

> **Method:** Fresh session. No trust of old reports. Every file read
> end-to-end. Every claim verified against actual code. Web-searched security
> guidance. Ran tests independently.
>
> **Baseline:** P11 commit `5c9049d` + P12 commit `22871b2` + uncommitted fixes
> **Previous gate scores:** 96/100 (original) → 82/100 (re-audit) → 96/100
> (post-fix)

---

## EXECUTIVE SUMMARY

P11's code is **real and functional**. Tests pass (285/285 targeted, 2341
collected). But I found **1 critical bug, 2 high-severity issues, and 4 medium
issues** that the previous audit missed or introduced during fixes.

**My gate score: 85/100 — CONDITIONAL PASS (2 critical fixes required)**

---

## WHAT P11 ACTUALLY CHANGED (git archaeology)

Commit `5c9049d` changed 11 files (+759/-78 lines):

| File                                | What Changed                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `services/saml.py`                  | +161 lines: signxml + structural fallback for SAML signature validation |
| `services/connector_ext_service.py` | +48 lines: Fernet encryption for connector `token_ref`                  |
| `lib/api-client.ts`                 | +47 lines: `approvalApi`, `postQuery`, memory fields                    |
| `notifications/page.tsx`            | +180 lines: ApprovalCard wiring to live API                             |
| `settings/page.tsx`                 | +48 lines: consent toggles with live state                              |
| `test_saml.py`                      | +18 lines: new test + constructor fixes                                 |
| `test_connector_ext_service.py`     | +6 lines: mock alignment                                                |
| `agents/README.md`                  | Updated from stale to current                                           |
| `orchestrator/README.md`            | Updated from stale to current                                           |

Post-P11, the previous session applied **uncommitted fixes** to 8 files. These
fixes are the current working tree state.

---

## FINDINGS

### P11-A001 — CRITICAL BUG: `connector.connector_type` AttributeError

**File:** `connector_ext_service.py:185` **Severity:** CRITICAL **Category:**
Bug

```python
logger.info("connector_sync_trigger", extra={"connector_id": str(connector_id),
    "connector_type": connector.connector_type})
```

**The Connector model has `type`, not `connector_type`.** The model
(`schema.py:146`): `type: Mapped[str] = mapped_column(String(50))`.

Every call to `trigger_sync` raises `AttributeError` on line 185, which is
caught by the broad `except Exception` on line 186, silently setting
`connector.status = "error"`.

**The test for this (`test_trigger_sync_exception`) passes** because it uses a
`MagicMock` connector that has `connector_type` as an auto-generated attribute.
The test tests the wrong thing.

**Impact:** `trigger_sync` always fails silently. Users see "error" status every
time they sync a connector.

**Fix:** Change `connector.connector_type` to `connector.type`.

---

### P11-A002 — HIGH: signxml NOT Installed

**File:** `pyproject.toml:40` **Severity:** HIGH **Category:** Security / Supply
Chain

`signxml>=4.0.4` is listed in `pyproject.toml` but is **not installed** in the
current Python environment. `import signxml` raises `ModuleNotFoundError`.

**Impact:** `_signxml_available()` returns `False`. SAML signature validation
falls through to either:

- `SAML_ALLOW_STRUCTURAL_FALLBACK=1` → structural-only (no crypto)
- Default → raises `SAMLValidationError` (safe but breaks SSO)

In production without the env var, SAML SSO will fail with an error. This is the
**safe** behavior (fail-closed), but it means SAML SSO is non-functional until
`pip install -e .` is re-run.

**Fix:** Run `pip install -e .` or `pnpm install` to actually install the
dependency.

---

### P11-A003 — HIGH: ConsentState TypeScript Type is Wrong

**File:** `api-client.ts:800-810` **Severity:** HIGH **Category:** Type Safety /
Frontend-Backend Contract

**Frontend declares:**

```typescript
interface ConsentRecord {
  scope: string;
  granted: boolean; // ← DOES NOT EXIST on backend
  granted_at?: string;
  revoked_at?: string | null;
  consent_version?: string; // ← DOES NOT EXIST on backend
}
```

**Backend actually returns (`/consent/me`):**

```json
{
  "id": "uuid",
  "user_id": "string",
  "tenant_id": "string|null",
  "scope": "string",
  "granted_at": "ISO-8601",
  "revoked_at": "ISO-8601|null",
  "ip_address": "string|null"
}
```

**Mismatches:**

| Field             | Frontend  | Backend        | Status               |
| ----------------- | --------- | -------------- | -------------------- |
| `granted`         | `boolean` | NOT SENT       | Frontend fabrication |
| `consent_version` | `string?` | NOT SENT       | Frontend fabrication |
| `id`              | MISSING   | `string`       | Frontend omission    |
| `user_id`         | MISSING   | `string`       | Frontend omission    |
| `tenant_id`       | MISSING   | `string\|null` | Frontend omission    |
| `ip_address`      | MISSING   | `string\|null` | Frontend omission    |

The settings page works **by accident** — it only accesses `scope` and
`revoked_at`, which happen to exist. TypeScript types are erased at runtime.

**Fix:** Align `ConsentRecord` to match the actual backend shape.

---

### P11-A004 — MEDIUM: Webhook Mass-Assignment via `setattr` Loop

**File:** `webhook_service.py:56-61` **Severity:** MEDIUM **Category:** Security

```python
for key, value in updates.items():
    if hasattr(webhook, key):
        setattr(webhook, key, value)
```

The `WebhookUpdate` model includes `active: bool | None`. Any workspace member
can call `PUT /webhooks/{id}` with `{"active": false}` to disable another user's
webhook. The `setattr` loop also allows overwriting `tenant_id` if it were ever
added to the update model.

**Mitigation:** The Pydantic model limits which fields can be set. But `active`
being settable is a real concern.

**Fix:** Use an allowlist of updatable fields instead of `hasattr` check.

---

### P11-A005 — MEDIUM: `_decrypt_config` Silently Swallows Exceptions

**File:** `connector_ext_service.py:158-164` **Severity:** MEDIUM **Category:**
Data Integrity

```python
try:
    config[field] = self._decrypt_credential(config[field])
except Exception:
    logger.warning("Failed to decrypt connector config field %s — may be legacy plaintext", field)
```

When decryption fails, the field **remains encrypted** in the returned config.
The caller (`get_decrypted`, `test_connection`) will receive a config with
partially-encrypted values and no indication of failure. Downstream code may
attempt to use encrypted values as plaintext.

**Fix:** Raise the exception or set the field to `None` with a clear error.

---

### P11-A006 — MEDIUM: `except (Exception, XMLParseError)` Dead Code

**File:** `saml.py:148` **Severity:** LOW **Category:** Code Quality

```python
except (Exception, XMLParseError) as exc:
```

`XMLParseError` is a subclass of `Exception`. The tuple ordering means
`XMLParseError` is unreachable — `Exception` always matches first. This is dead
code, not a security issue.

---

### P11-A007 — MEDIUM: Dead Imports in webhook_service.py

**File:** `webhook_service.py:12,15` **Severity:** LOW **Category:** Code
Quality

`update` (line 12) and `settings` (line 15) are imported but never used.

---

## TEST RESULTS (Independent)

| Subset                          | Tests   | Result           |
| ------------------------------- | ------- | ---------------- |
| test_saml.py                    | 12      | 12/12 PASS       |
| test_connector_ext_service.py   | 34      | 34/34 PASS       |
| test_webhooks.py                | 15      | 15/15 PASS       |
| test_orchestrator.py            | 58      | 58/58 PASS       |
| test_circuit_breaker.py         | 15      | 15/15 PASS       |
| test_encryption.py              | 8       | 8/8 PASS         |
| test_approval.py                | 8       | 8/8 PASS         |
| test_consent.py                 | 8       | 8/8 PASS         |
| test_audit.py                   | 13      | 13/13 PASS       |
| test_gdpr.py                    | 7       | 7/7 PASS         |
| test_memory_service.py          | 28      | 28/28 PASS       |
| test_llm_service.py             | 10      | 10/10 PASS       |
| test_auth_middleware.py         | 7       | 7/7 PASS         |
| test_rate_limit.py              | 5       | 5/5 PASS         |
| test_idempotency.py             | 6       | 6/6 PASS         |
| test_data_isolation.py          | 9       | 9/9 PASS         |
| test_workers.py                 | 4       | 4/4 PASS         |
| test_events.py                  | 5       | 5/5 PASS         |
| test_resume_service.py          | 6       | 6/6 PASS         |
| test_knowledge_graph_service.py | 27      | 27/27 PASS       |
| **Total (verified)**            | **285** | **285/285 PASS** |
| Full suite collected            | 2341    | —                |

**Note:** `test_trigger_sync_exception` passes but tests the wrong thing — it
uses a mock that has `connector_type` as an attribute, masking the real bug.

---

## WHAT'S ACTUALLY SOLID (Verified Correct)

- SAML parsing + issuer/time/audience validation: real, working code
- Connector CRUD + token_ref encryption: real, working code
- Fernet encryption infrastructure: real, production-quality
- `is_encrypted()` heuristic: acceptable for its use case
- Approval API + frontend wiring: real, fully integrated, types match
- Consent API + frontend wiring: real, integrated (type mismatch but works)
- Gmail client: real OAuth2, draft-only confirmed
- Circuit breaker, rate limiter: real implementations
- 285 tests: all pass, zero failures

---

## GATE SCORE

| Category                 | Weight  | Score  | Basis                                           |
| ------------------------ | ------- | ------ | ----------------------------------------------- |
| Scope/acceptance         | 12      | 10     | Sync is stub, connector.config encryption added |
| Technical correctness    | 12      | 8      | `connector_type` bug, signxml not installed     |
| Architecture/integration | 8       | 7      | Approval/consent wired, webhook mass-assignment |
| Data quality/lifecycle   | 8       | 7      | Config encrypted but decrypt swallows errors    |
| Security/privacy         | 12      | 9      | SAML gated but signxml not installed            |
| Testing/validation       | 12      | 10     | 285 pass but trigger_sync test is wrong         |
| Reliability/resilience   | 8       | 6      | In-memory infra, webhook fire-and-forget        |
| Performance/capacity     | 6       | 6      | No regressions                                  |
| Evidence/traceability    | 8       | 7      | Docs updated, type mismatch undocumented        |
| Documentation/handoff    | 6       | 6      | READMEs updated                                 |
| Operations/support       | 5       | 4      | In-memory infra, no runbooks                    |
| Maintainability/cost     | 3       | 3      | Clean code                                      |
| **TOTAL**                | **100** | **85** |                                                 |

---

## MANDATORY BLOCKERS (Must fix)

1. **P11-A001:** Fix `connector.connector_type` → `connector.type` on line 185
2. **P11-A002:** Run `pip install -e .` to install signxml

## RECOMMENDED FIXES (Don't block gate)

3. **P11-A003:** Align `ConsentRecord` TypeScript interface to backend shape
4. **P11-A004:** Use allowlist for webhook update fields
5. **P11-A005:** Raise or clearly handle decryption failures in
   `_decrypt_config`
6. **P11-A006:** Fix `except (Exception, XMLParseError)` tuple ordering
7. **P11-A007:** Remove dead imports in webhook_service.py

---

## VERDICT

**85/100 — CONDITIONAL PASS**

2 mandatory blockers. Once fixed, score rises to ~93/100.
