# Secrets, Credentials & Cryptography Forensic Audit

## 1. Executive Summary

This audit inspects environment variable loading, symmetric encryption
algorithms, secret storage backends, and token lifecycle management across the
Vaeloom monorepo.

---

## 2. Secrets Inventory & Configuration Mechanics

All system settings are consolidated in `apps/api/src/api/config.py` using
Pydantic `BaseSettings`:

| Config Parameter          | Sensitive? | Storage / Retrieval Mechanism     | Validation Rule                           |    Status     |
| :------------------------ | :--------: | :-------------------------------- | :---------------------------------------- | :-----------: |
| `JWT_SECRET`              |  **YES**   | Env Var / SecretManager           | Minimum 32 chars enforced at startup      | **COMPLIANT** |
| `ENCRYPTION_KEY`          |  **YES**   | Env Var / Base64 32 bytes         | AES-256-GCM symmetric key validation      | **COMPLIANT** |
| `DATABASE__URL`           |  **YES**   | Env Var / Connection Pool         | Normalized PostgreSQL / SQLite connection | **COMPLIANT** |
| `DATABASE_MIGRATION__URL` |  **YES**   | Env Var (Least Privilege)         | Dedicated DDL migration user credentials  | **COMPLIANT** |
| `REDIS__URL`              |  **YES**   | Env Var                           | In-memory cache & rate limiter endpoint   | **COMPLIANT** |
| `LLM_API_KEY`             |  **YES**   | Env Var / Provider Keys           | Dynamic per-provider resolution           | **COMPLIANT** |
| `CONNECTOR_SECRETS`       |  **YES**   | Encrypted in DB (`provider_keys`) | AES-256-GCM per-key encrypted             | **COMPLIANT** |

---

## 3. Cryptographic Implementation Analysis

### 3.1 Token & Credential Encryption (`apps/api/src/api/utils/encryption.py`)

- **Algorithm**: AES-256-GCM (Galois/Counter Mode) via
  `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.
- **Nonce Generation**: 12-byte cryptographically secure random nonce
  (`os.urandom(12)`) prepended to ciphertext.
- **Verification**: Verified zero hardcoded fallback keys. If `ENCRYPTION_KEY`
  is unset or invalid, the application fails to initialize.

### 3.2 Secret Management Provider (`apps/api/src/api/infrastructure/secrets.py`)

- **Protocols Supported**:
  1. `EnvSecretManager`: Direct environment variable resolution.
  2. `InfisicalSecretManager`: Integration with Infisical Secret Vault for
     dynamic runtime secret injection.
  3. `LocalFileSecretManager`: Read-only `.env` fallback for local development.

### 3.3 PII Scrubbing (`apps/api/src/api/infrastructure/logging.py`)

- Regex and Presidio-based redactors scrub sensitive values (`Bearer *`,
  `jwt=*`, `sk-*`, credit cards, emails) from structured log streams before
  output to stdout or OpenTelemetry exporters.
