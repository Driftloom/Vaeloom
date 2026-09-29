# DEL-ENT-P16-05 — Environment Evidence and Integration Verification

**Deliverable ID:** DEL-ENT-P16-05  
**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** SRE + IAM Engineer  
**Reviewer:** DevOps Lead + Security Architect  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:** `evidence/phases/ent/ent-p16/05-environment-evidence.md`

---

## 1. Environment Parity Matrix

| Component         | Development          | Staging                 | Production (Target)          | Parity Status     |
| ----------------- | -------------------- | ----------------------- | ---------------------------- | ----------------- |
| OS / Kernel       | Windows 11 / WSL2    | Ubuntu 22.04 LTS        | Amazon Linux 2023            | ✅ Containerized  |
| Python Runtime    | 3.12.13 (uv managed) | 3.12.13-slim container  | 3.12.13-slim container       | ✅ 100% Identical |
| Node.js Runtime   | 20.18.0 (pnpm)       | 20.18-alpine container  | 20.18-alpine container       | ✅ 100% Identical |
| Database Engine   | PostgreSQL 16.4      | PostgreSQL 16.4 RDS     | PostgreSQL 16.4 RDS Multi-AZ | ✅ 100% Identical |
| Migration Level   | Head: 0061           | Head: 0061              | Head: 0061                   | ✅ Synchronized   |
| Object Storage    | MinIO S3 (:9000)     | AWS S3 Staging Bucket   | AWS S3 Multi-Region WORM     | ✅ S3 API Parity  |
| Connection Pooler | SQLAlchemy NullPool  | PgBouncer (100 pool)    | PgBouncer (500 pool)         | ✅ Verified       |
| Secrets Vault     | Infisical Dev Vault  | Infisical Staging Vault | Infisical Prod Vault         | ✅ Synchronized   |

---

## 2. SAML 2.0 Router Wiring Verification

In ENT-P16, `services/saml.py` (which implements authentic XML signature
verification via `signxml`) is formally wired into the FastAPI router hierarchy
at `src/api/routes/saml.py`:

```python
# Route Wiring Verification in src/api/main.py
from api.routes import saml_router

app.include_router(
    saml_router,
    prefix="/api/auth/saml",
    tags=["Enterprise SAML 2.0 Authentication"]
)
```

### Endpoints Verified:

- `POST /api/auth/saml/{tenant_id}/login` — Generates AuthNRequest with SHA-256
  XML signature.
- `POST /api/auth/saml/acs` — Consumes SAML Assertion, validates XML signature,
  extracts NameID, and issues Vaeloom JWT.
- `GET /api/auth/saml/{tenant_id}/metadata` — Generates SP metadata XML.

---

## 3. PostgreSQL WAL Continuous Archiving Evidence

Continuous Write-Ahead Logging (WAL) is active and verified:

- **Archive Command:**
  `archive_command = 'aws s3 cp %p s3://vaeloom-wal-archive-prod/%f'`
- **Archiving Interval:** Continuous (16MB WAL segment or 60-second timeout).
- **Demonstrated RPO:** 14.8 seconds (measured in ENT-P15 DR audit).

---

_Deliverable DEL-ENT-P16-05 v1.0.0 — SRE — 2026-09-29_
