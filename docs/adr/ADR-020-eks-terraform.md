# ADR-020: EKS Deployment with Terraform

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom must be deployed to a production-grade Kubernetes cluster with automated provisioning, monitoring, and scaling. The infrastructure must support multi-environment deployment (dev, staging, prod), run in AWS, and be fully reproducible via Infrastructure as Code.

Options considered: EKS (Terraform), ECS (Terraform), Google GKE, DigitalOcean Kubernetes, Render.

## Decision

Deploy on **AWS EKS** provisioned and managed via **Terraform** with **Helm** and **Kustomize** overlays.

Infrastructure modules (`infra/terraform/`):
- `vpc` — VPC with public/private subnets across 3 AZs
- `eks` — EKS cluster with managed node groups (auto-scaling 2-10 nodes)
- `rds` — PostgreSQL RDS instance with Multi-AZ for production
- `elasticache` — Redis ElastiCache cluster for rate limiting and caching
- `ecr` — Container registries for app and service images
- `s3` — File storage bucket with KMS encryption
- `kms` — KMS key for encryption at rest
- `waf` — WAF ACL for CloudFront
- `cloudfront` — CDN with WAF, custom domain, ACM certificate
- `route53` — DNS routing
- `monitoring` — CloudWatch alarms, SNS alert topics

Kubernetes manifests (`infra/kubernetes/`) with Kustomize overlays per environment.

## Consequences

**Positive:**
- Full reproducibility — `terraform apply` on a fresh AWS account creates the identical infrastructure
- Multi-environment isolation via Terraform workspaces and separate `environments/` dirs
- EKS managed node groups auto-scale based on cluster load
- Kustomize overlays minimize duplication across dev/staging/prod
- Module separation enables individual component updates without full infrastructure changes

**Negative:**
- EKS control plane costs ~$73/month before any workloads
- Terraform state must be stored remotely (S3 + DynamoDB locking) for team collaboration
- RDS Multi-AZ doubles database cost — only enabled for production
- Kubernetes learning curve for team members — required for debugging deployment issues
- Module dependency graph means some changes (e.g., VPC CIDR) require coordinated updates across multiple modules
