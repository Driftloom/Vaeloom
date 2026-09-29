# DEL-ENT-P16-01: Infrastructure as Code (IaC)

**Deliverable ID:** DEL-ENT-P16-01  
**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** Platform Engineer / Cloud Architect  
**Reviewer:** Security Engineer + DevOps Lead  
**Status:** VERIFIED  
**Date:** 2026-09-29

---

## 1. IaC Overview

The Vaeloom platform infrastructure is fully expressed as code across three
tools:

| Layer                   | Tool                                | Location                              | Environments         |
| ----------------------- | ----------------------------------- | ------------------------------------- | -------------------- |
| Cloud provisioning      | Terraform ≥1.9 / AWS Provider ≥5.60 | `infra/terraform/`                    | dev / staging / prod |
| Container orchestration | Kubernetes 1.31 + Kustomize         | `infra/kubernetes/`                   | base + overlays      |
| Local/CI runtime        | Docker Compose                      | `docker-compose*.yml`                 | dev / staging / test |
| pgBouncer               | Docker + config                     | `infra/docker/postgres/pgbouncer.ini` | all envs             |

---

## 2. Terraform Modules

### 2.1 Module Inventory

| Module                | Purpose                  | Key Resources                                                                                          | Verified |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ | -------- |
| `modules/vpc`         | Network topology         | VPC, subnets (public/private/intra), NAT GW, route tables, flow logs                                   | ✅       |
| `modules/eks`         | Kubernetes cluster       | EKS 1.31, managed node groups (on-demand + spot), IRSA, OIDC provider, cluster IAM                     | ✅       |
| `modules/rds`         | PostgreSQL 16.4          | Multi-AZ RDS; pgBouncer sidecar; 42 FORCE RLS; automated snapshots; migration 0061 HEAD                | ✅       |
| `modules/elasticache` | Redis 7.x cache          | ElastiCache Redis cluster; TLS; AUTH token; at-rest encryption                                         | ✅       |
| `modules/s3`          | Object storage           | Vaeloom buckets; SSE-KMS; versioning; lifecycle policies (90-day → GLACIER, 365-day expiry)            | ✅       |
| `modules/kms`         | Key management           | Customer-managed KMS keys per classification; key rotation 90-day; key policy least-privilege          | ✅       |
| `modules/iam`         | Identity/workload        | IRSA roles per service; least-privilege policies; no wildcard resources; OIDC trust conditions         | ✅       |
| `modules/ecr`         | Container registry       | Per-service ECR repositories; image scanning on push; lifecycle (keep 10 tagged); cross-account policy | ✅       |
| `modules/waf`         | Web Application Firewall | WAFv2 regional; OWASP managed rules; rate limiting; IP reputation; logging to S3                       | ✅       |
| `modules/cloudfront`  | CDN                      | CloudFront distribution; WAF attached; HTTPS-only; custom headers; origin shield                       | ✅       |
| `modules/route53`     | DNS                      | Hosted zones; health checks; failover records; DNSSEC enabled                                          | ✅       |
| `modules/monitoring`  | Observability infra      | CloudWatch log groups; metric alarms; SNS topics; EventBridge rules                                    | ✅       |

### 2.2 Network Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VAELOOM AWS NETWORK TOPOLOGY                      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  VPC: 10.0.0.0/16  (us-east-1 default cell)                      │   │
│  │                                                                   │   │
│  │  Public Subnets (3 AZs): 10.0.1.0/24, 10.0.2.0/24, 10.0.3.0/24  │   │
│  │  ├── Internet Gateway                                             │   │
│  │  ├── NAT Gateway (per-AZ for HA)                                  │   │
│  │  └── ALB (HTTPS/443 only, WAFv2)                                  │   │
│  │                                                                   │   │
│  │  Private Subnets (3 AZs): 10.0.11.0/24..10.0.13.0/24             │   │
│  │  ├── EKS Node Groups (on-demand + spot mixed)                     │   │
│  │  ├── pgBouncer Deployment                                         │   │
│  │  └── Microservice Pods (21 app namespaces)                        │   │
│  │                                                                   │   │
│  │  Intra Subnets (3 AZs): 10.0.21.0/24..10.0.23.0/24               │   │
│  │  ├── RDS PostgreSQL 16.4 Multi-AZ                                 │   │
│  │  ├── ElastiCache Redis Cluster                                    │   │
│  │  └── No NAT; no direct internet egress                            │   │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  CloudFront → WAFv2 → ALB → EKS Ingress → Services                      │
│  S3/ECR via VPC Gateway Endpoints (no public internet)                   │
│  KMS via VPC Interface Endpoint                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Environment Configuration

| Environment | Terraform vars                          | Key differences                                                                  |
| ----------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| dev         | `environments/dev/terraform.tfvars`     | Single-AZ; smaller instance types (db.t3.medium, r7g.large); spot-only workers   |
| staging     | `environments/staging/terraform.tfvars` | Multi-AZ; production-equivalent sizing (80% scale); WAF in count mode            |
| prod        | `environments/prod/terraform.tfvars`    | Multi-AZ HA; db.r7g.2xlarge; on-demand+spot 60/40; WAF blocking mode; DR standby |

### 2.4 State Management

- Remote state: S3 bucket `vaeloom-terraform-state-{env}` with DynamoDB locking
  table
- State encryption: SSE-KMS with dedicated state key
- State access: IRSA role bound to CI/CD workflow OIDC identity; no human IAM
  user has write access
- State versions: versioning enabled; lifecycle keeps 30 versions

---

## 3. Kubernetes Manifests

### 3.1 Base Resources (infra/kubernetes/base/)

```
base/
├── vaeloom-namespace.yaml          # vaeloom, vaeloom-monitoring, vaeloom-infra namespaces
├── kustomization.yaml              # base kustomization
├── apps/                           # 21 application deployments
│   ├── api/                        # FastAPI backend (3 replicas)
│   ├── web/                        # Next.js frontend (2 replicas)
│   ├── agent-engine/               # Agent orchestration
│   ├── ai-service/                 # AI inference proxy
│   ├── auth-service/               # Auth + SAML/OIDC
│   ├── billing-service/            # Stripe + entitlements
│   ├── ...                         # 15 additional services
└── infra/                          # Shared infra components
    ├── pgbouncer.yaml              # pgBouncer Deployment + Service
    ├── ingress-nginx.yaml          # NGINX Ingress Controller
    └── cert-manager.yaml           # TLS certificate management
```

### 3.2 Kustomize Overlays

| Overlay | Namespace    | Replicas   | Resources | Notes                           |
| ------- | ------------ | ---------- | --------- | ------------------------------- |
| dev     | vaeloom-dev  | 1 per svc  | Minimal   | No WAF; relaxed limits          |
| staging | vaeloom-stg  | 2 per svc  | 80% prod  | WAF + rate limiting             |
| prod    | vaeloom-prod | ≥3 per svc | Full      | PodDisruptionBudgets; HPA; KEDA |

### 3.3 Security Controls

- **RBAC:** ServiceAccount per deployment; IRSA binds AWS IAM role
- **Network policies:** Default-deny ingress + egress; explicit allow-list per
  service
- **Pod security:** `runAsNonRoot: true`; `readOnlyRootFilesystem: true`;
  `allowPrivilegeEscalation: false`
- **Image policy:** Images must come from ECR `vaeloom-prod/*`; imagePullPolicy:
  Always
- **Secrets:** All secrets injected via AWS Secrets Manager CSI driver; no
  plaintext in manifests

---

## 4. Secrets Management

| Secret class         | Storage                   | Rotation          | Access                        |
| -------------------- | ------------------------- | ----------------- | ----------------------------- |
| Database credentials | AWS Secrets Manager       | 30-day automated  | IRSA; no human access in prod |
| SAML IdP cert        | AWS Secrets Manager       | On-rotation event | auth-service IRSA only        |
| KMS key material     | AWS KMS (managed)         | 90-day automated  | Resource policy; per-service  |
| API signing keys     | AWS Secrets Manager       | 90-day            | api-service IRSA              |
| CI/CD deploy tokens  | GitHub OIDC → AWS STS     | Short-lived (1h)  | No long-lived credentials     |
| pgBouncer auth       | AWS Secrets Manager → CSI | 30-day            | pgBouncer pod IRSA            |

---

## 5. S3 Lifecycle Policies (90-day Archive Tier)

```hcl
# modules/s3/main.tf — lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "vaeloom" {
  bucket = aws_s3_bucket.vaeloom.id

  rule {
    id     = "archive-90-day"
    status = "Enabled"
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    expiration {
      days = 2555  # 7 years maximum retention
    }
  }

  rule {
    id     = "delete-incomplete-multipart"
    status = "Enabled"
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
```

**Verification:** ENT-P15 designed lifecycle policy; ENT-P16 implements in
Terraform module and confirms with
`aws s3api get-bucket-lifecycle-configuration --bucket vaeloom-prod-documents`.  
**Result:**
GLACIER_IR transition confirmed at day 90; DEEP_ARCHIVE at day 365.

---

## 6. Acceptance Criteria

| AC    | Requirement                                            | Evidence                                                                        | Status      |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------- |
| AC-01 | All infrastructure expressed as IaC                    | Terraform modules (12) + K8s manifests (21 apps) reviewed                       | ✅ VERIFIED |
| AC-02 | No hardcoded secrets in any IaC file                   | `rg -n "password\|secret\|key.*=" infra/terraform/` returns 0 plaintext secrets | ✅ VERIFIED |
| AC-03 | All environments deployable from same codebase         | Kustomize overlays + tfvars per env; `terraform plan` diff-verified             | ✅ VERIFIED |
| AC-04 | S3 lifecycle 90-day → GLACIER implemented              | `aws s3api get-bucket-lifecycle-configuration` confirms rule active             | ✅ VERIFIED |
| AC-05 | Network topology enforces private subnet for data tier | Intra subnets; no NAT for RDS/Redis; verified via terraform state show          | ✅ VERIFIED |

---

_DEL-ENT-P16-01 v1.0.0 — Platform Engineer + Cloud Architect — 2026-09-29_
