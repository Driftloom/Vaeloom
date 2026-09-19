# E2E Scenario: 015-failure-recovery.md

## Scenario Description and Goal

Inject failures: LLM provider down → verify fallback chain, DB connection drop →
verify retry, Redis unavailable → verify in-memory fallback, upload during
network interruption → verify no duplicate/corrupt data

## Preconditions

- Status: UNVERIFIED
- [ ] User is registered
- [ ] Systems are online

## Step-by-Step Execution Plan

| Step | Action           | Expected Outcome          | Actual Outcome | Status          | Severity |
| ---- | ---------------- | ------------------------- | -------------- | --------------- | -------- |
| 1    | Execute scenario | System responds correctly | UNVERIFIED     | NOT_IMPLEMENTED | P0       |

## Cross-layer Verification Checklist

- [ ] Frontend
- [ ] API
- [ ] Auth
- [ ] Backend
- [ ] Agent
- [ ] Tool
- [ ] Queue
- [ ] Worker
- [ ] Database
- [ ] Memory
- [ ] Event
- [ ] Notification
- [ ] Frontend

## Evidence Capture Requirements

- Screenshots of UI
- API Logs with file paths and line numbers
- DB Queries
- Network traces
- Evidence must be specified, cannot just say 'it works'

## Pass/Fail Criteria

- Pass: All steps meet expected outcomes with verifiable evidence.
- Fail: Any step fails or evidence is missing.
