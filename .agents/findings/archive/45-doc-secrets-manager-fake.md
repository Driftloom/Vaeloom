# Finding: Secrets Manager Does Not Exist

| Metadata     | Value                            |
| ------------ | -------------------------------- |
| **ID**       | FIND-DOC-006                     |
| **Severity** | P1-HIGH                          |
| **Status**   | OPEN                             |
| **Source**   | Documentation Audit              |
| **File**     | `docs/02-system-architecture.md` |

## Description

Architecture docs list "Secrets Manager (OAuth tokens, never in plaintext)" as a
storage layer component. No Vault, no Infisical runtime, no dedicated secrets
management exists. Credentials are stored as environment variables.

## Impact

- OAuth tokens in env vars (not encrypted at rest)
- No secret rotation mechanism
- No audit trail for secret access

## Remediation

Either:

1. Implement secrets manager (Vault, Infisical, AWS Secrets Manager)
2. Mark as `STATUS: ASPIRATIONAL`
