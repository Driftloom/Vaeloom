# API Versioning

> **Purpose:** Define Vaeloom's API versioning strategy for public REST APIs, internal RPC, and SDKs â€” version lifecycle, breaking-change policy, deprecation process, and migration guidance
> **Status:** ðŸ†• New
> **Owner:** Architecture Team
> **Version:** 1.0
> **Last Updated:** 2026-07-16
> **Dependencies:** [`API-Architecture.md`](./API-Architecture.md), [`API-Reference.md`](./API-Reference.md), [`REST-Standards.md`](./REST-Standards.md), [`../Engineering/Versioning.md`](../Engineering/Versioning.md), [`Service-Contracts.md`](./Service-Contracts.md)
> **Implementation Status:** ðŸ“‹ Spec Only

## Overview

API versioning is the contract between Vaeloom and its API consumers (frontend, SDKs, partners, enterprise integrations). Without a clear versioning strategy, breaking changes become a coordination nightmare and consumers lose trust. This document defines how Vaeloom versions its public API, internal RPC, and SDKs; what constitutes a breaking change; how deprecation works; and how consumers migrate between versions.

## Goals

- Define the versioning scheme for public REST API, internal RPC, and SDKs
- Establish breaking vs non-breaking change criteria
- Define version lifecycle (current, deprecated, sunset, retired)
- Document deprecation headers and timelines
- Provide migration guidance for consumers

## Scope

### In Scope

- Public REST API versioning (URL-based)
- Internal RPC versioning (protobuf package versioning)
- SDK versioning (semver)
- Version lifecycle and deprecation process
- Migration guides

### Out of Scope

- Detailed migration steps per endpoint (per-release migration guides)
- Feature flag strategy (see [`../Enterprise/Feature-Flags.md`](../Enterprise/Feature-Flags.md))

## Versioning Schemes

| API Type | Scheme | Format | Example |
|----------|--------|--------|---------|
| **Public REST** | URL-based major version | `/v{N}/...` | `/v1/documents`, `/v2/documents` |
| **Internal RPC** | Protobuf package version | `vaeloom.internal.v{N}` | `vaeloom.internal.v1.AgentService` |
| **SDK** | Semantic versioning (semver) | `MAJOR.MINOR.PATCH` | `@vaeloom/sdk@2.1.3` |

## Public REST API Versioning

### URL-Based

```bash
# Current version
GET https://api.vaeloom.dev/v1/documents

# Next version (when v2 is released)
GET https://api.vaeloom.dev/v2/documents
```text

### Rules

| Rule | Detail |
|------|--------|
| Only major versions are in the URL | `/v1/`, `/v2/` â€” never `/v1.2/` |
| Minor/patch changes are backward-compatible | No URL change for additive updates |
| Old versions supported for minimum 12 months after deprecation | Gives consumers time to migrate |
| Maximum 2 major versions live simultaneously | `/v1/` and `/v2/` can coexist; `/v3/` requires `/v1/` retirement |

## Breaking vs Non-Breaking Changes

```mermaid
graph TD
    classDef safe fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:2px
    classDef breaking fill:#ffcccc,stroke:#cc0000,color:#000,stroke-width:2px

    CHANGE["Proposed Change"] --> Q1{"Removes/renames<br/>field or endpoint?"}
    Q1 -->|"Yes"| BREAK["Breaking<br/>Requires new major version"]:::breaking
    Q1 -->|"No"| Q2{"Changes field type<br/>or semantics?"}
    Q2 -->|"Yes"| BREAK
    Q2 -->|"No"| Q3{"Adds optional field<br/>or new endpoint?"}
    Q3 -->|"Yes"| SAFE["Non-breaking<br/>Same major version"]:::safe
    Q3 -->|"No"| Q4{"Tightens validation<br/>(stricter rules)?"}
    Q4 -->|"Yes"| BREAK
    Q4 -->|"No"| SAFE
```text

> **Diagram:** Decision flow for classifying changes. Additive changes are safe; removals, renames, type changes, and stricter validation are breaking.

### Non-Breaking (same major version)

| Change | Example |
|--------|---------|
| Add optional request field | Add `metadata` to `POST /v1/documents` |
| Add response field | Add `processing_time_ms` to response |
| Add new endpoint | Add `GET /v1/documents/:id/preview` |
| Loosen validation | Allow 50-char filenames instead of 30 |
| Improve performance | Faster response, no contract change |

### Breaking (new major version required)

| Change | Example |
|--------|---------|
| Remove field | Remove `legacy_id` from response |
| Rename field | `file_name` â†’ `filename` |
| Change field type | `size: string` â†’ `size: number` |
| Change semantics | `status: "active"` now means something different |
| Tighten validation | Require `email` where it was optional |
| Remove endpoint | Delete `POST /v1/documents/bulk` |
| Change default behavior | Default pagination changes from 50 to 100 |

## Version Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Current: released (e.g., /v2/)
    Current --> Deprecated: new major version released (e.g., /v3/)
    Deprecated --> Sunset: 6 months after deprecation
    Sunset --> Retired: 12 months after deprecation
    Retired --> [*]: endpoint returns 410 Gone
```text

> **Diagram:** Version lifecycle. A version is Current until the next major version releases. Then it enters a 12-month deprecation window: 6 months deprecated (full support + warnings), then sunset (read-only, no bug fixes), then retired (410 Gone).

| State | Duration | Behavior | Headers |
|-------|----------|----------|---------|
| **Current** | Until next major | Full support, bug fixes, features | None |
| **Deprecated** | 6 months | Full support; new features go to current version | `Deprecation: true`, `Sunset: <date>` |
| **Sunset** | 6 months | Security fixes only; no new features or bug fixes | `Sunset: <date>` |
| **Retired** | Permanent | Returns 410 Gone with migration link | `410 Gone` |

## Deprecation Headers

Deprecated endpoints return these headers on every response:

```text
Deprecation: true
Sunset: Sat, 16 Jul 2027 00:00:00 GMT
Link: <https://docs.vaeloom.dev/migration/v1-to-v2>; rel="deprecation"
```text

## Migration Process

```text
When releasing a new major version (e.g., v2):
  1. Publish migration guide at docs.vaeloom.dev/migration/v1-to-v2
  2. Announce deprecation to all API consumers (email, dashboard banner)
  3. Add Deprecation + Sunset headers to v1 responses
  4. Track v1 usage; alert when usage drops below threshold
  5. At 6 months: sunset v1 (security fixes only)
  6. At 12 months: retire v1 (return 410 Gone)
  7. Notify any remaining v1 consumers individually before retirement
```text

## Internal RPC Versioning

Internal RPC (between apps/api and apps/ai-service) uses protobuf package versioning:

```protobuf
// Current
package vaeloom.internal.v1;

// Next version (additive)
package vaeloom.internal.v2;
```text

| Rule | Detail |
|------|--------|
| Both versions available simultaneously | v1 and v2 handlers coexist for 90 days |
| Additive changes preferred | New fields with defaults; new methods |
| Breaking changes require dual-support | Consumer migrates within 90 days |

## SDK Versioning

SDKs (TypeScript, Python) follow semver:

| Version bump | When | Example |
|--------------|------|---------|
| MAJOR | Breaking API change | 1.x.x â†’ 2.0.0 |
| MINOR | New feature, backward-compatible | 1.1.x â†’ 1.2.0 |
| PATCH | Bug fix, backward-compatible | 1.1.0 â†’ 1.1.1 |

SDK major versions align with API major versions: `@vaeloom/sdk@2.x` targets `/v2/` API.

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | Prefer additive changes over breaking changes | Additive changes don't require consumer migration |
| 2 | Announce deprecation early (6+ months) | Gives enterprise consumers time to migrate |
| 3 | Track usage per version | Know when it's safe to retire a version |
| 4 | Provide automated migration tooling where possible | Reduces consumer effort; speeds adoption |

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Breaking change without new version | Silent breakage for all consumers | Always bump major version for breaking changes |
| Retiring a version with active users | Production outages for consumers | Track usage; notify active users before retirement |
| No migration guide | Consumers struggle to upgrade | Publish migration guide with every major release |

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Automated migration codemods for SDK | Medium | High | Q2 2027 |
| Version usage analytics dashboard | Medium | Low | Q4 2026 |
| GraphQL alongside REST (no versioning needed) | Low | High | Q3 2027 |

## Related Documents

- [`API-Architecture.md`](./API-Architecture.md) â€” API architecture
- [`API-Reference.md`](./API-Reference.md) â€” endpoint reference
- [`REST-Standards.md`](./REST-Standards.md) â€” REST conventions
- [`../Engineering/Versioning.md`](../Engineering/Versioning.md) â€” general versioning policy
- [`Service-Contracts.md`](./Service-Contracts.md) â€” internal RPC versioning
- [`../Enterprise/Feature-Flags.md`](../Enterprise/Feature-Flags.md) â€” feature flag strategy
