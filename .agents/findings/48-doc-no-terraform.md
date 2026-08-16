# Finding: No Infrastructure-as-Code

| Metadata     | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| **ID**       | FIND-DOC-009                                                               |
| **Severity** | P1-HIGH                                                                    |
| **Status**   | OPEN                                                                       |
| **Source**   | Documentation Audit                                                        |
| **Files**    | `docs/architecture/Infrastructure.md`, `docs/adr/ADR-020-eks-terraform.md` |

## Description

`Infrastructure.md` and ADR-020 describe Terraform modules for VPC, EKS, RDS,
ElastiCache. No Terraform files exist anywhere in the repo. No
`infra/terraform/` directory. No IaC of any kind.

## Impact

- Cannot deploy to production
- No reproducible infrastructure
- Manual deployment only

## Remediation

Create Terraform modules or mark infrastructure claims as
`STATUS: ASPIRATIONAL`.
