# Dashboard Verification

## Purpose

Verify the workspace home page, KPI cards, metrics accuracy, and proper handling
of UI states (loading, empty, error, stale).

## Source of truth

- Frontend dashboard components
- Backend API endpoints

## Preconditions

- Workspace populated with mock data (applications, events).

## Test actors

- User

## Test scenarios

| Action                     | Expected                         | Actual     | Evidence |
| -------------------------- | -------------------------------- | ---------- | -------- |
| Load workspace home page   | KPI cards display correctly      | UNVERIFIED | TBD      |
| Verify data consistency    | UI value = API value = DB value  | UNVERIFIED | TBD      |
| Simulate slow API response | Loading state displayed          | UNVERIFIED | TBD      |
| Load with no data          | Empty state displayed            | UNVERIFIED | TBD      |
| Simulate API error         | Error state displayed gracefully | UNVERIFIED | TBD      |

## Rating dimensions

- Capability: UNVERIFIED
- Security: UNVERIFIED
- Reliability: UNVERIFIED

## Severity

P2

## Final status

UNVERIFIED

## Evidence references

- TBD
