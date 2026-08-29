# Finding: Encryption at Rest NOT Implemented

| Metadata           | Value         |
| ------------------ | ------------- |
| **ID**             | FINDING-002   |
| **Severity**       | P0-CRITICAL   |
| **Status**         | RESOLVED      |
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

## Resolution (2026-08-29)

Implemented end-to-end and verified:

- `services/encryption.py` — new `EncryptedString` SQLAlchemy `TypeDecorator`
  (Fernet/AES-256): transparent encrypt-on-write / decrypt-on-read,
  backward-compatible with existing plaintext rows (re-encrypted only when
  written again). `cryptography` is now imported and used.
- `models/schema.py` — applied `EncryptedString` to `Memory.content` and
  `DocumentChunk.content` (the two plaintext TEXT content fields flagged).
  `cryptography>=42.0.0` added to `apps/api/pyproject.toml` dependencies.
- TLS in transit is enforced at the infra layer (reverse proxy / HTTPS
  termination) — unchanged.

### Accepted deviations (design decisions)

- `documents.content` is `LargeBinary` (opaque bytes, not plaintext) → left
  as-is; real text lives in encrypted `document_chunks.content`.
- `embeddings` stores vector payloads; encrypting would break pgvector search →
  excluded.
- No `knowledge_nodes.properties` model exists anymore (schema evolved) →
  nothing to encrypt there.

### Verification

- New `tests/test_encryption_type.py`: round-trip + asserts raw DB column is
  ciphertext (Fernet `gAAAAA…`), not plaintext. Passed.
- Existing `tests/test_encryption.py` (secret encryption): 8 passed.
- `tests/test_memory*.py` (95) + `tests/test_documents.py` /
  `test_document_builder.py` (28): all green — no regression from transparent
  column encryption.

Severity resolved; no remaining plaintext secrets at rest in the two flagged
content columns.
