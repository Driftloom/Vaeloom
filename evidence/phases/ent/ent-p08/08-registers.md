# ENT-P08 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P08` (API Integration and Contract Design)  
> **Deliverable:** `DEL-ENT-P08-08` — Consolidated Governance Registers  
> **Owner:** API Governance Custodian & Integration Risk Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                                   | Severity |          Impact           | Mitigation Strategy                                                                                               | Owner            |     Status     |
| :------------------ | :----------------------------------------------------------------------------------------------------------------- | :------: | :-----------------------: | :---------------------------------------------------------------------------------------------------------------- | :--------------- | :------------: |
| **RISK-ENT-P08-01** | Third-party webhook consumers fail to process events, causing delivery retry backlog and worker starvation.        |   High   |     Queue saturation      | Exponential backoff with jitter; per-subscriber circuit breaker (suspends after 50 consecutive failures); DLQ.    | Integration Lead | **CONTROLLED** |
| **RISK-ENT-P08-02** | External MCP server execution hangs or attempts server-side request forgery (SSRF) against internal VPC endpoints. | Critical |  Lateral movement / DoS   | Subprocess sandbox; hard 30s execution timeout; strict HTTPS & private IPv4/IPv6 blocking in `url_guard.py`.      | AppSec Lead      | **CONTROLLED** |
| **RISK-ENT-P08-03** | Breaking changes introduced into API schemas without sufficient deprecation notice break enterprise client apps.   |   High   |  Partner service outage   | Automated CI contract diffing via `openapi-diff`; strict 12-month deprecation lifecycle; RFC 8594 Sunset headers. | API Standards    | **CONTROLLED** |
| **RISK-ENT-P08-04** | Distributed denial of service or credential stuffing exhausts backend database connection pool.                    |   High   |    Service degradation    | Redis sliding-window rate limiters; fail2ban IP blocks; Cloudflare WAF; early 429 response prior to DB lookup.    | SecOps Lead      | **CONTROLLED** |
| **RISK-ENT-P08-05** | Unauthorized candidate data extraction via malicious prompt injection manipulating agent tool calling.             | Critical | Data confidentiality leak | System 1 (`noul`) HITL approval gate on destructive tools; XML context fencing; strict provenance validation.     | AI Safety Lead   | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                                 | Context & Alternatives                                                                                                                           | Chosen Rationale                                                                                        |    Status    |
| :----------------- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :----------: |
| **DEC-ENT-P08-01** | **OpenAPI 3.2.0 as Single Source of Truth**    | Alt A: Code-first without contract generation.<br>Alt B: OpenAPI 3.2.0 auto-generated from FastAPI with CI diff validation.                      | Chose Alt B. Guarantees zero schema drift between implementation and client SDKs.                       | **APPROVED** |
| **DEC-ENT-P08-02** | **Standard Webhooks HMAC-SHA256 Signing**      | Alt A: Unsigned plain HTTP webhooks.<br>Alt B: Standard Webhooks HMAC-SHA256 with timestamp tolerance window ($\pm 5\text{m}$).                  | Chose Alt B. Eliminates payload tampering, guarantees origin authenticity, and prevents replay attacks. | **APPROVED** |
| **DEC-ENT-P08-03** | **Native Model Context Protocol (MCP) Bridge** | Alt A: Proprietary custom tool protocol.<br>Alt B: Open Model Context Protocol (MCP) v2 adapters (`mcp_client_service.py`).                      | Chose Alt B. Maximizes ecosystem interoperability with existing enterprise and developer tools.         | **APPROVED** |
| **DEC-ENT-P08-04** | **SCIM v2.0 Enterprise Directory Sync**        | Alt A: Manual user CSV import.<br>Alt B: RFC 7643 / RFC 7644 SCIM v2.0 endpoints for automated IdP sync.                                         | Chose Alt B. Enables zero-touch enterprise onboarding and automated security deprovisioning.            | **APPROVED** |
| **DEC-ENT-P08-05** | **12-Month Enterprise Deprecation Window**     | Alt A: Fast 3-month deprecation cycles.<br>Alt B: 12-Month deprecation lifecycle with RFC 8594 Sunset and Deprecation headers.                   | Chose Alt B. Meets strict procurement standards of enterprise higher-education and corporate customers. | **APPROVED** |
| **DEC-ENT-P08-06** | **Server-Derived Context Enforcement**         | Alt A: Trust client-supplied tenant/workspace headers.<br>Alt B: Server-side derivation of tenant and workspace scopes from verified JWT claims. | Chose Alt B. Prevents spoofing and privilege escalation across tenant boundaries.                       | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                  | Validation Method                                                                   | Invalidation Action                                                                  |    Status     |
| :----------------- | :------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P08-01** | Enterprise customers support SCIM v2.0 for automated user provisioning (e.g., Microsoft Entra ID, Okta). | Protocol verification against official Microsoft and Okta SCIM test harnesses.      | Provide secondary CSV bulk import and SAML JIT (Just-In-Time) provisioning fallback. | **VALIDATED** |
| **ASM-ENT-P08-02** | Redis sorted sets deliver sub-2ms latency for sliding-window rate limit checks under 1,000 RPS.          | Redis benchmark load tests simulating high-frequency sliding window evaluation.     | Cluster Redis rate limit nodes or deploy local Envoy rate limit sidecars.            | **VALIDATED** |
| **ASM-ENT-P08-03** | Model Context Protocol (MCP) specification maintains backward compatibility across minor tool revisions. | Active participation in MCP open-source working group and automated MCP test suite. | Pin MCP client SDK to explicit snapshot version (2026-07-28 profile).                | **VALIDATED** |
| **ASM-ENT-P08-04** | Enterprise firewall rules allow outbound webhook traffic over port 443 with TLS 1.3.                     | Validation with pilot enterprise design partners during network intake assessments. | Support dedicated static egress IP proxies for enterprise IP allowlisting.           | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category          | Primary Deliverable    | Implementing Spec / Policy                      | Verification                         |    Status    |
| :------------------- | :---------------- | :--------------------- | :---------------------------------------------- | :----------------------------------- | :----------: |
| **ENT-P08-R01**      | OpenAPI Contracts | `DEL-ENT-P08-01`       | `01-openapi-spec-and-contracts.md`              | 241 paths / 294 ops validated        | **VERIFIED** |
| **ENT-P08-R02**      | Webhooks & Events | `DEL-ENT-P08-02`       | `02-event-webhook-job-schemas.md`               | Standard Webhooks HMAC-SHA256        | **VERIFIED** |
| **ENT-P08-R03**      | SDK & MCP         | `DEL-ENT-P08-03`       | `03-sdk-tool-mcp-contracts.md`                  | TypeScript/Python SDK & MCP bridge   | **VERIFIED** |
| **ENT-P08-R04**      | AuthN & SCIM      | `DEL-ENT-P08-04`       | `04-authn-authz-rate-limits.md`                 | SCIM v2.0 & RS256 token lifecycle    | **VERIFIED** |
| **ENT-P08-R05**      | Rate Limiting     | `DEL-ENT-P08-04`       | `04-authn-authz-rate-limits.md`                 | Redis sliding window & `Retry-After` | **VERIFIED** |
| **ENT-P08-R06**      | Deprecation       | `DEL-ENT-P08-05`       | `05-compatibility-deprecation-policy.md`        | 12-month policy & RFC 8594 Sunset    | **VERIFIED** |
| **ENT-P08-R07**      | Security Tests    | `DEL-ENT-P08-07`       | `05-test-results.md`                            | 404 security tests passing green     | **VERIFIED** |
| **ENT-P08-R08**      | Quality Gate      | `DEL-ENT-P08-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p09.md` | Score: 99.31 / 100 (Full GO)         | **VERIFIED** |

---

_Signed: API Governance Custodian & Integration Risk Lead — 2026-09-29_
