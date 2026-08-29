# Finding: Missing Infrastructure Components

| Metadata           | Value       |
| ------------------ | ----------- |
| **ID**             | FINDING-005 |
| **Severity**       | P1-HIGH     |
| **Status**         | OPEN        |
| **Date**           | 2026-08-16  |
| **Assigned Phase** | P16         |
| **Owner**          | DevOps Team |

## Description

Several infrastructure components described in architecture docs don't exist in
the codebase.

## Missing Components

| Component          | Documentation Claims            | Reality                      |
| ------------------ | ------------------------------- | ---------------------------- |
| **Terraform**      | `infra/terraform/` with modules | No Terraform files exist     |
| **Grafana**        | Dashboards + alerts             | No dashboard JSON, no config |
| **OTel Collector** | Deployed for telemetry          | No collector config          |
| **WebSocket**      | Real-time push notifications    | No WebSocket endpoint        |
| **CDN**            | CloudFront / Cloudflare         | No CDN config                |
| **Load Balancer**  | ALB for EKS                     | No ALB config                |
| **S3/R2**          | Object storage                  | Only local MinIO             |
| **mTLS**           | Between API and AI service      | Same FastAPI process         |

## Impact

- Cannot deploy to production without IaC
- No observability into system health
- No real-time features
- No SSL/TLS between services

## Remediation

1. Create Terraform modules for: VPC, EKS, RDS, ElastiCache, S3
2. Deploy Grafana with pre-built dashboards
3. Configure OTel Collector with traces → Jaeger, metrics → Prometheus
4. Implement WebSocket for real-time agent progress
5. Set up CDN for static assets

## Related

- `docs/architecture/Infrastructure.md` — infrastructure design
- `docs/adr/ADR-020-eks-terraform.md` — EKS/Terraform decision
