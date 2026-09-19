# `@vaeloom/service-auth`

Service-to-service authentication, workload identity verification, and token utilities for Vaeloom platform services.

## Specifications

- Implements JWT signing and validation protocols complying with [`specs/security/IAM.md`](../../specs/security/IAM.md) and [`specs/security/Encryption.md`](../../specs/security/Encryption.md).
- Enforces workspace isolation boundaries, role-based access control (RBAC), and service account credentials.
