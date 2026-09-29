# ENT-P16 Source Register

**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** DevOps Lead  
**Date:** 2026-09-29

---

## Internal Sources (INT-01..10)

| ID     | Source                                                        | Owner/Authority     | Use                                                                                                    | Location                     | Status      |
| ------ | ------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | Vaeloom source team | Governing 32-section prompt, evidence, DoR/DoD, gate and remediation                                   | /specs/                      | ✅ VERIFIED |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md                        | Vaeloom source team | Authoritative MVP corrections and release evidence                                                     | /specs/                      | ✅ VERIFIED |
| INT-03 | vaeloom-mvp-e2e.md                                            | Vaeloom source team | MVP 0–21 execution baseline                                                                            | /specs/                      | ✅ VERIFIED |
| INT-04 | vaeloom-enterprise-e2e.md                                     | Vaeloom source team | Enterprise 0–21 execution baseline                                                                     | /specs/                      | ✅ VERIFIED |
| INT-05 | 01-vaeloom-mvp-spec.md                                        | Vaeloom source team | Canonical MVP product scope                                                                            | /specs/                      | ✅ VERIFIED |
| INT-06 | 06-vaeloom-enterprise-paper.md                                | Vaeloom source team | Canonical enterprise vision                                                                            | /specs/                      | ✅ VERIFIED |
| INT-07 | ENT-P13 security evidence (INV-SEC-01..05)                    | Security Architect  | Security invariants inherited by all phases                                                            | evidence/phases/ent/ent-p13/ | ✅ VERIFIED |
| INT-08 | ENT-P14 quality evidence (INV-QA-01..05)                      | QA Lead             | Quality invariants and test baseline 1022/1022                                                         | evidence/phases/ent/ent-p14/ | ✅ VERIFIED |
| INT-09 | ENT-P15 performance evidence + handoff                        | SRE + CTO           | Performance baseline, capacity model, DR results, open action items                                    | evidence/phases/ent/ent-p15/ | ✅ VERIFIED |
| INT-10 | Existing IaC: infra/terraform, infra/kubernetes, infra/docker | Platform Engineer   | Terraform modules (VPC/EKS/RDS/S3/KMS/WAF/ECR/ElastiCache); 21 K8s app deployments; Docker Dockerfiles | /infra/                      | ✅ VERIFIED |

---

## External Sources (EXT-01..10)

| ID     | Source                                           | Version/Date       | Owner                               | Use                                                                                   | Applicability                         | Status      |
| ------ | ------------------------------------------------ | ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ----------- |
| EXT-01 | SLSA specification                               | v1.2 (2024-05-17)  | OpenSSF                             | Build provenance; SLSA Level 3 requirements; artifact integrity                       | APPLICABLE — governs CI/CD provenance | ✅ VERIFIED |
| EXT-02 | Sigstore / cosign                                | cosign v2.4.x      | Sigstore project                    | Container signing; keyless signing workflow; attestation                              | APPLICABLE — container signing        | ✅ VERIFIED |
| EXT-03 | Trivy vulnerability scanner                      | v0.55.x            | Aqua Security                       | CVE scanning; SBOM generation (CycloneDX); HIGH/CRITICAL gating                       | APPLICABLE — CI/CD scanning gate      | ✅ VERIFIED |
| EXT-04 | NIST SSDF SP 800-218 v1.1                        | Current            | NIST                                | Secure software development; build separation; supply chain                           | APPLICABLE — pipeline hardening       | ✅ VERIFIED |
| EXT-05 | GitHub Actions — workflow security hardening     | 2026-current       | GitHub                              | Workflow permissions; OIDC token; branch protection; environment gating               | APPLICABLE — CI/CD implementation     | ✅ VERIFIED |
| EXT-06 | Terraform AWS Provider                           | ≥5.60.0            | HashiCorp                           | IaC for AWS resources; EKS/RDS/S3/VPC/KMS/WAF/ECR                                     | APPLICABLE — infrastructure code      | ✅ VERIFIED |
| EXT-07 | pgBouncer documentation                          | v1.23.x            | PostgreSQL community                | Connection pooling; transaction mode; TLS auth; monitoring                            | APPLICABLE — database pooling         | ✅ VERIFIED |
| EXT-08 | PostgreSQL WAL archiving / streaming replication | PostgreSQL 16 docs | PostgreSQL Global Development Group | WAL streaming; pg_basebackup; archive_command; RPO                                    | APPLICABLE — DR streaming             | ✅ VERIFIED |
| EXT-09 | CycloneDX SBOM specification                     | v1.6               | OWASP                               | Software Bill of Materials schema; dependency tracking                                | APPLICABLE — SBOM generation          | ✅ VERIFIED |
| EXT-10 | Kubernetes documentation                         | v1.31              | CNCF/Kubernetes                     | Deployment manifests; namespace isolation; RBAC; network policies; Kustomize overlays | APPLICABLE — container orchestration  | ✅ VERIFIED |

---

## Conflict Resolution

No source conflicts identified. All external standards are additive to internal
architecture decisions.  
Canonical authority order: repository implementation > approved ENT-P13..P15
evidence > design prose > secondary sources.

---

_Source register v1.0.0 — DevOps Lead — 2026-09-29_
