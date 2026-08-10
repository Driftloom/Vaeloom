# MVP-P08 — 07. Compatibility & Deprecation Policy (DEL-MVP-P08-05)

> Owner: Contract-Test Engineer · BQ-P08-01 (user 2026-08-07).

## 1. Consumers

| Consumer                                        | Versioned?            | Notes        |
| ----------------------------------------------- | --------------------- | ------------ |
| Web app (`apps/web` lib/api.ts + api-client.ts) | same release train    | internal     |
| TS SDK (`@vaeloom/sdk`)                         | semver pkg            | external-ish |
| Python SDK                                      | semver pkg            | external-ish |
| MCP connector                                   | pinned MCP 2026-07-28 | external     |
| Future integrations/webhooks                    | enterprise-gated      | n/a MVP      |

## 2. Rules (BQ-P08-01)

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

- URL prefix `/api/v1` + `X-API-Version` header (api_version middleware exists).
- OpenAPI: `info.version` = app version (0.2.0 today); semantic drift detection
  via CI diff vs committed `docs/contracts/openapi.yaml` (P11).
- Breaking-change calendar reviewed at each phase gate (register §DEC).

## 4. Deprecation lifecycle

```text
deprecated (notice + header) → removal-ready (one minor later) →
removed (approved, release notes, migration guide)
```

No silent removal; no breaking change without user approval (change control).
