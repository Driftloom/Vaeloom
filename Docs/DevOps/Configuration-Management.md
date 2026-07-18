# Configuration Management

> **Purpose:** Define the configuration management strategy, tooling, and standards for all Vaeloom services across environments
> **Status:** ðŸ†• New
> **Owner:** DevOps Team
> **Last Updated:** 2026-07-13

---

## Overview

Vaeloom's configuration management system governs how application settings, secrets, feature flags, and environment variables are defined, validated, distributed, and consumed across the entire service mesh. As a multi-service platform spanning `apps/web` (Next.js), `apps/api` (Node.js/Express), `apps/ai-service` (FastAPI), `apps/memory` (vector/graph store), and supporting infrastructure (Redis, Postgres, RabbitMQ), a cohesive configuration strategy is essential to prevent drift, reduce deployment failures, and ensure security.

This document defines the four-layer config pipeline — **Source → Validation → Distribution → Injection → Runtime** — covering every environment from local development to production. It establishes a centralized configuration schema registry, environment variable conventions, ConfigMap definitions, feature flag semantics, and secret management practices.

Readers should understand Vaeloom's service architecture and deployment environments before reading. Configuration management is critical because misconfiguration is the leading cause of production incidents in distributed systems, and secrets exposure is the most common vector for security breaches.

---

## Goals

- Establish a single source of truth for all configuration across environments with clear inheritance and override rules
- Automate config validation at CI time to catch missing or malformed values before deployment
- Secure secrets through vault integration, encryption, and strict access controls — ensuring secrets never appear in logs, env dumps, or error messages
- Enable gradual feature rollouts with percentage-based targeting, A/B testing, and kill switches
- Provide auditability and observability through config change logging, drift detection, and flag usage telemetry

---

## Scope

### In Scope

- Configuration schema registry and JSON Schema validation
- Environment variable naming conventions and `.env` file standards
- Kubernetes ConfigMap and Secret definitions for staging/production
- Feature flag architecture, format, and rollout strategy
- Secret store integration (HashiCorp Vault / AWS Secrets Manager)
- Config promotion between environments and rollback procedures
- CI-time and runtime config validation with failure behavior
- Monitoring: config audit log, drift detection, flag telemetry

### Out of Scope

- Application-level business logic configuration (routing, ML model params)
- Database connection pooling configuration details (covered in [`../Architecture/Storage.md`](../Architecture/Storage.md))
- TLS certificate management and mTLS configuration (covered in [`../Security/IAM.md`](../Security/IAM.md))
- CI/CD pipeline configuration itself (covered in [`./CI-CD.md`](./CI-CD.md))
- Infrastructure provisioning and Terraform variable management (covered in [`./Terraform.md`](./Terraform.md))
- Docker build args and Compose file specifications (covered in [`./Docker.md`](./Docker.md))

---

## Architecture

```mermaid
graph LR
    classDef source fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef valid fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:2px
    classDef dist fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:2px
    classDef inject fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:2px
    classDef runtime fill:#ffebee,stroke:#c62828,color:#000,stroke-width:2px
    classDef audit fill:#e0f7fa,stroke:#00838f,color:#000,stroke-width:1px

    subgraph Source["1. Source"]
        ENV_FILES[".env Files<br/>Local / Dev"]
        CONFIG_MAP["ConfigMaps<br/>Staging / Prod"]
        SECRET_STORE["Secret Store<br/>Vault / AWS SM"]
        FEATURE_FLAGS["Feature Flag Service<br/>LaunchDarkly / Custom"]
    end

    subgraph Validation["2. Validation"]
        SCHEMA_REGISTRY["Config Schema Registry<br/>JSON Schema + TypeScript Types"]
        CI_VAL["CI Validation<br/>envsubst + schema check"]
        RUNTIME_VAL["Runtime Validation<br/>Startup guard + type check"]
    end

    subgraph Distribution["3. Distribution"]
        K8S_CONFIG["Kubernetes<br/>ConfigMaps + Secrets"]
        ENV_INJECT["Environment Injection<br/>Helm / Docker Compose"]
        SIDE_CAR["Sidecar / Init Container<br/>Vault Agent"]
    end

    subgraph Injection["4. Injection"]
        APP_ENV["Process Environment<br/>process.env / os.environ"]
        CONFIG_CLIENT["Config Client<br/>Vaeloom-config SDK"]
        FLAG_CLIENT["Flag Client<br/>LDClient / custom SDK"]
    end

    subgraph Runtime["5. Runtime"]
        SERVICE_WEB["apps/web<br/>Next.js"]
        SERVICE_API["apps/api<br/>Express"]
        SERVICE_AI["apps/ai-service<br/>FastAPI"]
        SERVICE_MEM["apps/memory<br/>Vector/Graph"]
        INFRA["Infrastructure<br/>Redis / Postgres / RabbitMQ"]
    end

    ENV_FILES --> CI_VAL
    CONFIG_MAP --> CI_VAL
    SECRET_STORE --> CI_VAL
    FEATURE_FLAGS --> CI_VAL

    CI_VAL --> SCHEMA_REGISTRY
    SCHEMA_REGISTRY --> RUNTIME_VAL

    CI_VAL --> K8S_CONFIG
    CI_VAL --> ENV_INJECT
    SECRET_STORE --> SIDE_CAR

    K8S_CONFIG --> APP_ENV
    ENV_INJECT --> APP_ENV
    SIDE_CAR --> APP_ENV

    APP_ENV --> SERVICE_WEB
    APP_ENV --> SERVICE_API
    APP_ENV --> SERVICE_AI
    APP_ENV --> SERVICE_MEM
    APP_ENV --> INFRA

    CONFIG_CLIENT --> SERVICE_WEB
    CONFIG_CLIENT --> SERVICE_API
    CONFIG_CLIENT --> SERVICE_AI

    FLAG_CLIENT --> SERVICE_WEB
    FLAG_CLIENT --> SERVICE_API
    FLAG_CLIENT --> SERVICE_AI

    SERVICE_WEB --> RUNTIME_VAL
    SERVICE_API --> RUNTIME_VAL
    SERVICE_AI --> RUNTIME_VAL
    SERVICE_MEM --> RUNTIME_VAL

    CONFIG_MAP --> FEATURE_FLAGS

    class ENV_FILES,CONFIG_MAP,SECRET_STORE,FEATURE_FLAGS source
    class SCHEMA_REGISTRY,CI_VAL,RUNTIME_VAL valid
    class K8S_CONFIG,ENV_INJECT,SIDE_CAR dist
    class APP_ENV,CONFIG_CLIENT,FLAG_CLIENT inject
    class SERVICE_WEB,SERVICE_API,SERVICE_AI,SERVICE_MEM,INFRA runtime
```text

> **Diagram:** Configuration pipeline flows from four source types through CI validation, then distribution via Kubernetes/Helm/Docker Compose, injection into process environments and config clients, and finally consumed by all Vaeloom services at runtime.

---

## Components

| Component | Responsibility | Technology | Scope |
|-----------|---------------|------------|-------|
| Config Schema Registry | Defines and version all config shapes with required fields, types, defaults | JSON Schema + `zod` (TypeScript) / `pydantic` (Python) | All services |
| Env Variable System | Standardized naming, `.env` file loading, type coercion | `dotenv` / `python-dotenv` / Helm values | All environments |
| ConfigMaps | Kubernetes-native non-sensitive config distribution | `ConfigMap` + `envFrom` | Staging, Production |
| Feature Flag Service | Dynamic flag evaluation, percentage rollouts, targeting | LaunchDarkly / custom REST + SSE | Staging, Production |
| Secret Store | Encrypted storage and rotation of sensitive values | HashiCorp Vault / AWS Secrets Manager | All non-local |
| Config Client SDK | Runtime config hydration, validation, and reload hooks | `Vaeloom-config` internal package | TypeScript, Python |

---

## Config Sources

### `.env` Files (Local / Development)

```text
.env                  # Base defaults (committed)
.env.local            # Local overrides (gitignored)
.env.dev              # Dev environment overrides
.env.test             # Test environment overrides
```text

Loading order (last wins): `.env` → `.env.<environment>` → `.env.local`

### ConfigMaps (Staging / Production)

Kubernetes ConfigMaps are the primary distribution mechanism for non-sensitive config in staging and production. Each service has a dedicated ConfigMap.

```yaml
# apps/api/config/staging.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
  namespace: Vaeloom-staging
data:
  NODE_ENV: "staging"
  LOG_LEVEL: "info"
  API_PORT: "4000"
  RATE_LIMIT_WINDOW_MS: "60000"
  RATE_LIMIT_MAX_REQUESTS: "100"
  REDIS_HOST: "redis.Vaeloom-staging.svc.cluster.local"
  REDIS_PORT: "6379"
```text

### Secret Store (All Non-Local Environments)

Sensitive values (DB credentials, API keys, JWT secrets, encryption keys) are stored in HashiCorp Vault (self-hosted) or AWS Secrets Manager (cloud) and injected via Vault Agent sidecar or direct SDK calls at pod startup.

### Feature Flag Service

Runtime-evaluated boolean or multivariate flags served by LaunchDarkly (or a lightweight custom alternative). Flags are NOT stored in ConfigMaps or `.env` files — they are managed through the flag service UI/API.

---

## Environment Hierarchy

```mermaid
graph BT
    classDef local fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef dev fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:2px
    classDef staging fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:2px
    classDef prod fill:#ffebee,stroke:#c62828,color:#000,stroke-width:2px

    LOCAL["local<br/>Developer machine<br/>Inherits: defaults only"] --> DEV
    DEV["dev<br/>Shared dev cluster<br/>Inherits: local pattern"] --> STAGING
    STAGING["staging<br/>Pre-production<br/>Inherits: dev structure"] --> PROD
    PROD["production<br/>Live environment<br/>Inherits: staging structure"]

    class LOCAL local
    class DEV dev
    class STAGING staging
    class PROD prod
```text

> **Diagram:** Config inheritance flows upward. Each environment inherits the structural shape of the one below, with values becoming progressively more restrictive and production-hardened.

### Inheritance Rules

| Rule | Description |
|------|-------------|
| **Shape inheritance** | All config keys present in `local` must exist in `dev`, `staging`, and `production` (may have different values) |
| **Override only** | Upper environments override specific values; they do not redefine the entire config |
| **Secrets isolation** | Secrets are NEVER inherited — each environment has its own vault path |
| **Feature flag sync** | Flags are created in `dev`, promoted to `staging` for validation, then enabled in `production` |
| **Drift detection** | CI compares config keys across environments weekly and alerts on discrepancies |

### Per-Environment Config Example

| Variable | Local | Dev | Staging | Production |
|----------|-------|-----|---------|------------|
| `LOG_LEVEL` | `debug` | `debug` | `info` | `warn` |
| `API_PORT` | `4000` | `4000` | `4000` | `8080` |
| `RATE_LIMIT_MAX` | `1000` | `500` | `200` | `100` |
| `REDIS_HOST` | `localhost` | `redis.dev` | `redis.staging` | `redis.prod` |
| `DB_POOL_SIZE` | `5` | `10` | `20` | `50` |

---

## Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Vaeloom Config Schema",
  "description": "Global config schema for all Vaeloom services",
  "type": "object",
  "required": [
    "NODE_ENV",
    "LOG_LEVEL",
    "API_PORT",
    "REDIS_HOST",
    "REDIS_PORT",
    "DB_URL",
    "JWT_SECRET",
    "ENCRYPTION_KEY"
  ],
  "properties": {
    "NODE_ENV": {
      "type": "string",
      "enum": ["local", "dev", "staging", "production", "test"],
      "description": "Runtime environment identifier"
    },
    "LOG_LEVEL": {
      "type": "string",
      "enum": ["debug", "info", "warn", "error"],
      "default": "info",
      "description": "Logging verbosity level"
    },
    "API_PORT": {
      "type": "integer",
      "minimum": 1024,
      "maximum": 65535,
      "default": 4000,
      "description": "HTTP server listen port"
    },
    "RATE_LIMIT_WINDOW_MS": {
      "type": "integer",
      "minimum": 1000,
      "default": 60000,
      "description": "Rate limit window in milliseconds"
    },
    "RATE_LIMIT_MAX_REQUESTS": {
      "type": "integer",
      "minimum": 1,
      "default": 100,
      "description": "Max requests per window"
    },
    "REDIS_HOST": {
      "type": "string",
      "description": "Redis server hostname"
    },
    "REDIS_PORT": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535,
      "default": 6379,
      "description": "Redis server port"
    },
    "DB_URL": {
      "type": "string",
      "description": "Postgres connection string (secret)"
    },
    "DB_POOL_SIZE": {
      "type": "integer",
      "minimum": 1,
      "maximum": 200,
      "default": 10,
      "description": "Database connection pool size"
    },
    "JWT_SECRET": {
      "type": "string",
      "minLength": 32,
      "description": "JWT signing secret (secret)"
    },
    "ENCRYPTION_KEY": {
      "type": "string",
      "minLength": 32,
      "description": "AES-256 encryption key (secret)"
    },
    "FEATURE_FLAGS": {
      "type": "object",
      "description": "Runtime feature flag overrides (emergency use only)",
      "default": {}
    }
  },
  "allOf": [
    {
      "if": { "properties": { "NODE_ENV": { "const": "production" } } },
      "then": {
        "properties": {
          "LOG_LEVEL": { "enum": ["warn", "error"] },
          "RATE_LIMIT_MAX_REQUESTS": { "minimum": 1, "maximum": 200 }
        }
      }
    }
  ]
}
```text

---

## Validation

### CI-Time Validation

| Step | Tool | What It Checks | Failure Behavior |
|------|------|---------------|------------------|
| Env variable interpolation | `envsubst` / `gomplate` | All `$VAR` references resolve | Pipeline fails with missing var report |
| Schema conformance | `ajv` / `zod` / `pydantic` | All required fields present, types correct, enum values valid | Pipeline fails with schema violation details |
| Secret reference check | Custom script | No plaintext secrets in ConfigMaps or env files | Pipeline fails with security warning |
| Cross-env key parity | Custom script | Same keys exist across all environment configs | Warning (non-blocking) |

### Runtime Validation

```typescript
// apps/packages/Vaeloom-config/src/validate.ts
import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["local", "dev", "staging", "production", "test"]),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  DB_URL: z.string().min(1),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(200).default(10),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
});

export type VaeloomConfig = z.infer<typeof ConfigSchema>;

export function validateConfig(env: Record<string, string | undefined>): VaeloomConfig {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const missing = result.error.issues
      .filter((i) => i.code === "invalid_type" && i.received === "undefined")
      .map((i) => i.path.join("."));
    throw new Error(
      `Config validation failed: ${result.error.issues.length} issue(s). ` +
      `Missing required vars: ${missing.join(", ")}`
    );
  }
  return result.data;
}
```text

```python
# apps/ai-service/app/config.py
from pydantic import BaseSettings, Field, validator

class VaeloomSettings(BaseSettings):
    node_env: str = Field("local", alias="NODE_ENV")
    log_level: str = Field("info", alias="LOG_LEVEL")
    api_port: int = Field(8000, alias="API_PORT")
    redis_host: str = Field(..., alias="REDIS_HOST", min_length=1)
    redis_port: int = Field(6379, alias="REDIS_PORT", ge=1, le=65535)
    db_url: str = Field(..., alias="DB_URL", min_length=1)
    jwt_secret: str = Field(..., alias="JWT_SECRET", min_length=32)
    encryption_key: str = Field(..., alias="ENCRYPTION_KEY", min_length=32)

    @validator("node_env")
    def validate_env(cls, v: str) -> str:
        allowed = {"local", "dev", "staging", "production", "test"}
        if v not in allowed:
            raise ValueError(f"NODE_ENV must be one of {allowed}")
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
```text

---

## Secret Management

### Integration Architecture

```mermaid
graph LR
    classDef vault fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef pod fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef audit fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1px

    subgraph Vault["ðŸ” Vault Cluster"]
        V1["Vault Server<br/>HA mode"]
        V2["Transit Engine<br/>Encryption"]
        V3["KV Engine v2<br/>Path: secret/Vaeloom/*"]
    end

    subgraph K8S["Kubernetes"]
        direction TB
        AGENT["Vault Agent<br/>Sidecar<br/>Init container"]
        POD["Application Pod<br/>Reads secrets from<br/>/vault/secrets/*"]
    end

    subgraph Audit["Audit"]
        A1["Vault Audit Logs<br/>All reads/writes logged"]
        A2["CloudTrail / SIEM<br/>AWS CloudTrail or Splunk"]
    end

    V1 --> V2
    V1 --> V3
    V3 --> AGENT
    AGENT --> POD
    V1 --> A1
    A1 --> A2

    class V1,V2,V3 vault
    class AGENT,POD pod
    class A1,A2 audit
```text

> **Diagram:** Secrets flow from Vault's KV engine through the Vault Agent sidecar into a shared volume mounted by the application pod. Every read is audited.

### Secret Path Convention

| Path Pattern | Example | Accessible By |
|-------------|---------|---------------|
| `secret/Vaeloom/{env}/shared/*` | `secret/Vaeloom/production/shared/smtp` | All services |
| `secret/Vaeloom/{env}/{service}/*` | `secret/Vaeloom/production/api/db` | Service-specific IAM role |
| `secret/Vaeloom/{env}/infra/*` | `secret/Vaeloom/production/infra/redis` | Infrastructure components |

### Rotation Policy

| Secret Type | Rotation Cadence | Method | Downtime |
|-------------|-----------------|--------|----------|
| Database passwords | 90 days | Vault dynamic secrets + rotation | Zero-downtime (pool drain + reconnect) |
| JWT signing keys | 30 days | Key rotation with grace period (dual verification for 24h) | Zero-downtime |
| API keys (external) | As needed | Manual rotation via Vault UI + notification | Schedule-based |
| Encryption keys | 180 days | Re-encrypt with new key (background job) | Zero-downtime |

### Access Audit

Every secret read and write is logged to Vault's audit backend and forwarded to the central SIEM. Quarterly access reviews are required, with automated alerts for any of the following:

- First-time access from a new IP or service account
- Bulk secret reads (>100 in 5 minutes)
- Secret reads outside of deployment windows
- Failed authentication attempts (>5 in 1 minute)

---

## Feature Flags

### Flag Format

```typescript
interface FeatureFlag {
  key: string;                    // e.g. "new-dashboard-layout"
  name: string;                   // Human-readable name
  description: string;            // What this flag controls
  type: "boolean" | "multivariate";
  variations: Record<string, any>; // { true: {...}, false: {...} } or { red: {...}, blue: {...} }
  tags: string[];                 // ["frontend", "experimental"]
  owner: string;                  // Team or engineer responsible
  created_at: string;             // ISO 8601
  archived: boolean;              // Soft delete
}
```text

### Rollout Strategy

| Phase | % Rollout | Targeting Rules | Duration | Criteria to Advance |
|-------|-----------|----------------|----------|---------------------|
| **Internal dogfood** | 5% | Team members, internal IPs | 1-2 days | No P1 errors |
| **Beta** | 25% | Opt-in users, specific user segments | 3-5 days | Error rate < baseline |
| **Gradual rollout** | 50% → 75% → 90% | Random percentage, exclude critical paths | 5-7 days | All metrics stable |
| **General availability** | 100% | All users | Ongoing | Remove flag code next sprint |

### Targeting Rules

```json
{
  "key": "new-dashboard-layout",
  "rules": [
    {
      "description": "Internal team always sees it",
      "clauses": [
        { "attribute": "email", "op": "endsWith", "values": ["@vaeloom.dev"] }
      ],
      "serve": { "variation": true }
    },
    {
      "description": "Beta users in cohort A",
      "clauses": [
        { "attribute": "beta_cohort", "op": "in", "values": ["cohort_a"] }
      ],
      "serve": { "variation": true }
    },
    {
      "description": "Percentage rollout for remainder",
      "serve": { "percentage": { "true": 50, "false": 50 } }
    }
  ]
}
```text

### Kill Switch Protocol

| Step | Action | Owner | Timeframe |
|------|--------|-------|-----------|
| 1 | Flip flag to `false` in flag service UI (target all users) | On-call engineer | Immediate |
| 2 | Verify kill through monitoring dashboards and synthetic checks | On-call engineer | Within 2 minutes |
| 3 | Post incident in `#incidents` Slack channel with flag key and reason | On-call engineer | Within 5 minutes |
| 4 | Root cause analysis and flag code removal ticket created | Feature owner | Within 24 hours |

---

## Security

| Concern | Mitigation | Verification |
|---------|------------|--------------|
| Secrets in logs | Config client redacts known secret keys before any console/log output; `LOG_LEVEL` filtering | Code review + automated log scanner in CI |
| Secrets in error messages | All error serializers strip `env`, `config`, and `secret` fields from error payloads | Integration tests verify error shape |
| Encryption at rest | Vault encrypts secrets with AES-256-GCM; ConfigMaps reference secrets never inline | Vault seal status monitoring |
| Encryption in transit | Vault uses TLS 1.3; all config client SDKs enforce HTTPS for remote flag/vault endpoints | Network policy + mTLS enforcement |
| Access control per environment | Vault policies scoped by environment + service; IAM roles for cloud secrets | Quarterly access review + automated drift alert |
| Environment variable injection | Kubernetes Secrets are mounted as volumes (not env vars) to prevent `kubectl exec` leakage | Pod security policy audit |
| Config tampering | ConfigMaps are immutable after deploy; changes require new rollout | Admission webhook validation |

---

## Error Handling

| Error Scenario | Detection | Mitigation | Recovery |
|----------------|-----------|------------|----------|
| Missing required config key | Startup validation fails with `ConfigValidationError` | Service crashes immediately with clear message listing missing keys | Fix config source and redeploy |
| Invalid config type (e.g. string instead of number) | Zod/pydantic schema check at startup | Service crashes with type mismatch details | Fix value in config source and redeploy |
| Secret not found at vault path | Vault agent fails to render secret template | Init container exits non-zero; pod stays in `Init:Error` | Fix vault path or permissions; `kubectl delete pod` triggers retry |
| Feature flag service unreachable | Flag client reports degraded connection | Fall back to flag defaults defined in code; log warning | Flag service auto-recovers; circuit breaker resets |
| Config file not found | Filesystem `ENOENT` at startup | Fall back to environment variables; log warning | Restore file or update config source |
| Environment variable parsing error | Type coercion failure (e.g. `NaN` from `parseInt`) | Log specific parse failure with var name and value | Fix malformed value; hot-reload or restart |
| Required field default mismatch | Field has no default but is listed as optional in code | Startup fails with missing required field error | Add default or provide value in config source |

**Startup Validation Failure Behavior:**

All Vaeloom services follow a **fail-fast** model for configuration: if required config is missing or invalid, the service process exits immediately with a non-zero exit code and a descriptive error message to stdout/stderr. This prevents services from running in a degraded or insecure state.

---

## Monitoring

| Metric | Source | Alert Threshold | Severity | Dashboard |
|--------|--------|-----------------|----------|-----------|
| Config change events | Audit log (Vault + K8s event watcher) | Any unapproved change outside deployment window | P1 | Security > Config Changes |
| Secret access frequency | Vault audit log | >100 reads in 5 min from single principal | P2 | Security > Secret Access |
| Config drift score | Cross-env key comparator | Drift score > 5% (keys present in one env but not another) | P3 | DevOps > Config Drift |
| Feature flag evaluation count | Flag service metrics | >10,000 evals/min per flag | P4 | DevOps > Flag Usage |
| Feature flag stale flags | Flag metadata age | Flag not evaluated for >30 days | P4 | DevOps > Stale Flags |
| Config validation failures | CI pipeline | Any validation failure in CI | P2 | CI/CD > Pipeline Health |
| Vault seal status | Vault health API | Vault sealed | P0 | Security > Vault Status |
| Runtime config error rate | Application error metrics | >1% of requests hit config error | P2 | App > Error Rates |

---

## Deployment

### Config Promotion Flow

```mermaid
graph LR
    classDef source fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef ci fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:2px
    classDef deploy fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:2px
    classDef rollback fill:#ffebee,stroke:#c62828,color:#000,stroke-width:1.5px

    PR["PR changes config<br/>in repo"] --> CI["CI validates schema<br/>+ envsubst + parity"]
    CI --> PROMOTE["Config promoted to<br/>next environment"]
    PROMOTE --> DEPLOY["Deploy with new config<br/>+ canary analysis"]
    DEPLOY --> MONITOR["Monitor for 15 min<br/>error rate + latency"]
    MONITOR -->|Pass| FULL["Full rollout"]
    MONITOR -->|Fail| ROLLBACK["Rollback config<br/>to previous version"]

    class PR,CI source
    class PROMOTE ci
    class DEPLOY,FULL deploy
    class ROLLBACK rollback
```text

> **Diagram:** Config promotion follows the same pipeline as code. Each environment gets validated config from the previous stage, with automatic rollback on failure.

### Config Promotion Table

| Step | Action | Tooling | Verification |
|------|--------|---------|--------------|
| 1 | Commit config changes to `config/{env}/` | Git | PR review + CI validation |
| 2 | Merge to main triggers config sync | GitHub Actions + Helm | Schema validation passes |
| 3 | Config applied to staging first | `kubectl apply` / Helm upgrade | Smoke tests pass |
| 4 | Config promoted to production | Manual approval in CI | Canary analysis (5 min, <0.1% error rate) |
| 5 | Full production rollout | Automated after canary passes | Health checks + synthetic monitoring |

### Rollback Procedure

```bash
# Rollback a ConfigMap to previous version
kubectl rollout undo configmap api-config -n Vaeloom-production

# Rollback a Helm release (includes config)
helm rollback Vaeloom-api 1 --namespace Vaeloom-production

# Restore vault secrets from versioned KV
vault kv rollback -version=5 secret/Vaeloom/production/api/db
```text

---

## Examples

### Full Config — `apps/api`

```yaml
# apps/api/config/production.yaml
NODE_ENV: "production"
LOG_LEVEL: "warn"
API_PORT: 8080
RATE_LIMIT_WINDOW_MS: 60000
RATE_LIMIT_MAX_REQUESTS: 100
CORS_ORIGINS: "https://app.Vaeloom.ai,https://*.Vaeloom.ai"
BODY_LIMIT: "10mb"
TRUST_PROXY: 2
HEALTH_CHECK_PATH: "/health"
SHUTDOWN_TIMEOUT_MS: 30000

# Redis
REDIS_HOST: "redis.Vaeloom-prod.svc.cluster.local"
REDIS_PORT: 6379
REDIS_TLS_ENABLED: true
REDIS_POOL_MIN: 5
REDIS_POOL_MAX: 50

# Database (values sourced from Vault at runtime)
# DB_URL: postgresql://user:pass@db.internal:5432/Vaeloom?sslmode=require
DB_POOL_SIZE: 50
DB_CONNECTION_TIMEOUT_MS: 5000
DB_IDLE_TIMEOUT_MS: 30000
DB_MAX_RETRIES: 3

# Auth
JWT_ALGORITHM: "RS256"
JWT_EXPIRY_SECONDS: 3600
JWT_ISSUER: "Vaeloom-auth.prod"

# AI Service
AI_SERVICE_URL: "http://ai-service.Vaeloom-prod.svc.cluster.local:8000"
AI_TIMEOUT_MS: 30000
AI_MAX_RETRIES: 2

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector.Vaeloom-prod.svc.cluster.local:4318"
SENTRY_DSN: "https://sentry-key@sentry.Vaeloom.ai/prod"
```text

### Full Config — `apps/ai-service`

```yaml
# apps/ai-service/config/production.yaml
NODE_ENV: "production"
LOG_LEVEL: "warn"
API_PORT: 8000
UVICORN_WORKERS: 4
MAX_CONCURRENT_REQUESTS: 50
REQUEST_TIMEOUT_SECONDS: 60

# Model
MODEL_CACHE_DIR: "/data/models"
MODEL_TIMEOUT_SECONDS: 30
MAX_TOKENS: 4096
DEFAULT_TEMPERATURE: 0.7
TOP_K: 50
TOP_P: 0.95

# Inference
INFERENCE_BATCH_SIZE: 8
INFERENCE_MAX_RETRIES: 2
FALLBACK_MODEL: "gpt-4o-mini"

# Memory (vector store)
VECTOR_STORE_URL: "http://qdrant.Vaeloom-prod.svc.cluster.local:6333"
VECTOR_DIMENSION: 1536
VECTOR_SEARCH_TOP_K: 20
VECTOR_SEARCH_SCORE_THRESHOLD: 0.75

# Graph (knowledge graph)
GRAPH_DB_URL: "bolt://neo4j.Vaeloom-prod.svc.cluster.local:7687"

# Rate limiting
RATE_LIMIT_TOKENS_PER_MINUTE: 1000
RATE_LIMIT_BURST: 50
```text

### Full Config — `apps/web`

```yaml
# apps/web/config/production.yaml
NODE_ENV: "production"
LOG_LEVEL: "warn"
NEXT_PUBLIC_API_URL: "https://api.Vaeloom.ai"
NEXT_PUBLIC_WS_URL: "wss://ws.Vaeloom.ai"
NEXT_PUBLIC_APP_URL: "https://app.Vaeloom.ai"
NEXT_PUBLIC_SENTRY_DSN: "https://sentry-key@sentry.Vaeloom.ai/prod"
NEXT_PUBLIC_POSTHOG_KEY: "phc_prod_key"
NEXT_PUBLIC_POSTHOG_HOST: "https://app.posthog.com"
NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID: "ld-prod-client-id"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_clerk_key"

# Server-side only (never exposed to client)
API_INTERNAL_URL: "http://api.Vaeloom-prod.svc.cluster.local:8080"
SESSION_SECRET: "session-secret-from-vault"
CSRF_SECRET: "csrf-secret-from-vault"
REVALIDATION_TOKEN: "reval-token-from-vault"
```text

### Feature Flag Example

```json
{
  "flagKey": "ai-agent-conversation-streaming",
  "name": "AI Agent Conversation Streaming",
  "description": "Enables real-time streaming responses from AI agents in conversation view",
  "type": "boolean",
  "tags": ["frontend", "ai-service", "experimental"],
  "owner": "ai-platform-team",
  "variations": { "true": { "stream": true }, "false": { "stream": false } },
  "default": { "variation": false },
  "rules": [
    {
      "name": "Internal users",
      "clauses": [
        { "attribute": "email", "op": "endsWith", "values": ["@vaeloom.dev"] }
      ],
      "serve": { "variation": true }
    },
    {
      "name": "Percentage rollout",
      "serve": { "percentage": { "true": 25, "false": 75 } }
    }
  ]
}
```text

### Config Client Usage

```typescript
// apps/web/lib/config.ts
import { validateConfig } from "@vaeloom/config";

export const config = validateConfig(process.env);

// Usage in service
const dbPool = config.DB_POOL_SIZE;
```text

```python
# apps/ai-service/app/main.py
from app.config import VaeloomSettings

settings = VaeloomSettings()
# Usage in service
redis_host = settings.redis_host
```text

---

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | **Principle of least privilege** — Each service gets only the secrets and config keys it needs | Limits blast radius of a compromised service |
| 2 | **Config as code** — All config changes go through PR review and CI validation | Prevents manual mistakes and provides audit trail |
| 3 | **Validate before deploying** — CI blocks deployment on schema or interpolation failures | Catches misconfiguration before it reaches production |
| 4 | **Never hardcode defaults** — Always use environment variables or a config file | Enables environment-specific overrides without code changes |
| 5 | **Prefix public variables** — Use `NEXT_PUBLIC_` convention for client-exposed vars | Prevents accidental server secret exposure in browser bundles |
| 6 | **Use descriptive flag keys** — Include feature name and area in flag key (`ai-agent-streaming` not `flag-42`) | Makes flag purpose self-documenting in monitoring and code |
| 7 | **Remove expired flags** — Delete flag code and flag definition within one sprint of full rollout | Prevents technical debt and confusing dead code paths |
| 8 | **Pin config versions** — Use Git SHA references for config in deployment manifests | Enables deterministic rollback to any known-good state |
| 9 | **Document every config key** — Maintain schema with descriptions and examples | Reduces onboarding time and prevents incorrect values |
| 10 | **Test config changes in isolation** — Deploy config changes to staging at least 24h before production | Provides buffer to detect environment-specific issues |

---

## Common Mistakes

| Mistake | Impact | Prevention |
|---------|--------|------------|
| Storing secrets in `.env` files committed to Git | Credential leak in version control history | Use `.env.example` for structure only; add `.env*` to `.gitignore` except `.env.example` |
| Missing default values for optional config | Service crashes when var is unset | Define defaults in schema; validate at startup |
| Environment drift between staging and production | Bugs that only appear in production (DB config, rate limits) | Weekly drift detection CI job; enforce key parity |
| Exposing server secrets via `NEXT_PUBLIC_` prefix | Secret leaked to browser | Code review must verify all `NEXT_PUBLIC_` vars are intentionally public |
| Overriding feature flag defaults in code and config | Confusing behavior where flag evaluates differently than expected | Single source of truth: flag service always wins, code defaults are fallback only |
| Rotating secrets without updating dependent services | Auth failures, connection drops | Use Vault dynamic secrets or coordinate rotation with a grace period |
| Config changes deployed without corresponding code change | Incompatible config values crash recently updated services | Deploy config and code together in the same release |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Config drift between environments** | Medium | High — bugs that bypass staging testing | Weekly drift detection CI job; cross-env key parity enforcement |
| **Stale feature flags accumulate** | High | Medium — dead code, confusion, technical debt | Quarterly flag cleanup review; auto-archive flags with zero evaluations for 30 days |
| **Secret rotation causes outage** | Low | Critical — all services lose DB/auth access | Dynamic secrets with TTLs; dual-key grace periods; rotation tested in staging first |
| **Config schema breaking change** | Medium | High — services fail to start after deploying | Schema validation in CI; backward-compatible changes only; deprecation notices |
| **Developer accidentally commits real secrets** | Low | Critical — credential exposed in Git history | Pre-commit hooks with `git-secrets`; `.env` in `.gitignore`; GitHub secret scanning |
| **Vault cluster becomes unavailable** | Low | Critical — new pods cannot fetch secrets | Vault HA mode with standby; cached secrets on pod startup with TTL grace period |
| **Flag service latency degrades request** | Medium | Medium — increased p99 latency for flag evaluation | Client-side flag caching with TTL; circuit breaker falls back to code defaults |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| **Manual promotion for certain configs** | Production config changes require manual approval, slowing urgent fixes | Runbook for expedited approval during incidents | GitOps-based auto-promotion with policy-as-code (planned Q4 2026) |
| **No real-time config reload** | Config changes require service restart (env vars are read at startup) | Feature flags for runtime changes; config client supports polling | Implement hot-reload via file watcher or config agent sidecar (planned Q1 2027) |
| **Vault KV engine v2 has no automatic cleanup** | Old secret versions accumulate, increasing storage | Periodic cleanup job archived version cleanup | Implement TTL-based auto-expiry on secret paths (planned Q3 2026) |
| **Config schema registry is not automatically synced** | Schema changes in one service may not propagate to shared registry | Manual PR to update shared schema | Auto-generate shared schema from `zod`/`pydantic` definitions (planned Q4 2026) |
| **No cross-service config dependency validation** | Service A config change may break Service B if they share config | Manual integration testing | Dependency graph analysis in CI (planned Q1 2027) |

---

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant DEV as Developer
    participant PR as Pull Request
    participant CI as CI Pipeline
    participant VAL as Config Validator
    participant K8S as Kubernetes
    participant APP as Application

    DEV->>PR: Commit config change
    PR->>CI: Trigger CI validation
    CI->>VAL: Validate schema (JSON Schema / zod)
    VAL-->>CI: Schema valid / invalid
    alt Schema Invalid
        CI-->>PR: âŒ Block - missing or malformed config
    else Schema Valid
        CI->>K8S: Update ConfigMap / Secret
        K8S->>K8S: Roll out new config
        K8S->>APP: Inject env vars
        APP->>APP: Runtime validation (startup guard)
        alt Runtime Invalid
            APP->>APP: Fail fast - exit with error
        else Runtime Valid
            APP-->>K8S: Healthy - serving traffic
        end
    end
```text

> **Diagram:** Config change lifecycle — PR triggers CI validation against schema, validated configs deploy to Kubernetes ConfigMaps, applications validate at startup and fail fast on mismatch.

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| **Real-time config reload** — File watcher or sidecar agent detects config changes and signals service reload without restart | High | High | Q1 2027 |
| **GitOps config management** — Config changes merged to `main` auto-sync to environments via ArgoCD/Flux | High | Medium | Q4 2026 |
| **Automatic drift remediation** — Detected drift between environments is automatically corrected to match the source of truth | Medium | High | Q2 2027 |
| **Config validation in local dev** — Pre-commit hook runs schema validation on local config changes | Medium | Low | Q3 2026 |
| **Self-healing vault agent** — Vault agent retries with exponential backoff and reports stale secret warnings | Medium | Medium | Q3 2026 |
| **A/B test analysis integration** — Feature flag evaluation data piped directly to PostHog/Amplitude for automated analysis | Medium | Medium | Q4 2026 |
| **Schema auto-generation** — Type-safe config types auto-generated from JSON Schema for all service languages | Low | Medium | Q4 2026 |
| **Config diff UI** — Web UI to compare config values across environments at a glance | Low | Medium | Q1 2027 |

---

## Related Documents

- [`./Deployment.md`](./Deployment.md) — Deployment strategy and environment promotion
- [`./Docker.md`](./Docker.md) — Docker configuration and build standards
- [`./CI-CD.md`](./CI-CD.md) — CI/CD pipeline definitions
- [`./Kubernetes.md`](./Kubernetes.md) — Kubernetes deployment and ConfigMap definitions
- [`./Terraform.md`](./Terraform.md) — Infrastructure provisioning and Terraform variable management
- [`../Security/IAM.md`](../Security/IAM.md) — Identity, access management, and Vault integration
- [`../Security/Encryption.md`](../Security/Encryption.md) — Encryption standards for data at rest and in transit
- [`../Architecture/Microservices.md`](../Architecture/Microservices.md) — Service architecture and inter-service communication
- [`../Engineering/Implementation/16-deployment-infrastructure.md`](../Engineering/Implementation/16-deployment-infrastructure.md) — Detailed deployment infrastructure design
- [`../Testing/Security-Testing.md`](../Testing/Security-Testing.md) — Security testing practices including config injection tests
