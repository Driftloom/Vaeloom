# ENT-P05 — 02 Service Contracts & Cell Topology Specification

> **Phase:** `ENT-P05` (Solution Architecture)  
> **Deliverable:** `DEL-ENT-P05-02` (v1.0)  
> **Owner:** Lead Systems Architect & API Platform Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Global Control Plane vs Regional Cell Interface Contracts

The platform enforces a strict architectural boundary between the **Global
Control Plane (GCP)** and **Regional Tenant Cells (RTC)**.

| Dimension              | Global Control Plane (GCP)                                   | Regional Tenant Cell (RTC)                                              |
| :--------------------- | :----------------------------------------------------------- | :---------------------------------------------------------------------- |
| **Physical Scope**     | Cloudflare Edge / Anycast Global Network                     | Dedicated AWS / GCP regional VPCs (us-east-1, eu-central-1, ap-south-1) |
| **Data Handled**       | Tenant routing metadata, DNS records, OIDC broker            | All candidate personal data, resumes, embeddings, documents             |
| **PII Storage Policy** | **ZERO PII:** Tenant slug $\rightarrow$ Cell ID mapping only | Full tenant isolation with PostgreSQL RLS & encrypted storage           |
| **Egress Policy**      | Ingress only; routes to regional cells                       | Zero cross-border data egress; local processing only                    |
| **Authentication**     | Validates IdP assertions; signs short-lived JWT              | Verifies JWT signatures; injects local database session GUCs            |

### Routing Protocol Specification

Incoming HTTP and WebSocket requests are routed by the Global Edge Proxy using
header inspection:

```http
GET /api/v1/resumes HTTP/1.1
Host: api.vaeloom.com
Authorization: Bearer eyJhbGciOi...
X-Vaeloom-Tenant-ID: acme-university
X-Vaeloom-Cell-ID: cell-us-east-1
```

1. **Edge Lookup:** Global Edge Proxy queries an in-memory Redis cell directory
   mapping `acme-university` $\rightarrow$ `cell-us-east-1.internal`.
2. **mTLS Forwarding:** Edge proxy forwards request to the regional cell ingress
   gateway over dedicated wireguard/mTLS tunnels.
3. **Local Resolution:** Cell gateway validates the JWT signature against the
   local public key set and enforces tenant matching.

---

## 2. Core Service Interface Contracts

### Contract 1: SCIM v2.0 Identity Provisioning (RFC 7643 / RFC 7644)

Enables enterprise identity providers (Okta, Entra ID) to automatically sync
institutional users and roles:

- **Base URI:** `https://api.vaeloom.com/scim/v2/`
- **Supported Endpoints:**
  - `GET /Users`: Filter users by username or email.
  - `POST /Users`: Provision user into institutional tenant, assigning `advisor`
    or `candidate` role.
  - `PUT /Users/{id}` / `PATCH /Users/{id}`: Update user attributes, active
    status, or departmental cohort.
  - `DELETE /Users/{id}`: Deactivate user account (soft delete; sets
    `active=false`, revokes session tokens).
  - `GET /Groups`, `POST /Groups`: Map enterprise security groups to academic
    cohorts.

### Contract 2: Model Context Protocol (MCP) Connector Adapter (2026-07-28 Standard)

External ATS and career platforms interface via standard Model Context Protocol
servers:

- **Adapter Scope:** Sandboxed subprocess or HTTP streamable connection.
- **Tool Signature Template:**

```json
{
  "name": "mcp__workday__get_job_requisition",
  "description": "Fetches job description, required qualifications, and ATS screening fields from Workday.",
  "parameters": {
    "type": "object",
    "properties": {
      "requisition_id": { "type": "string" },
      "tenant_id": { "type": "string" }
    },
    "required": ["requisition_id", "tenant_id"]
  },
  "readOnly": true,
  "timeout_seconds": 15
}
```

- **Execution Rules:** Read-only MCP tools execute autonomously; mutating or
  data-export MCP tools are intercepted by `approval_gated_tools()` in `loop.py`
  and require human-in-the-loop (HITL) advisor or candidate confirmation.

---

## 3. Database Session GUC Injection Specification

Database multi-tenancy is enforced natively inside PostgreSQL 16 via Row-Level
Security (RLS) using Grand Unified Configuration (GUC) session variables:

```sql
-- Executed at transaction start by TenantMiddleware via database.py:set_rls_session_vars
SET LOCAL app.tenant_id = 'org_acme_univ_1001';
SET LOCAL app.user_id = 'usr_cand_8820';
SET LOCAL app.workspace_id = 'ws_career_2026';
```

### Invariants Enforced by Database RLS:

1. **Tenant Isolation:** Every table query automatically appends an implicit
   `WHERE tenant_id = current_setting('app.tenant_id')`.
2. **Candidate Sovereignty:** Queries to `personal_memories` and
   `sovereign_vault` append
   `WHERE user_id = current_setting('app.user_id') OR id IN (SELECT memory_id FROM consent_grants WHERE grantee_id = current_setting('app.user_id') AND expires_at > NOW())`.
3. **Fail-Closed Guarantee:** If GUC session variables are missing or
   uninitialized, `current_setting('app.tenant_id', true)` returns `NULL`,
   causing PostgreSQL to evaluate conditions to false and returning **zero
   rows**.

---

## 4. Cross-Cell Privacy-Preserving Analytics Protocol

To provide global benchmarking insights without violating regional data
residency (GDPR/DPDP):

1. **Local Cell Aggregation:** Regional cells compute statistical aggregations
   (e.g. median time to hire, top 10 required skills by industry) using
   $k$-anonymity ($k \ge 50$) and Laplace differential privacy noise
   ($\epsilon = 0.5$).
2. **Zero Raw Egress:** Individual candidate resumes, names, student IDs, or
   verbatim bullet points **never leave the regional cell**.
3. **Encrypted Metric Sync:** Only anonymized, aggregated statistical vectors
   are transmitted to the Global Control Plane for global reporting dashboards.

_Signed: Lead Systems Architect & API Platform Lead — 2026-09-29_
