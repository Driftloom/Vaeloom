# DEL-ENT-P16-03 — SBOM, Provenance, and Cryptographic Signatures

**Deliverable ID:** DEL-ENT-P16-03  
**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** DevOps Lead  
**Reviewer:** AppSec Engineer + Security Architect  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:**
`evidence/phases/ent/ent-p16/03-sbom-provenance-signatures.md`

---

## 1. Supply-Chain Security & SLSA Level 3 Framework

Vaeloom adheres to **SLSA v1.2 Build Level 3** (Supply-chain Levels for Software
Artifacts) and NIST SP 800-218 (Secure Software Development Framework) across
all published artifacts.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SLSA LEVEL 3 PROVENANCE PIPELINE                    │
│                                                                         │
│  Git Commit (Signed) ──► Isolated GitHub Runner ──► Hermetic Container  │
│                                                          │              │
│  ┌───────────────────────────────────────────────────────▼───────────┐  │
│  │ Artifact Generation:                                              │  │
│  │   • Container Images (API: Python 3.12-slim, Web: Node 20-alpine)  │  │
│  │   • SPDX 2.3 / CycloneDX 1.5 SBOMs                                 │  │
│  │   • In-toto JSON Build Provenance Attestation                      │  │
│  └───────────────────────┬───────────────────────────────────────────┘  │
│                          │                                              │
│  ┌───────────────────────▼───────────────────────────────────────────┐  │
│  │ Cryptographic Signing:                                            │  │
│  │   • Cosign keyless signing via Sigstore Fulcio OIDC               │  │
│  │   • Transparency log entry on Rekor public ledger                 │  │
│  └───────────────────────┬───────────────────────────────────────────┘  │
│                          │                                              │
│  ┌───────────────────────▼───────────────────────────────────────────┐  │
│  │ Admission Controller (Kyverno / Conftest in K8s):                 │  │
│  │   • Validates Cosign signature + SLSA attestation before Pod run  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Software Bill of Materials (SBOM) Generation

### 2.1 Backend API Dependencies (Python / PyPI)

- Generated via `syft packages dir:apps/api -o spdx-json=sbom-api.spdx.json`
- Authoritative lockfile: `apps/api/uv.lock` (pinned exact hashes)
- Python base runtime: `python:3.12.13-slim-bookworm` (Patched, 0 Critical, 0
  High CVEs)
- **Trivy High CVE Remediation:** Pinned base image Debian patch level,
  resolving `RISK-ENT-P13-04` / `DEF-P14-02`.

### 2.2 Frontend Web Dependencies (Node / npm)

- Generated via `syft packages dir:apps/web -o spdx-json=sbom-web.spdx.json`
- Authoritative lockfile: `pnpm-lock.yaml` (strict peer dependencies, frozen
  lockfile)
- Node runtime: `node:20.18-alpine` (Minimal attack surface)

---

## 3. Cryptographic Image Signing & Attestation

Every container pushed to the internal artifact registry is signed using Cosign
keyless mode:

```bash
# Keyless signing via GitHub Actions OIDC identity
cosign sign \
  --yes \
  --oidc-provider=https://token.actions.githubusercontent.com \
  vaeloom/api:sha256-a9f8b7c3d2e1...

# Attesting SBOM
cosign attest \
  --yes \
  --predicate sbom-api.spdx.json \
  --type spdx \
  vaeloom/api:sha256-a9f8b7c3d2e1...

# Verification prior to Kubernetes admission
cosign verify \
  --certificate-identity-regexp="https://github.com/vaeloom/vaeloom/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  vaeloom/api:sha256-a9f8b7c3d2e1...
```

---

## 4. Vulnerability Management & Triaging SLA

| Finding Severity | Remediation SLA | Enforcement Policy                                          |
| ---------------- | --------------- | ----------------------------------------------------------- |
| **CRITICAL**     | ≤ 24 Hours      | Blocks PR merge and deployment gate                         |
| **HIGH**         | ≤ 72 Hours      | Blocks production release; requires CISO waiver for staging |
| **MEDIUM**       | ≤ 14 Days       | Tracked in defect register; scheduled patch sprint          |
| **LOW**          | ≤ 30 Days       | Routine quarterly dependency upgrade                        |

---

_Deliverable DEL-ENT-P16-03 v1.0.0 — DevOps Lead — 2026-09-29_
