# Docker

> **Purpose:** Define Docker configuration standards for Vaeloom
> **Status:** ðŸ†• New

## Build Architecture

```mermaid
graph TD
    classDef web fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:1.5px
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef ai fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px
    classDef infra fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:1.5px
    classDef best fill:#ffebee,stroke:#c62828,color:#000,stroke-width:1px

    subgraph AppWeb["ðŸŒ apps/web (Next.js) -- Multi-stage Build"]
        direction TB
        W1["Stage: base<br/>node:20-alpine<br/>npm ci --production"]
        W2["Stage: build<br/>npm run build"]
        W3["Stage: production<br/>Copy .next + node_modules<br/>EXPOSE 3000<br/>CMD: npm start"]
    end

    subgraph AIService["ðŸ§  apps/ai-service (FastAPI) -- Multi-stage Build"]
        direction TB
        A1["Stage: base<br/>python:3.11-slim<br/>pip install -r requirements.txt"]
        A2["Stage: production<br/>Copy app code<br/>EXPOSE 8000<br/>CMD: uvicorn main:app"]
    end

    subgraph Compose["ðŸ³ Docker Compose -- Local Development"]
        direction TB
        C1["postgres:16<br/>Port 5432<br/>Volume: pgdata"]
        C2["redis:7-alpine<br/>Port 6379<br/>AOF enabled"]
        C3["api<br/>Port 4000<br/>Depends: postgres, redis"]
        C4["ai-service<br/>Port 8000<br/>Depends: postgres, redis"]
        C5["web<br/>Port 3000<br/>Depends: api"]
    end

    subgraph Practices["âœ… Best Practices"]
        P1["Alpine-based images<br/>Smaller size, fewer vulns"]
        P2["Multi-stage builds<br/>Separate deps from runtime"]
        P3["Pin versions<br/>Reproducible builds"]
        P4["Non-root user<br/>Security best practice"]
        P5["Layer caching<br/>Faster CI builds"]
    end

    W1 --> W2 --> W3
    A1 --> A2
    C3 --> C1 & C2
    C4 --> C1 & C2
    C5 --> C3

    class W1,W2,W3 web
    class A1,A2 ai
    class C1,C2,C3,C4,C5 infra
    class P1,P2,P3,P4,P5 best

```

> **Diagram:** Docker build architecture showing multi-stage builds for web (3 stages: base → build → production) and AI service (2 stages: base → production). **Docker Compose** orchestrates 5 services for local development with dependency chains. **Best Practices** guide image optimization, security, and build performance.

---

## Dockerfile Standards

### apps/web (Next.js)

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM base AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

### apps/ai-service (FastAPI)

```dockerfile
FROM python:3.11-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Docker Compose (Local Dev)

```yaml
services:
  postgres:
    image: postgis/postgis:16
    environment:
      POSTGRES_DB: Vaeloom
      POSTGRES_USER: Vaeloom
      POSTGRES_PASSWORD: Vaeloom
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes

  api:
    build: ./apps/api
    ports: ["4000:4000"]
    environment:
      DATABASE_URL: postgresql://Vaeloom:Vaeloom@postgres:5432/Vaeloom_db
      REDIS_URL: redis://redis:6379
    depends_on: [postgres, redis]

  ai-service:
    build: ./apps/ai-service
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://Vaeloom:Vaeloom@postgres:5432/Vaeloom_db
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [postgres, redis]

  web:
    build: ./apps/web
    ports: ["3000:3000"]
    depends_on: [api]

volumes:
  pgdata:
```

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Using `latest` tag for base images | `FROM node:latest` or `FROM python:latest` means builds are non-deterministic — a base image update can introduce breaking changes. Pin to specific versions (`node:20-alpine`, `python:3.11-slim`) with automated update PRs via Dependabot |
| Installing dev dependencies in production images | `npm install` instead of `npm ci --only=production` includes testing libraries and build tools that increase image size and attack surface — always use production-only dependency installation in final stages |
| Running containers as root | A container running as root can be exploited to gain host access — always create and switch to a non-root user in the Dockerfile, and drop all unnecessary Linux capabilities |

## Best Practices

| Practice | Why |
|----------|-----|
| Pin base image versions and use Dependabot for automated updates | Non-deterministic builds break in production when a base image changes — pinning versions ensures reproducible builds. Use Dependabot or Renovate to automatically open PRs for updated base images |
| Use multi-stage builds to keep production images small | Build dependencies (TypeScript compiler, npm dev packages, Python build tools) are not needed at runtime — multi-stage builds copy only the production artifacts to the final image, reducing size by 60-80% |
| Run containers as a non-root user with minimal capabilities | A root container that's compromised gives the attacker full host access — always add a non-root user and drop all capabilities except those explicitly required by the application |

## Security

| Concern | Mitigation |
|---------|------------|
| Base images with known vulnerabilities | `node:20-alpine` may ship with vulnerabilities in its packages — regularly scan images with vulnerability scanning tools, and rebuild images when base images are patched |
| Build cache exposing secrets in image layers | Secrets used during `RUN` commands (API keys, npm tokens) persist in image layers even if deleted — use Docker BuildKit's `--secret` flag or `ARG` with multi-stage builds to exclude secrets from final images |
| Unbounded layers creating large attack surface | Each `RUN` instruction creates a new layer — combine related commands into single `RUN` statements and remove package manager caches to minimize image layers |

## Performance

| Concern | Mitigation |
|---------|------------|
| Large image sizes slowing deployment | A 1GB Docker image takes 30-60s to download on cold start, delaying autoscaling — optimize with multi-stage builds (App: ~300MB, AI: ~500MB), Alpine base images, and removing package manager caches |
| Docker layer caching inefficiency in CI | If package files change on every commit, the `npm install` layer is always invalidated and must reinstall — separate `package.json` copy from source code copy to maximize layer caching |
| Development Compose services consuming host resources | Docker Compose with 5+ services (postgres, redis, api, ai-service, web) consumes 4GB+ RAM on developer machines — allow developers to run only the services they need and use cloud-hosted dependencies where practical |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Base images with known vulnerabilities | `node:20-alpine` may ship with vulnerabilities in its packages — regularly scan images with vulnerability scanning tools, and rebuild images when base images are patched |
| Build cache exposing secrets in image layers | Secrets used during `RUN` commands (API keys, npm tokens) persist in image layers even if deleted — use Docker BuildKit's `--secret` flag or `ARG` with multi-stage builds to exclude secrets from final images |
| Unbounded layers creating large attack surface | Each `RUN` instruction creates a new layer — combine related commands into single `RUN` statements and remove package manager caches to minimize image layers |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Large image sizes slowing deployment | A 1GB Docker image takes 30-60s to download on cold start, delaying autoscaling — optimize with multi-stage builds (App: ~300MB, AI: ~500MB), Alpine base images, and removing package manager caches |
| Docker layer caching inefficiency in CI | If package files change on every commit, the `npm install` layer is always invalidated and must reinstall — separate `package.json` copy from source code copy to maximize layer caching |
| Development Compose services consuming host resources | Docker Compose with 5+ services (postgres, redis, api, ai-service, web) consumes 4GB+ RAM on developer machines — allow developers to run only the services they need and use cloud-hosted dependencies where practical |

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|----------------|
| Web Container | Serve Next.js frontend | node:20-alpine multi-stage | Horizontal scaling (add instances) |
| API Container | Serve NestJS backend | node:20-alpine multi-stage | Horizontal scaling (HPA) |
| AI Service Container | Serve FastAPI agent runtime | python:3.11-slim multi-stage | Horizontal scaling (GPU-aware) |
| Docker Compose | Local development orchestration | docker-compose.yml | One stack per developer |

---

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| Image builds per day | 20 | 200: parallelized monorepo builds | 2000: distributed build cache |
| Image size | Web: 300MB, AI: 500MB | Web: 100MB, AI: 200MB: optimize layers | Web: 50MB, AI: 100MB: distroless |
| Build time | 5 min per image | 2 min: layer caching + parallel builds | 30s: cached build artifacts |
| Concurrent developers (Compose) | 5 | 50: shared service dependencies | 500: ephemeral dev environments |

---

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Docker build fails | CI build failure | Check build logs, fix Dockerfile | Rebuild with fixed layers |
| Image pull fails on deploy | Container crash loop | Rollback to previous image | Check registry permissions and image existence |
| Layer cache invalidated unexpectedly | Longer build times | Check file order in COPY commands | Separate dependency install from source copy |
| Container runs out of memory | OOM kill by kernel | Increase memory limits | Monitor usage, set appropriate limits |

---

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Image build success rate | < 95% | Critical | CI/CD Pipeline |
| Image pull time (cold start) | > 60 seconds | Warning | Deployment Performance |
| Container OOM kill rate | > 0 per week | Critical | Container Health |
| Image size growth per month | > 10% | Info | Docker Registry |

---

## Deployment

| Environment | Method | Trigger | Verification |
|-------------|--------|---------|--------------|
| Development | `docker compose up` | Developer starts work | Services respond on expected ports |
| Staging | CI build + push to registry | Merge to main | Smoke tests pass on staging |
| Production | CI build + push → deploy | Release tag or approval | Health check + error rate monitoring |
| Rollback | Deploy previous image tag | Post-deploy issue | Rollback confirmed in health checks |

---

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `NODE_VERSION` | Node.js base image version | `20-alpine` | No |
| `PYTHON_VERSION` | Python base image version | `3.11-slim` | No |
| `APP_PORT` | Application container port | `3000` (web), `4000` (api), `8000` (ai) | No |
| `DOCKER_BUILDKIT` | Enable BuildKit for faster builds | `1` | No |
| `COMPOSE_PROFILES` | Docker Compose service profile | — | No |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| Alpine-based images may have compatibility issues | Some npm packages require glibc | Test all dependencies on Alpine before prod | Use distroless or slim images with glibc |
| Multi-stage builds add complexity | More Dockerfile lines to maintain | Reusable base stage pattern | Buildpack-based image generation |
| Docker Compose doesn't scale to production | Local-only orchestration | Manual deploy per service | Kubernetes for production orchestration |
| No container vulnerability scanning in MVP | Vulnerable base images may be deployed | Manual dependency checks | Automated scanning in CI pipeline |

---

## Overview

Vaeloom uses Docker for application packaging and deployment across all environments. Each service — web (Next.js), API (NestJS), and AI service (FastAPI) — has a dedicated multi-stage Dockerfile that optimizes for small image size, fast builds, and minimal attack surface. Docker Compose orchestrates local development environments.

This document covers the Dockerfile standards, multi-stage build architecture, Docker Compose configuration for local development, security practices, and performance optimizations. The primary audience is developers and DevOps engineers building and deploying Vaeloom services.

Within the Vaeloom platform, Docker images are the unit of deployment — they are built in CI, signed with Cosign, pushed to a container registry, and deployed to staging and production environments. Consistent Docker standards ensure reproducible builds, fast deployment cycles, and a secure runtime environment.

Proper containerization is critical for Vaeloom's deployment velocity and security posture. Multi-stage builds keep production images under 500MB, Alpine-based base images reduce the vulnerability surface, and non-root user enforcement prevents container escape attacks.

---

## Goals

- Produce minimal production images (<300MB web, <500MB AI service) using multi-stage builds
- Ensure reproducible builds by pinning base image versions (node:20-alpine, python:3.11-slim)
- Enable zero-dependency local development via Docker Compose with all supporting services
- Enforce security best practices: non-root user, dropped capabilities, no secrets in image layers
- Achieve sub-5-minute CI build times through layer caching and dependency ordering

---

## Scope

### In Scope

- Multi-stage Dockerfiles for all Vaeloom services (web, API, AI service)
- Docker Compose configuration for local development with PostgreSQL, Redis, and all services
- Image tagging conventions (SHA-based immutable tags for deploy, `:latest` as alias)
- Docker layer caching strategy for CI pipeline optimization
- Dockerfile security best practices (non-root user, multi-stage, version pinning, secrets hygiene)

### Out of Scope

- Container orchestration and scheduling (covered in [Kubernetes.md](./Kubernetes.md))
- Container image signing and verification (covered in [Container-Signing.md](./Container-Signing.md))
- Container vulnerability scanning (covered in [SBOM-Policy.md](./SBOM-Policy.md))
- Container registry management (covered in [Deployment.md](./Deployment.md))
- Production Docker Compose usage (development only — production uses K8s or PaaS)

---

## Examples

### Example 1: Optimized Dockerfile with Layer Caching

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
# Dependencies layer — only invalidates when package.json changes
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json ./
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### Example 2: Running Selective Services with Docker Compose Profiles

```bash
# Run only API and its dependencies (exclude web and AI service)
docker compose --profile minimal up api

# Run full stack
docker compose --profile full up

# docker-compose.yml profiles
services:
  api:
    profiles: ["minimal", "full"]
  ai-service:
    profiles: ["full"]
  web:
    profiles: ["full"]
```

---

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant DEV as Developer
    participant CI as CI Pipeline
    participant DK as Docker BuildKit
    participant CR as Container Registry
    participant K8S as Kubernetes

    DEV->>CI: Push code
    CI->>DK: docker build (multi-stage)
    DK->>DK: Stage 1: base (install deps)
    DK->>DK: Stage 2: build (compile app)
    DK->>DK: Stage 3: production (copy artifacts)
    DK-->>CI: Production image

    CI->>CR: docker push (SHA tag + latest)
    CR-->>CI: Image stored

    CI->>K8S: Deploy using image:tag
    K8S->>CR: Pull image
    K8S->>K8S: Run container (non-root user)
```

> **Diagram:** Docker build lifecycle — multi-stage build in CI (base, build, production), push to registry with SHA tag, then pull and run in Kubernetes with security hardening.

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Distroless base images for smaller attack surface | High | Medium | Q1 2027 |
| Automated container vulnerability scanning in CI | High | Low | Q4 2026 |
| Buildpack-based image generation | Medium | Medium | Q2 2027 |
| Ephemeral developer environments (Dev Containers) | Medium | Medium | Q4 2026 |
| Multi-architecture image builds (arm64) | Low | Medium | Q2 2027 |

## Related Documents

- [Deployment.md](./Deployment.md)
- [`DevOps/CI-CD.md`](./CI-CD.md)
- [`DevOps/Kubernetes.md`](./Kubernetes.md)
