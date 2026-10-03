# Vaeloom Kubernetes & Cloud Architecture

## 1. Production Topology: High-Availability Modular Monolith

Vaeloom runs in production as a hardened, high-availability **Modular Monolith**
designed for low latency, zero-trust tenant isolation, and strict data
consistency:

- **Core API (`vaeloom-api` / `apps/api`)**: Unified FastAPI service exposing
  all REST, GraphQL, WebSocket, and SSE endpoints. Runs 3+ replicas with
  horizontal pod autoscaling (HPA), database connection pooling, and
  multi-tenant PostgreSQL Row-Level Security (RLS).
- **Frontend (`vaeloom-web` / `apps/web`)**: Next.js 15 standalone container
  with server-side rendering (SSR), SWR caching, and zero-trust auth token
  forwarding.
- **Asynchronous Task Workers (`vaeloom-queue-worker`)**: Distributed workers
  consuming from Redis with atomic dequeue (`brpoplpush`), 300s heartbeat
  leases, exponential backoff, and dead-letter queue (DLQ) handling.
- **Temporal Orchestrator (`vaeloom-temporal`)**: Durable workflow engine
  managing long-running agent execution loops, multi-step document pipelines,
  and recovery workflows.
- **Persistence Tier**: Multi-AZ PostgreSQL 16 with pgvector extension and Redis
  7 cluster.

---

## 2. Directory Layout & Architectural Target-State

```
infra/kubernetes/
├── base/
│   ├── apps/
│   │   ├── api/                   # Active: Core Backend API
│   │   ├── web/                   # Active: Next.js Frontend
│   │   ├── queue-worker/          # Active: Redis Queue Consumer
│   │   ├── temporal/              # Active: Temporal Workflow Engine
│   │   │
│   │   └── [19 Target Services]   # Target-State: Decomposed domain services
│   │       ├── ai-service/        # (Target decomposition)
│   │       ├── auth-service/      # (Target decomposition)
│   │       ├── iam-service/       # (Target decomposition)
│   │       ├── event-bus/         # (Target decomposition)
│   │       └── ...                # See Architecture Contract below
│   ├── infra/
│   │   ├── configmap.yaml         # Unified cluster environment configuration
│   │   ├── network-policies.yaml  # Zero-trust inter-pod ingress/egress boundaries
│   │   ├── pod-disruption-budgets.yaml # High-availability quorum guarantees
│   │   ├── resource-quotas.yaml   # Compute and memory guardrails
│   │   └── service-accounts.yaml  # Least-privilege IAM bindings
│   └── kustomization.yaml
└── overlays/
    ├── dev/                       # Local Kind/Minikube overrides
    ├── staging/                   # Staging cluster configuration
    └── prod/                      # Multi-zone production deployment with HPA
```

### Clarification on Target-State Services (`base/apps/*`)

The 19 individual service manifests under `base/apps/` (e.g., `ai-service`,
`billing-service`, `auth-service`, `iam-service`, etc.) represent the
**canonical target-state microservice contracts** for enterprise multi-cluster
partitioning.

In the current production build (`.github/workflows/deploy.yml` and
`docker-compose.prod.yml`), domain logic for these modules is unified within the
high-performance `apps/api` container (`vaeloom/api:latest`). This prevents
unnecessary network hops, serialization overhead, and distributed transaction
complexity while preserving clean architectural module boundaries internally.

---

## 3. Zero-Trust Security & Ingress Invariants

- **Network Policies**: All inter-pod communication is denied by default
  (`DefaultDeny`). Explicit ingress is permitted only between `web` -> `api`,
  `api` -> `postgres`/`redis`, and `queue-worker` -> `redis`/`postgres`.
- **Secret Management**: Database credentials, encryption keys, and JWT secrets
  are injected via AWS Secrets Manager / HashiCorp Vault / Infisical and mapped
  to Kubernetes Secrets (`vaeloom-db-secret`, `vaeloom-ai-secret`).
- **Health Probes**: Liveness and readiness probes query `/health` and
  `/health/ready` on port 8000, enforcing dependency readiness before routing
  traffic.
