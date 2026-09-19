# Data Lifecycle/Privacy Verification

## Purpose

Verify ErasureService, GDPRService (Art.20 exports), user anonymization,
connector disconnect handling, and complete data deletion across services.

## Source of truth

- `ErasureService`
- `GDPRService`

## Preconditions

- Account populated with diverse data types (vectors, graphs, tables).

## Test actors

- User

## Test scenarios

| Action                    | Expected                                                                     | Actual     | Evidence |
| ------------------------- | ---------------------------------------------------------------------------- | ---------- | -------- |
| Request account deletion  | ErasureService removes data across all sensitive tables by workspace/user ID | UNVERIFIED | TBD      |
| Verify user anonymization | Email replaced with `deleted-uuid@vaeloom.local`                             | UNVERIFIED | TBD      |
| Request GDPR export       | Data exported across 30+ tables accurately                                   | UNVERIFIED | TBD      |
| Disconnect connector      | Associated data gracefully handled/purged                                    | UNVERIFIED | TBD      |
| Check external stores     | Search index, vector DB, and graph DB purged of user data                    | UNVERIFIED | TBD      |

## Rating dimensions

- Capability: UNVERIFIED
- Security: UNVERIFIED
- Reliability: UNVERIFIED

## Severity

P1

## Final status

UNVERIFIED

## Evidence references

- TBD
