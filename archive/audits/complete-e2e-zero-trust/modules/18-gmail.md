# Gmail/Communication Intelligence Verification

## Purpose

Verify the Gmail client integration, including OAuth sync, classification,
background daemon operations, and strict permission enforcement (e.g., agent
cannot send email without permission).

## Source of truth

- `gmail_client.py`
- Background daemon configurations

## Preconditions

- Valid Gmail OAuth credentials.
- `Daily 06:00 UTC Gmail Watcher` daemon is configured.

## Test actors

- User
- Gmail Agent

## Test scenarios

| Action                                        | Expected                                             | Actual     | Evidence |
| --------------------------------------------- | ---------------------------------------------------- | ---------- | -------- |
| Gmail Watcher daemon runs                     | Inbox synced, emails classified, deadlines extracted | UNVERIFIED | TBD      |
| Agent attempts to draft email                 | Draft created, approval gate triggered               | UNVERIFIED | TBD      |
| Agent attempts to SEND email without approval | **BLOCKED**; action denied by permission system      | UNVERIFIED | TBD      |
| User approves email draft                     | Email sent successfully                              | UNVERIFIED | TBD      |
| Webhook endpoint receives update              | `/api/v1/gmail/webhook` processes without CSRF error | UNVERIFIED | TBD      |

## Rating dimensions

- Capability: UNVERIFIED
- Security: UNVERIFIED
- Reliability: UNVERIFIED

## Severity

P0

## Final status

UNVERIFIED

## Evidence references

- TBD
