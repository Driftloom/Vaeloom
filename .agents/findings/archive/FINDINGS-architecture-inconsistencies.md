# FINDINGS: Architecture Inconsistencies in Phase Prompts (MVP-P00 through MVP-P07)

**Audit Date:** 2026-08-17 **Audited Files:** MVP-P00 through MVP-P07
**Severity:** P1-HIGH **Status:** FIXED (ALL prompts P00-P21 + README updated
2026-08-17)

---

## Summary

**5 of 8 audited prompts** (P00, P03, P04, P05, P07) incorrectly claim the
architecture includes "NestJS" alongside FastAPI. The actual codebase is a
**FastAPI monolith** with no NestJS application. Only P01, P02, and P06 were
updated to reflect reality.

---

## Evidence

### Repository Reality

- `apps/api/src/api/main.py` — FastAPI app, no NestJS bootstrap
- `apps/api/pyproject.toml` — No `@nestjs/*` or NestJS dependencies
- `packages/service-auth/` — Contains NestJS-style code but NO app bootstrap, NO
  deployment
- `packages/observability/` — Same as above, legacy remnant
- `docker-compose.yml` — Only `api` service (FastAPI), no NestJS service

### Correct Prompts (Already Updated)

| Prompt  | Architecture Statement                                                                         | Status  |
| ------- | ---------------------------------------------------------------------------------------------- | ------- |
| MVP-P01 | "Next.js 15 frontend, FastAPI/Python backend... No NestJS — single FastAPI monolith (ADR-001)" | CORRECT |
| MVP-P02 | "FastAPI unified backend (`apps/api`)"                                                         | CORRECT |
| MVP-P06 | "FastAPI unified backend (`apps/api/`)" + explicitly marks NestJS as "LEGACY — NOT DEPLOYED"   | CORRECT |

### Incorrect Prompts (Need Fix)

| Prompt  | Line | Incorrect Text                         | Should Be                      |
| ------- | ---- | -------------------------------------- | ------------------------------ |
| MVP-P00 | 155  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P00 | 284  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P03 | 195  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P03 | 324  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P04 | 195  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P04 | 324  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P05 | 195  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P05 | 324  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P07 | 195  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |
| MVP-P07 | 325  | "Next.js, NestJS, FastAPI, PostgreSQL" | "Next.js, FastAPI, PostgreSQL" |

### Cascade Impact (Beyond P00-P07)

The same incorrect "NestJS" string appears in **every subsequent prompt** (P08
through P21) at the same two locations (Section 3 "Verified Project Context" and
Section 13 "Technical and Implementation Requirements"). This is a systemic
copy-paste error affecting **20 prompts total** (40 line edits needed).

---

## Root Cause

P01 and P02 were upgraded with repo-reality truth after execution. P03 through
P21 were never upgraded — they still contain the original template text that
assumed a NestJS + FastAPI microservices architecture.

---

## Recommendation

1. Batch-replace all 40 occurrences of "Next.js, NestJS, FastAPI" → "Next.js,
   FastAPI" across P00, P03-P21
2. Add the "No NestJS" clarification from P01/P06 into each prompt's Section 3
3. Add "Legacy packages exist but are NOT deployed" note from P06 into each
   prompt
