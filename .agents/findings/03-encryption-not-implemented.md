# Finding: Encryption at Rest NOT Implemented

| Metadata           | Value         |
| ------------------ | ------------- |
| **ID**             | FINDING-002   |
| **Severity**       | P0-CRITICAL   |
| **Status**         | OPEN          |
| **Date**           | 2026-08-16    |
| **Assigned Phase** | P11           |
| **Owner**          | Security Team |

## Description

Documentation claims AES-256 field-level encryption for documents and memory.
The code only checks if encryption keys are set — no actual encryption is
performed.

## Evidence

- `services/encryption.py` only checks `settings.encryption_key` — never imports
  `cryptography`
- No `cryptography` package in `pyproject.toml` dependencies
- MinIO uploads use `use_ssl=False` in local config
- No field-level encryption on any model fields

## Impact

All data is stored in plaintext. If the database is compromised, all user data
(resumes, emails, memories, knowledge graph) is exposed.

## Remediation

1. Add `cryptography` to dependencies
2. Implement `Fernet` symmetric encryption for sensitive fields
3. Create an `EncryptedString` SQLAlchemy type that encrypts on write, decrypts
   on read
4. Apply to: `memories.content`, `documents.content`,
   `knowledge_nodes.properties`, `embeddings`

## Related

- `docs/architecture/Data-Flow.md` — claims "Field-level AES-256 encryption"
- `docs/compliance/india-dpdp-act-mapping.md` — Security Safeguards
