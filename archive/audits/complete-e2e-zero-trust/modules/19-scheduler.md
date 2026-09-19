# Calendar/Scheduler Verification

## Purpose

Verify calendar client integrations (Google Calendar, Outlook), event
management, timezone handling, and the background conflict monitor daemon.

## Source of truth

- Calendar client source
- Daemon configurations

## Preconditions

- Connected Google Calendar and Outlook accounts.
- `Daily 08:00 UTC Calendar Conflict Monitor` daemon is running.

## Test actors

- User
- Scheduling Agent

## Test scenarios

| Action                       | Expected                                                 | Actual     | Evidence |
| ---------------------------- | -------------------------------------------------------- | ---------- | -------- |
| Agent creates new event      | Event synced to external calendars with correct timezone | UNVERIFIED | TBD      |
| Conflict Monitor daemon runs | Detects overlapping events and flags for review          | UNVERIFIED | TBD      |
| Agent creates reminder       | Reminder fires at correct time                           | UNVERIFIED | TBD      |
| Handle recurring events      | Recurrence rules respected during modifications          | UNVERIFIED | TBD      |
| Cross-timezone scheduling    | Events appear at correct local time for all participants | UNVERIFIED | TBD      |

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
