# ADR-019: Object Storage with S3-compatible API

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom stores user-uploaded documents (resumes, cover letters, contracts) and generated artifacts (exported resumes, reports). Files can be up to 50MB (PDFs, DOCX) and must be encrypted at rest, accessible via pre-signed URLs, and isolated per tenant. The storage backend must be compatible with both local development and cloud deployment.

Options considered: MinIO (S3-compatible), AWS S3, Google Cloud Storage, local filesystem, Wasabi.

## Decision

Use **S3-compatible object storage** via `boto3` with **MinIO** for local development and **AWS S3** for production.

Configuration:
- Local: MinIO container in `docker-compose.yml` on ports 9000/9001
- Production: AWS S3 bucket with server-side encryption (KMS)
- `storage_service.py` abstracts the storage layer with `upload`, `download`, `delete`, `get_signed_url` operations
- Files stored with tenant-prefixed keys: `{tenant_id}/{workspace_id}/{file_id}/{filename}`
- Pre-signed URLs for secure direct download without exposing storage credentials
- Multipart upload for files >100MB

## Consequences

**Positive:**
- Storage abstraction (`storage_service.py`) makes the application provider-agnostic
- MinIO provides identical S3 API in local dev — no cloud dependency for testing
- Pre-signed URLs eliminate the need to proxy file downloads through the backend
- Tenant-prefixed keys enforce object-level isolation in a shared bucket
- Server-side encryption at rest using KMS meets compliance requirements

**Negative:**
- Pre-signed URL expiry requires balancing security (short expiry) with UX (long enough for large downloads)
- File uploads must pass through the backend (for virus scanning and metadata extraction) before reaching S3 — adds latency
- S3 eventual consistency can cause issues with immediate read-after-write in some edge cases
- MinIO in development uses local disk — state is lost if the container is removed without volume persistence
