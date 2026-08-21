# MVP-P14 Test Strategy

**Document:** TEST-STRATEGY-Vaeloom-001  
**Version:** 1.0  
**Date:** 2026-08-21  
**Phase:** MVP-P14 (Testing and Quality Engineering)

---

## 1. Test Philosophy

Vaeloom follows a **risk-based, evidence-driven** testing approach. Every
material claim about functionality, security, performance or compliance must
link to reproducible runtime evidence. Documentation completeness is never
conflated with implementation success.

---

## 2. Test Pyramid

```
        ┌─────────────┐
        │   E2E /     │  ← Slow, high confidence, few
        │   Manual    │
        ├─────────────┤
        │ Integration  │  ← Medium speed, medium confidence
        │  (API tests) │
        ├─────────────┤
        │   Unit       │  ← Fast, high coverage, many
        │  (services)  │
        └─────────────┘
```

### Current Counts

| Layer             | Count    | Status                |
| ----------------- | -------- | --------------------- |
| Unit tests        | ~2100    | ACTIVE                |
| Integration (API) | ~300     | ACTIVE                |
| Security          | 233      | ACTIVE (P13 expanded) |
| AI evaluation     | NEW      | P14                   |
| Contract/schema   | NEW      | P14                   |
| Resilience        | EXPANDED | P14                   |
| E2E (frontend)    | 39       | ACTIVE                |

---

## 3. Test Categories

### 3.1 Functional Tests

- **Auth:** signup, login, refresh, token expiry, invalid credentials
- **Workspaces:** CRUD, list, isolation, permissions
- **Memories:** CRUD, types, filtering, versioning
- **Agents:** catalog, execution, tool use, fallback
- **Documents:** upload, parse, search
- **Integrations:** connect, disconnect, sync

### 3.2 Contract Tests

- **API schema:** Request/response models match OpenAPI spec
- **Type safety:** Pydantic validation catches malformed input
- **Backward compatibility:** Breaking changes detected

### 3.3 Security Tests (233 tests)

- Authentication & authorization (noauth, expired tokens)
- CSRF protection (double-submit cookie)
- Prompt injection (14 patterns + base64)
- Tenant isolation (cross-user access)
- SQL injection, XSS, rate limiting

### 3.4 AI Evaluation Tests

- **Memory quality:** Retrieval precision, deduplication, relevance
- **Output validation:** LLM responses meet safety/quality criteria
- **Prompt safety:** Injection detection accuracy
- **Agent execution:** Tool call correctness, circuit breaker behavior

### 3.5 Resilience Tests

- **Circuit breaker:** Failure threshold → open → half-open → recovery
- **Rate limiting:** Concurrent load, sliding window accuracy
- **Fallback policies:** Primary failure → cache → retry → degrade
- **Provider outage:** Graceful degradation, fallback chain

### 3.6 Data Integrity Tests

- **GDPR export:** All 12 tables included, correct data
- **GDPR delete:** Anonymization, cascade, audit trail
- **Consent:** Grant/revoke/check lifecycle
- **Retention:** Automatic purge, soft delete

---

## 4. Test Environments

| Environment | Purpose        | Database           | LLM             |
| ----------- | -------------- | ------------------ | --------------- |
| Unit/CI     | Fast feedback  | SQLite (in-memory) | Mock            |
| Integration | API validation | SQLite (file)      | Mock            |
| Staging     | Pre-production | PostgreSQL         | Real (test key) |

---

## 5. Quality Gates

| Gate                      | Threshold  | Action               |
| ------------------------- | ---------- | -------------------- |
| All tests pass            | 100%       | Block on failure     |
| Security tests            | 0 failures | Block on failure     |
| Coverage (new code)       | ≥80%       | Warn below threshold |
| No HIGH severity findings | 0          | Block on failure     |

---

## 6. Evidence Requirements

Every test run must record:

- Command executed
- Environment (Python version, dependencies)
- Git commit SHA
- Test count (passed/failed/skipped)
- Timestamp
- Duration

Evidence is stored in `docs/phases/mvp-p14/` as gate reports.
