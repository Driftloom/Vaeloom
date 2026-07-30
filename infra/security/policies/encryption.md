# Encryption Policy

## Data at Rest
- Database: AES-256 encryption via RDS (transparent data encryption)
- Storage: Server-side encryption with S3 (AES-256)
- Backups: Encrypted with AWS KMS

## Data in Transit
- All API traffic: TLS 1.3 minimum
- Internal service mesh: mTLS
- Database connections: SSL/TLS enforced

## Key Management
| Key | Type | Rotation | Storage |
|---|---|---|---|
| Database encryption | AWS KMS | Annual | AWS KMS |
| JWT signing | RSA-256 | 90 days | Secrets Manager |
| API keys | HMAC-SHA256 | Per-request | Hashed in DB |
| User encryption keys | AES-256-GCM | Per-user | KMS + envelope |
