# MVP-P08 — 07. Compatibility & Deprecation Policy (DEL-MVP-P08-05)

> Owner: Contract-Test Engineer · Re-run 2026-08-17. BQ-P08-01 (user 2026-08-07,
> re-confirmed).

## 1. Consumers

| Consumer                                        | Versioned?            | Notes        | Status                 |
| ----------------------------------------------- | --------------------- | ------------ | ---------------------- |
| Web app (`apps/web` lib/api.ts + api-client.ts) | same release train    | internal     | IMPLEMENTED            |
| TS SDK (`@vaeloom/sdk`)                         | semver pkg            | external-ish | PARTIAL (10% coverage) |
| Python SDK                                      | semver pkg            | external-ish | PARTIAL (10% coverage) |
| MCP connector                                   | pinned MCP 2026-07-28 | external     | IMPLEMENTED            |
| Future integrations/webhooks                    | enterprise-gated      | n/a MVP      | NOT STARTED            |

## 2. Rules (BQ-P08-01 — user-confirmed)

1. **Minor changes** (additive: new fields/endpoints) — backward-compatible;
   shipped with web app in same release.
2. **Breaking changes** — require: (a) one minor-cycle deprecation notice
   (`Deprecation` header + `deprecated: true` in OpenAPI + release notes); (b)
   user approval via change control (P03 §7); (c) migration guide; (d) removal
   only after window.
3. **Contract test suite** (P11+): generated client smoke tests against live
   OpenAPI; CI job fails on undocumented breaking delta (openapi-diff).
4. **SDK parity:** TS/Python behavior parity tests; SDKs track API minor
   versions.
5. **MCP:** pinned profile; deprecation testing per EXT-01 requirements.

## 3. Versioning mechanics

| Mechanism                | Current state + delta                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| URL prefix               | `/api/v1` prefix (exists)                                                             |
| `X-API-Version` header   | `X-API-Version: 1` response header (exists, hardcoded)                                |
| `Accept` header          | NOT implemented. **Delta:** add `Accept: application/vnd.vaeloom.v1+json` negotiation |
| `Sunset` header          | NOT implemented. **Delta:** add `Sunset: <date>` for deprecated versions              |
| `Deprecation` header     | NOT implemented. **Delta:** add `Deprecation: true` on deprecated endpoints           |
| OpenAPI `info.version`   | `0.2.0` (matches `settings.service_version`)                                          |
| OpenAPI drift detection  | NOT implemented. **Delta:** CI openapi-diff check at P11                              |
| Breaking-change calendar | NOT implemented. **Delta:** review at each phase gate                                 |

## 4. Deprecation lifecycle

```text
deprecated (notice + header + deprecated:true in OpenAPI)
  → removal-ready (one minor later)
    → removed (approved, release notes, migration guide)
```

No silent removal; no breaking change without user approval (change control).

### Deprecation checklist (per endpoint)

- [ ] `Deprecation: true` header added to response
- [ ] `Sunset: <ISO-8601 date>` header added (minimum 1 minor cycle away)
- [ ] OpenAPI schema updated with `deprecated: true`
- [ ] Release notes document the deprecation
- [ ] Migration guide published
- [ ] CI openapi-diff catches undocumented removal
- [ ] User approval recorded via change control

## 5. Contract testing (design delta)

### Current state

| Test                             | Status  | Evidence                                               |
| -------------------------------- | ------- | ------------------------------------------------------ |
| OpenAPI drift check              | MISSING | `scripts/gen_openapi.py` referenced but does not exist |
| Schema validation (response)     | MISSING | No tests validate responses against OpenAPI spec       |
| Consumer-driven contracts (Pact) | MISSING | No Pact or equivalent setup                            |
| SDK smoke tests                  | MISSING | No tests in `sdk/typescript/` or `sdk/python/`         |
| Breaking change detection        | MISSING | No openapi-diff CI job                                 |

### Proposed contract test suite (P11)

| Test type                  | Tool                     | Trigger       | Failure = |
| -------------------------- | ------------------------ | ------------- | --------- |
| OpenAPI spec generation    | `scripts/gen_openapi.py` | CI build      | BLOCK     |
| OpenAPI drift detection    | openapi-diff             | PR merge      | BLOCK     |
| Response schema validation | schemathesis/spectree    | CI test suite | WARN      |
| SDK smoke tests            | vitest / pytest          | SDK build     | BLOCK     |
| Breaking change detection  | openapi-diff --breakage  | Release PR    | BLOCK     |

## 6. Version compatibility matrix

| Consumer   | v1.0 support | v1.1 support | v2.0 support | Notes                  |
| ---------- | ------------ | ------------ | ------------ | ---------------------- |
| Web app    | Yes          | Yes          | Yes          | Same release train     |
| TS SDK     | Yes          | Yes          | TBD          | Semver; 1-cycle notice |
| Python SDK | Yes          | Yes          | TBD          | Semver; 1-cycle notice |
| MCP        | Pinned       | Pinned       | Pinned       | Profile per EXT-01     |
| Webhooks   | N/A MVP      | N/A MVP      | N/A MVP      | Enterprise-gated       |
