# Enterprise

> **Purpose:** Enterprise features, multi-tenancy, consent model, and the full enterprise product vision
> **Status:** ? Active
> **Owner:** Product Team
> **Version:** 1.1
> **Last Updated:** 2026-07-16

## Overview

The Enterprise directory documents Vaeloom's enterprise product vision, multi-tenant architecture, consent model, and enterprise build prompts. These documents define how Vaeloom scales from individual accounts to organization-provisioned enterprise deployments.

Key topics include the enterprise product vision, enterprise architecture with AI components, the multi-tenant and consent model, enterprise build prompts, and future innovations. The MVP-to-enterprise migration path ensures schema forward-compatibility and a clear growth trajectory from 8 to 28 agents and 6 to 20+ memory types.

The consent model is a critical architectural component that enables tenant-provisioned accounts while preserving individual memory ownership through granular, revocable consent, ensuring enterprise adoption does not compromise the core product philosophy.

## What's here

| Document | Location | Status |
|----------|----------|--------|
| Enterprise Product Vision | [`/docs/06-Vaeloom-Enterprise-Paper.md`](../../docs/06-Vaeloom-Enterprise-Paper.md) | ? Excellent |
| Enterprise Architecture | [`./Enterprise-Architecture.md`](./Enterprise-Architecture.md) | ? Complete |
| Multi-Tenancy | [`./Multi-Tenancy.md`](./Multi-Tenancy.md) | ?? New |
| Organizations | [`./Organizations.md`](./Organizations.md) | ?? New |
| Billing | [`./Billing.md`](./Billing.md) | ?? New |
| Licensing | [`./Licensing.md`](./Licensing.md) | ?? New |
| Admin Portal | [`./Admin-Portal.md`](./Admin-Portal.md) | ?? New |
| Feature Flags | [`./Feature-Flags.md`](./Feature-Flags.md) | ?? New |
| Plugin Marketplace | [`./Plugin-Marketplace.md`](./Plugin-Marketplace.md) | ?? New |
| Enterprise APIs | [`./Enterprise-APIs.md`](./Enterprise-APIs.md) | ?? New |
| Enterprise Build Prompts | [`../Engineering/Implementation/`](../Engineering/Implementation/) | ? Canonical |

```mermaid
graph LR
    subgraph MVP["📱 MVP"]
        M1["Individual Accounts"]
        M2["Email/Password Auth"]
        M3["5 Core Connectors"]
        M4["8 Specialist Agents"]
        M5["6 Memory Types"]
        M6["Internal Tools Only"]
    end

    subgraph Scale["⬆️ Growth Path"]
        S1["Schema Forward-Compatible"]
        S2["Agent Roster Grows"]
        S3["MCP-Shaped from Day One"]
        S4["Permission Model Scales"]
    end

    subgraph Enterprise["🏢 Enterprise"]
        E1["Individual + Org-Provisioned"]
        E2["+ SAML/OIDC SSO"]
        E3["25+ Connectors + Plugin SDK"]
        E4["28 Full Agent Roster"]
        E5["20+ Full Memory Taxonomy"]
        E6["Plugin Marketplace"]
        E7["Admin Console + RBAC"]
        E8["Verified Tenant Isolation"]
    end

    MVP --> Scale --> Enterprise

    classDef mvp fill:#e3f2fd,stroke:#1565c0
    classDef scale fill:#e8f5e9,stroke:#2e7d32,stroke-dasharray: 5 5
    classDef ent fill:#fff3e0,stroke:#e65100

    class M1,M2,M3,M4,M5,M6 mvp
    class S1,S2,S3,S4 scale
    class E1,E2,E3,E4,E5,E6,E7,E8 ent
```

## Enterprise vs MVP: key differences

| Capability | MVP | Enterprise |
|------------|-----|------------|
| User model | Individual accounts | Individual + org-provisioned |
| Auth | Email/password | + SAML/OIDC SSO |
| Permissions | Per-agent autonomy | + RBAC at tenant level |
| Connectors | 5 core connectors | 25+ including LMS, HRIS |
| Agents | 8 specialist agents | 28 full roster |
| Memory types | 6 types | 20+ full taxonomy |
| Plugin ecosystem | Internal tools only | Plugin SDK + Marketplace |
| Admin console | None | Full tenant management |
| Data isolation | Workspace-scoped | Verified tenant isolation |

## The consent model (critical architecture)

The consent model makes enterprise (tenant-provisioned) accounts work without compromising the core promise that a person's memory belongs to them:

- Organization can provision accounts and set policy boundaries
- Organization **cannot** read individual memory contents without explicit, granular, revocable consent
- Consent revoked → organization access reduced going forward (not retroactive)

## Migration path from MVP

The MVP and Enterprise designs share the same architecture at two points in time:

1. Memory schema is forward-compatible (6 types → 20+ types)
2. Agent roster grows, never replaces
3. Connector shape is consistent (MCP-shaped from day one)
4. Permission model scales (suggest-mode → consent model → RBAC)

## Goals

- Provide a high-level entry point to Vaeloom's enterprise product vision and architecture
- Document the MVP-to-enterprise migration path and schema forward-compatibility
- Define the consent model that enables org-provisioned accounts while preserving individual memory ownership
- Index all enterprise-related documentation for easy navigation
- Communicate the key differences between MVP and enterprise capabilities

---

## Scope

### In Scope

- Enterprise product vision overview
- Multi-tenant and consent model description
- MVP-to-enterprise migration path
- Enterprise documentation index
- Key differences between MVP and enterprise capabilities

### Out of Scope

- Detailed enterprise architecture (covered in Enterprise-Architecture.md)
- Full enterprise product spec (covered in Enterprise Paper)
- Implementation timelines beyond MVP roadmap
- Pricing and tier model details

---

## Examples

```bash
# Enterprise deployment
Vaeloom enterprise init --cluster-size 5
Vaeloom enterprise config set --key sso.saml.enabled --value true
Vaeloom enterprise audit-log export --from 2025-01-01 --to 2025-06-30
```

```yaml
# Enterprise SSO configuration
sso:
  provider: saml
  idp_metadata_url: "https://idp.company.com/metadata"
  attribute_mapping:
    email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    groups: "http://schemas.company.com/claims/groups"
```

```bash
# Enterprise license management
Vaeloom enterprise license validate
Vaeloom enterprise usage report --month 2025-06
```

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Full enterprise tenant isolation implementation | High | High | Q2 2027 |
| Enterprise SSO provider certification matrix | Medium | Medium | Q1 2027 |
| Enterprise pricing and tier model validation | Medium | Low | Q4 2026 |

## Related categories

- [`Product/`](../Product/) — MVP product spec (foundation)
- [`Security/`](../Security/) — Enterprise security and compliance
- [`Architecture/`](../Architecture/) — Enterprise architecture foundations
- [`Operations/`](../Operations/) — Runbooks for enterprise operations

## Related Documents

- [Enterprise Product Vision](../06-Vaeloom-Enterprise-Paper.md) — Full enterprise paper
- [Enterprise Architecture](./Enterprise-Architecture.md) — Multi-tenant deep dive
- [Security Overview](../Security/README.md) — Enterprise security and compliance
