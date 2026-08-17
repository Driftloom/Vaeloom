# FINDINGS: Directory Path Mismatches in Phase Prompts (MVP-P00 through MVP-P07)

**Audit Date:** 2026-08-17 **Audited Files:** MVP-P00 through MVP-P07
**Severity:** P1-HIGH **Status:** FIXED (ALL prompts P00-P21 + README updated
2026-08-17)

---

## Summary

**5 of 8 audited prompts** (P00, P03, P04, P05, P07) reference directories that
don't exist or have wrong names. These incorrect paths will mislead anyone
following the prompts to look in the wrong locations.

---

## Evidence

### Actual Codebase Structure

```
apps/
  api/          ← FastAPI backend (NOT core-api, NOT ai-service)
  web/          ← Next.js frontend
```

No `packages/contracts/` or `packages/design-system/` exist.

### Correct Prompts (Already Updated)

| Prompt  | Directory References   | Status  |
| ------- | ---------------------- | ------- |
| MVP-P01 | `apps/api`, `apps/web` | CORRECT |
| MVP-P02 | `apps/api`, `apps/web` | CORRECT |
| MVP-P06 | `apps/api`, `apps/web` | CORRECT |

### Incorrect Prompts (Need Fix)

| Prompt  | Incorrect Reference      | Should Be                                 |
| ------- | ------------------------ | ----------------------------------------- |
| MVP-P00 | `apps/core-api`          | `apps/api`                                |
| MVP-P00 | `apps/ai-service`        | Does not exist — remove or note as future |
| MVP-P00 | `packages/contracts`     | Does not exist — remove or note as future |
| MVP-P00 | `packages/design-system` | Does not exist — remove or note as future |
| MVP-P03 | `apps/core-api`          | `apps/api`                                |
| MVP-P03 | `apps/ai-service`        | Does not exist — remove or note as future |
| MVP-P03 | `packages/contracts`     | Does not exist — remove or note as future |
| MVP-P03 | `packages/design-system` | Does not exist — remove or note as future |
| MVP-P04 | `apps/core-api`          | `apps/api`                                |
| MVP-P04 | `apps/ai-service`        | Does not exist — remove or note as future |
| MVP-P04 | `packages/contracts`     | Does not exist — remove or note as future |
| MVP-P04 | `packages/design-system` | Does not exist — remove or note as future |
| MVP-P05 | `apps/core-api`          | `apps/api`                                |
| MVP-P05 | `apps/ai-service`        | Does not exist — remove or note as future |
| MVP-P05 | `packages/contracts`     | Does not exist — remove or note as future |
| MVP-P05 | `packages/design-system` | Does not exist — remove or note as future |
| MVP-P07 | `apps/core-api`          | `apps/api`                                |
| MVP-P07 | `apps/ai-service`        | Does not exist — remove or note as future |
| MVP-P07 | `packages/contracts`     | Does not exist — remove or note as future |
| MVP-P07 | `packages/design-system` | Does not exist — remove or note as future |

---

## Root Cause

The directory structure was designed as a microservices architecture (core-api +
ai-service + shared contracts + design system). The actual implementation chose
a monolithic approach with FastAPI and Next.js only. The prompts were never
updated to reflect this decision.

---

## Recommendation

1. Replace all `apps/core-api` → `apps/api`
2. Remove or annotate `apps/ai-service`, `packages/contracts`,
   `packages/design-system` as "NOT IMPLEMENTED — future consideration"
3. Add note that `apps/api/` contains both API and AI logic (no separate
   ai-service)
