# Search Verification

## Purpose

Verify global search functionality across entities, hybrid search implementation
(vector + keyword + graph), and permission enforcement on results.

## Source of truth

- Search service implementation
- Index configurations

## Preconditions

- System populated with multi-tenant data.
- Search indexes built.

## Test actors

- User (Tenant A)
- User (Tenant B)

## Test scenarios

| Action                         | Expected                                  | Actual     | Evidence |
| ------------------------------ | ----------------------------------------- | ---------- | -------- |
| Perform global keyword search  | Relevant entities returned across types   | UNVERIFIED | TBD      |
| Perform semantic/vector search | Conceptually related results returned     | UNVERIFIED | TBD      |
| Search as Tenant A             | Results exclude Tenant B data             | UNVERIFIED | TBD      |
| Apply search filters           | Results narrowed according to filters     | UNVERIFIED | TBD      |
| Search with typos              | Typo handling returns appropriate matches | UNVERIFIED | TBD      |

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
