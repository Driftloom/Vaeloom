# FINDINGS: Dead Dependencies in Phase Prompts (MVP-P00 through MVP-P07)

**Audit Date:** 2026-08-17 **Audited Files:** MVP-P00 through MVP-P07
**Severity:** P2-MEDIUM **Status:** FIXED (ALL prompts P00-P21 + README updated
2026-08-17)

---

## Finding 1: BullMQ — Documented But Zero Consumers

### Summary

**6 of 8 audited prompts** (P00, P03, P04, P05, P07 + P06 partially) reference
"Redis/BullMQ" as part of the architecture. The `packages/queue/` directory
exists but has **ZERO consumers deployed** and is never imported by any running
service.

### Repository Reality

- `packages/queue/` — Contains BullMQ package structure
- `apps/api/src/api/workers/` — Exists but uses direct function calls, NOT
  BullMQ workers
- `docker-compose.yml` — No BullMQ worker service
- No `import.*bullmq` or `import.*bull` in any running code path

### Prompt References

| Prompt  | Line | Text           |
| ------- | ---- | -------------- |
| MVP-P00 | 155  | "Redis/BullMQ" |
| MVP-P00 | 284  | "Redis/BullMQ" |
| MVP-P03 | 195  | "Redis/BullMQ" |
| MVP-P03 | 324  | "Redis/BullMQ" |
| MVP-P04 | 195  | "Redis/BullMQ" |
| MVP-P04 | 324  | "Redis/BullMQ" |
| MVP-P05 | 195  | "Redis/BullMQ" |
| MVP-P05 | 324  | "Redis/BullMQ" |
| MVP-P07 | 195  | "Redis/BullMQ" |
| MVP-P07 | 325  | "Redis/BullMQ" |

### Correct Prompts

| Prompt  | Text                                                 | Status  |
| ------- | ---------------------------------------------------- | ------- |
| MVP-P01 | "Redis" (no BullMQ mention)                          | CORRECT |
| MVP-P02 | "Redis (caching/rate-limiting)" (no BullMQ mention)  | CORRECT |
| MVP-P06 | Explicitly marks BullMQ as "ZERO consumers deployed" | CORRECT |

### Recommendation

Replace "Redis/BullMQ" with "Redis" in all prompts, OR add a note that BullMQ is
a planned-but-unused dependency.

---

## Finding 2: NestJS Packages — Legacy Remnants

### Summary

The codebase contains NestJS-style packages that are **NOT deployed and NOT
imported** by any running service:

| Package                   | Status                              |
| ------------------------- | ----------------------------------- |
| `packages/service-auth/`  | NestJS-style code, no app bootstrap |
| `packages/observability/` | NestJS-style code, no app bootstrap |
| `packages/queue/`         | BullMQ structure, zero consumers    |

### Prompt References

Only MVP-P06 correctly identifies these as "LEGACY — NOT DEPLOYED." All other
prompts either:

- List NestJS as active architecture (P00, P03, P04, P05, P07) —
  FINDING-ARCH-001
- Don't mention them at all

### Recommendation

1. Either remove the dead packages from the repo entirely, OR
2. Add a "Legacy Packages" section to each prompt documenting它们 as
   non-deployed remnants
3. P06's framing is the correct one: "remnants from an earlier microservices
   design"

---

## Finding 3: Redis Role Mismatch

### Summary

Some prompts describe Redis as "Redis/BullMQ" implying queue functionality, but
Redis is actually used for:

- Caching
- Rate limiting (sliding window)
- Session storage

There is NO queue processing via Redis in the current implementation.

### Repository Reality

- `apps/api/src/api/middleware/rate_limit.py` — Redis-backed rate limiting
- `apps/api/src/api/services/cache_service.py` — Redis-backed caching
- No Redis queue processing anywhere

### Recommendation

Update all "Redis/BullMQ" references to "Redis (caching, rate-limiting)" to
accurately reflect usage.
