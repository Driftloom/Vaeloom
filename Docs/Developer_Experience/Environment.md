# Environment Configuration

> **Purpose:** Define environment configuration standards for Vaeloom
> **Status:** ðŸ†• New

## Environment Architecture

```mermaid
graph TD
    classDef env fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef vars fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef config fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px

    subgraph Types["ðŸ—‚ï¸ Environment Types"]
        T1["Development<br/>Local development<br/>Source: .env (gitignored)"]
        T2["Staging<br/>Integration testing<br/>Source: PaaS secrets / CI"]
        T3["Production<br/>Live user traffic<br/>Source: Secrets manager"]
    end

    subgraph Variables["ðŸ”‘ Key Environment Variables"]
        V1["NODE_ENV / ENVIRONMENT / LOG_LEVEL"]
        V2["DATABASE_URL / REDIS_URL"]
        V3["AUTH_PROVIDER_URL / AUTH_SECRET"]
        V4["ANTHROPIC_API_KEY / ANTHROPIC_MODEL"]
        V5["S3_ENDPOINT / S3_BUCKET / KEYS"]
        V6["GMAIL_* / GITHUB_* CLIENT_* secrets"]
    end

    subgraph Config["âš™ï¸ Environment-Specific Config"]
        C1["Development: debug logging, 2x rate limit"]
        C2["Staging: info logging, 1.5x rate limit"]
        C3["Production: info logging, 1x rate limit"]
    end

    Types --> Variables --> Config

    class T1,T2,T3 env
    class V1,V2,V3,V4,V5,V6 vars
    class C1,C2,C3 config
```

> **Diagram:** Environment architecture â€” **3 environment types** (dev/staging/prod) with configuration sources â†’ **key variables** (core, database, auth, AI, storage, connectors) â†’ **environment-specific config** (log level, rate limits vary by environment).

---

## Environment Types

| Environment | Purpose | Configuration Source |
|-------------|---------|---------------------|
| Development | Local development | `.env` file (gitignored) |
| Staging | Integration testing | PaaS secrets / CI variables |
| Production | Live user traffic | Secrets manager |

## Environment Variables

```bash
# Core
NODE_ENV=development
ENVIRONMENT=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://Vaeloom:Vaeloom@localhost:5432/Vaeloom_db

# Redis
REDIS_URL=redis://localhost:6379

# Auth
AUTH_PROVIDER_URL=https://auth.Vaeloom.dev
AUTH_SECRET=dev-secret-only

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=Vaeloom-dev
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Connectors
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## .env.example Template

```bash
# Copy this to .env and fill in your values
# cp .env.example .env

# --- Required ---
DATABASE_URL=
REDIS_URL=

# Auth (use dev keys from dashboard)
AUTH_SECRET=

# AI (get from Anthropic console)
ANTHROPIC_API_KEY=

# --- Optional (with defaults) ---
LOG_LEVEL=debug
ENVIRONMENT=development
PORT=3000
```

## Environment-Specific Config

```typescript
// apps/api/src/config/index.ts
const config = {
  development: {
    databaseUrl: process.env.DATABASE_URL,
    logLevel: 'debug',
    rateLimitMultiplier: 2, // Double limits in dev
  },
  staging: {
    databaseUrl: process.env.DATABASE_URL,
    logLevel: 'info',
    rateLimitMultiplier: 1.5,
  },
  production: {
    databaseUrl: process.env.DATABASE_URL,
    logLevel: 'info',
    rateLimitMultiplier: 1,
  },
}[process.env.ENVIRONMENT || 'development'];
```

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Committing `.env` files to version control | A committed `.env` file exposes API keys, database credentials, and secrets to everyone with repository access â€” it's the most common source of credential leaks |
| Using production API keys in local development | A local development error (infinite loop, accidental delete) with a production API key can incur real costs or modify production data â€” API keys should be scoped per environment |
| Sharing `.env` files via unencrypted channels | Sending `.env` files over Slack, email, or chat exposes secrets in transport logs â€” use a secrets manager or encrypted sharing instead |
| Hardcoding fallback values when environment variables are missing | A fallback like `ANTHROPIC_API_KEY` with a default fake key silently uses the fake key â€” prefer failing fast with a clear error message |

## Best Practices

| Practice | Why |
|----------|-----|
| Keep `.env` in `.gitignore` and never commit it | The `.env` file is in `.gitignore` by default â€” verify with `git status` before committing. Use `.env.example` as the template |
| Use separate API keys for development, staging, and production | Dev keys should have rate limits and no access to production data â€” API key scoping prevents cross-environment accidents |
| Use a secrets manager for sharing credentials | For team environments, use a vault or secrets manager (1Password CLI, Doppler, AWS Secrets Manager) â€” never share `.env` files directly |
| Fail fast with clear error messages for missing variables | `if (!DATABASE_URL) throw new Error('DATABASE_URL is required')` â€” catching missing config early prevents confusing connection errors at runtime |

## Security Considerations

| Consideration | Mitigation |
|--------------|-----------|
| .env file permissions | The `.env` file should have file permissions `600` (owner read/write only) â€” prevent other processes on the same machine from reading secrets |
| Environment variable injection in CI | CI/CD pipeline variables can be printed in logs or leaked through build artifacts â€” mark sensitive variables as "masked" or "secret" in CI configuration |
| Local environment isolation | Each project should use its own `.env` file â€” shared dotfiles (`.bashrc`, `.zshrc`) with global environment variables create conflicts between projects |

## Performance Considerations

| Consideration | Approach |
|--------------|----------|
| Environment variable lookups are not free | Reading `process.env` thousands of times per request adds overhead â€” cache env vars at startup in a config object, not per-request lookups |
| Development vs production config differences | Dev config uses debug logging and higher rate limits â€” ensure the config system correctly reads `NODE_ENV` and doesn't fall through to a default that could apply the wrong settings |

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Missing required environment variable | App crashes on startup with clear error message | Add startup validation that fails fast with specific variable name | Set the missing variable in `.env` and restart |
| Wrong environment values in production | Unexpected behavior or data loss | Validate `NODE_ENV` against deployment environment | Correct variable and redeploy; audit for data impact |
| Secret rotation without updating config | Auth failures across services | Use secrets manager with auto-rotation; cache with TTL | Check all services for stale secrets; trigger rotation webhook |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `.env` file accidentally committed to git | High | Critical | `.env` in `.gitignore` enforced by CI pre-commit hook; `git secrets` scan in PR pipeline |
| Production credentials used in local development | Medium | Critical | Environment-specific API keys with scope limits; `ENVIRONMENT` must match key's allowed environment |
| Environment variable conflicts across projects | Medium | Medium | Use project-prefixed variable names (`Vaeloom_DATABASE_URL` vs bare `DATABASE_URL`) |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| .env.example must be manually updated | New variables may be missing from template | Add checklist item in PR template; automate .env.example generation from config schema | Auto-generate .env.example from validated config schema (v1.5) |
| No per-developer environment isolation | Developers working on same machine share env state | Use separate `.env.local` overrides | Dev container with isolated environment per workspace (V2) |

## Overview

The Environment Configuration document defines Vaeloom's environment variable standards across development, staging, and production. It covers the required variables for each service, environment-specific configuration differences (log levels, rate limits), security practices for secret management, and the `.env.example` template that serves as the onboarding starting point.

---

## Goals

- Standardize environment variable naming and sourcing across all services
- Define per-environment configuration patterns (log level, rate limits)
- Establish security practices for secret management and .env file handling
- Provide a complete `.env.example` template for new developer onboarding
- Prevent environment-crossing accidents through validation and clear defaults

---

## Scope

### In Scope
- Environment types (development, staging, production) and configuration sources
- Key environment variables across all services (core, database, auth, AI, storage, connectors)
- Environment-specific configuration differences
- .env.example template and conventions
- Security practices for secrets and environment isolation

### Out of Scope
- CI/CD environment configuration (covered in DevOps docs)
- Secrets manager setup and rotation procedures
- Per-developer environment customization
- Infrastructure-level environment configuration (K8s secrets, config maps)

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Auto-generate .env.example from validated config schema | High | Low | v1.5 (2027 H1) |
| Dev container with isolated environment per workspace | Medium | Medium | V2 (2027 H2) |
| Environment validation tool (`Vaeloom env check`) | Medium | Low | v1.5 (2027 H1) |

## Security Considerations

## Examples

### Environment config validation

```typescript
// apps/api/src/config/index.ts
function getConfig() {
  const env = process.env.ENVIRONMENT || 'development';
  const configs = {
    development: { logLevel: 'debug', rateLimitMultiplier: 2 },
    staging: { logLevel: 'info', rateLimitMultiplier: 1.5 },
    production: { logLevel: 'info', rateLimitMultiplier: 1 },
  };
  const config = configs[env];
  if (!config) throw new Error(`Unknown environment: ${env}`);
  return config;
}
```

### Startup env validation

```typescript
// apps/api/src/main.ts
const required = ['DATABASE_URL', 'REDIS_URL', 'AUTH_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

### .env.example template

```bash
# Copy to .env and fill values
DATABASE_URL=postgresql://Vaeloom:Vaeloom@localhost:5432/Vaeloom_db
REDIS_URL=redis://localhost:6379
AUTH_SECRET=your-dev-secret
ANTHROPIC_API_KEY=sk-ant-your-key
LOG_LEVEL=debug
```

### Environment-aware API client

```typescript
function getApiUrl(): string {
  switch (process.env.ENVIRONMENT) {
    case 'production': return 'https://api.Vaeloom.dev';
    case 'staging': return 'https://api.staging.Vaeloom.dev';
    default: return 'http://localhost:4000';
  }
}
```

---

## Related Documents

- [Setup.md](./Setup.md)
- [Developer Guide.md](./Developer-Guide.md)
- [CLI.md](./CLI.md)
- [Debugging.md](./Debugging.md)
- [Scripts.md](./Scripts.md)
- [`Security/Secrets.md`](../Security/Secrets.md)
