# Finding: Documentation-to-Reality Gaps

| Metadata           | Value              |
| ------------------ | ------------------ |
| **ID**             | FINDING-004        |
| **Severity**       | P1-HIGH            |
| **Status**         | OPEN               |
| **Date**           | 2026-08-16         |
| **Assigned Phase** | P11                |
| **Owner**          | Documentation Team |

## Description

Multiple architecture documents contain claims that don't match the actual
codebase. This creates false confidence and misleads new engineers.

## False Claims Found

| Document                    | Claim                           | Reality                             |
| --------------------------- | ------------------------------- | ----------------------------------- |
| `02-system-architecture.md` | Desktop Companion exists        | No Electron app, no code            |
| `02-system-architecture.md` | VS Code Extension exists        | No extension code                   |
| `02-system-architecture.md` | OCR Engine functional           | Returns "pytesseract not installed" |
| `Infrastructure.md`         | CDN / Load Balancer configured  | No CDN config exists                |
| `Infrastructure.md`         | Grafana dashboards deployed     | No dashboard JSON files             |
| `Infrastructure.md`         | Terraform for production        | No Terraform files                  |
| `Data-Flow.md`              | PII Redaction implemented       | Only a prompt mentions PII          |
| `Data-Flow.md`              | Field-level encryption          | Not implemented                     |
| `System-Design.md`          | mTLS between API and AI         | Same FastAPI process                |
| `System-Design.md`          | WebSocket implemented           | No WebSocket endpoint               |
| `ADR-013`                   | All queries filter by tenant_id | Most routes don't filter            |

## Impact

- New engineers waste time trying to use non-existent features
- Security audits may accept documentation claims without code verification
- Product decisions are made based on fictional capabilities

## Remediation

1. Mark all aspirational docs with `STATUS: SPEC_ONLY` or `STATUS: ASPIRATIONAL`
2. Add runtime status labels to C4 diagrams (✅/⚠️/❌)
3. Create a "Reality Check" quarterly review process
4. Never claim a feature is "implemented" without runtime evidence

## Related

- `docs/phases/mvp-p05/12-comprehensive-audit-findings.md` — Part 3
