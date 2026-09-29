# ENT-P16 Risk / Decision / Assumption / Traceability Registers

**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** DevOps Lead  
**Date:** 2026-09-29

---

## Risk Register

| ID              | Risk Description                            | Severity | Likelihood | Mitigation                                      | Owner              | Status    |
| --------------- | ------------------------------------------- | -------- | ---------- | ----------------------------------------------- | ------------------ | --------- |
| RISK-ENT-P16-01 | Ephemeral K8s pod crash loop on deployment  | MEDIUM   | LOW        | Blue-green canary with automated Istio rollback | SRE                | MITIGATED |
| RISK-ENT-P16-02 | Third-party package supply chain injection  | HIGH     | LOW        | Syft SBOM + Cosign signing + lockfile hashing   | AppSec Engineer    | MITIGATED |
| RISK-ENT-P16-03 | Database lock during long-running migration | HIGH     | LOW        | Strict expand/contract schema evolution         | Data Architect     | MITIGATED |
| RISK-ENT-P16-04 | Base image CVE regression in upstream       | MEDIUM   | MEDIUM     | Nightly automated Trivy image scanning in CI    | DevOps Lead        | MITIGATED |
| RISK-ENT-P16-05 | Secrets drift between environments          | MEDIUM   | LOW        | Single source of truth via Infisical operator   | Security Architect | MITIGATED |

---

## Decision Register

| ID             | Decision                                        | Rationale                                  | Alternatives              | Owner              | Date       |
| -------------- | ----------------------------------------------- | ------------------------------------------ | ------------------------- | ------------------ | ---------- |
| DEC-ENT-P16-01 | Adopt Cosign keyless image signing via Sigstore | Eliminates static private key management   | Static KMS signing keys   | Security Architect | 2026-09-29 |
| DEC-ENT-P16-02 | Use Istio VirtualService for canary splitting   | Granular percentage-based traffic shifting | Ingress Nginx annotations | SRE                | 2026-09-29 |
| DEC-ENT-P16-03 | Pin base image to Debian Bookworm patch level   | Resolves Trivy High CVEs permanently       | Alpine Linux rewrite      | DevOps Lead        | 2026-09-29 |
| DEC-ENT-P16-04 | Wire SAML 2.0 router to `/api/auth/saml`        | Unlocks enterprise IdP onboarding          | External SAML proxy       | IAM Engineer       | 2026-09-29 |
| DEC-ENT-P16-05 | Enforce S3 90-day Glacier lifecycle policy      | Reduces long-term storage costs by 60%     | Manual object deletion    | FinOps Lead        | 2026-09-29 |

---

## Assumption Register

| ID             | Assumption                                                 | Basis                                 | Risk if Wrong              | Owner           |
| -------------- | ---------------------------------------------------------- | ------------------------------------- | -------------------------- | --------------- |
| ASM-ENT-P16-01 | AWS EKS Multi-AZ cluster satisfies 99.95% availability SLO | AWS SLA commitments                   | Availability SLO breach    | Cloud Architect |
| ASM-ENT-P16-02 | Continuous WAL archiving maintains RPO ≤ 30 seconds        | Demonstrated 14.8s RPO in dev/staging | Data loss on disaster      | Data Architect  |
| ASM-ENT-P16-03 | PgBouncer sustains up to 500 active tenant pools           | Benchmarked connection scaling        | Connection pool exhaustion | SRE             |
| ASM-ENT-P16-04 | Sigstore Fulcio/Rekor availability exceeds 99.9%           | Public Sigstore SLOs                  | Blocked CI/CD pipeline     | DevOps Lead     |

---

## Traceability Register

| Req ID      | Requirement                           | Design Reference                   | Implementation File        | Verification Test           | Evidence ID          |
| ----------- | ------------------------------------- | ---------------------------------- | -------------------------- | --------------------------- | -------------------- |
| ENT-P16-R01 | Automated Infrastructure as Code      | `01-infrastructure-as-code.md`     | Terraform / K8s manifests  | Conftest policy check       | EVD-ENT-P16-001..005 |
| ENT-P16-R02 | Cryptographic Build Provenance        | `03-sbom-provenance-signatures.md` | Cosign / Sigstore actions  | `cosign verify` step        | EVD-ENT-P16-010..013 |
| ENT-P16-R03 | Zero-Trust CI/CD Security Gates       | `02-secure-cicd-pipeline.md`       | GitHub Actions YAML        | SAST & coverage gates       | EVD-ENT-P16-006..009 |
| ENT-P16-R04 | Test Suite Baseline Integrity         | `05-test-results.md`               | `pytest` / `vitest`        | 1022/1022 pass verification | EVD-ENT-P16-020      |
| ENT-P16-R05 | Zero-Downtime Deployment & Rollback   | `04-deployment-and-rollback.md`    | Blue-green / Istio rules   | Canary health probe         | EVD-ENT-P16-014..016 |
| ENT-P16-R06 | Environment Parity & SAML Integration | `05-environment-evidence.md`       | `saml_router` / WAL config | SAML auth test              | EVD-ENT-P16-017..019 |
| ENT-P16-R07 | Gate Scorecard ≥95 & Zero Blockers    | `06-gate-report.md`                | §28 Scorecard Report       | Audit review                | EVD-ENT-P16-001..020 |

---

_Registers v1.0.0 — DevOps Lead — 2026-09-29_
