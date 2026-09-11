# Audit/History Verification

## Purpose

Verify AuditMiddleware intercepts, `audit_events` table recordings, history page
functionality, and tamper resistance.

## Source of truth

- `AuditMiddleware`
- `audit_events` schema

## Preconditions

- System active with mutative requests occurring.

## Test actors

- User
- Admin

## Test scenarios

| Action                              | Expected                                                  | Actual     | Evidence |
| ----------------------------------- | --------------------------------------------------------- | ---------- | -------- |
| Perform mutating request (POST/PUT) | Intercepted and logged in `audit_events`                  | UNVERIFIED | TBD      |
| Verify audit record data            | Record contains actor, action, resource, tenant, metadata | UNVERIFIED | TBD      |
| Check worker crash during audit     | Fire-and-forget logic evaluated for data loss risk (P0)   | UNVERIFIED | TBD      |
| View History page                   | Events display correctly for tenant                       | UNVERIFIED | TBD      |
| Attempt application-level tamper    | Tampering detected/prevented by system                    | UNVERIFIED | TBD      |

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
