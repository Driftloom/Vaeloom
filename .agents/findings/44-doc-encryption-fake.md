# Finding: Encryption at Rest Not Implemented

| Metadata     | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| **ID**       | FIND-DOC-005                                                       |
| **Severity** | P0-CRITICAL                                                        |
| **Status**   | OPEN                                                               |
| **Source**   | Documentation Audit                                                |
| **Files**    | `docs/02-system-architecture.md`, `docs/architecture/Data-Flow.md` |

## Description

Multiple docs claim "Encrypted Storage (Documents & memory at rest, AES-256)"
and "Field-level AES-256 encryption". The actual code at
`services/encryption.py` only checks if keys are set — never imports
`cryptography`, never performs actual encryption. MinIO uploads use
`use_ssl=False`.

## Evidence

- `services/encryption.py`: only status-check endpoint
- No `cryptography` in `pyproject.toml` dependencies
- No `Fernet`, `AES`, or any encryption library imported anywhere
- All data stored in plaintext

## Impact

- Complete data exposure if database is compromised
- Compliance violation (GDPR, DPDP, SOC 2)

## Remediation

Implement field-level encryption or mark encryption claims as
`STATUS: NOT_IMPLEMENTED`.
