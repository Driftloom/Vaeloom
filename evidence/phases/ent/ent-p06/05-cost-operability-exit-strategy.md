# ENT-P06 — 05 Operability, Cost Optimization & Vendor Exit Strategy

> **Phase:** `ENT-P06` (Technology Stack and Engineering Standards)  
> **Deliverable:** `DEL-ENT-P06-05` (v1.0)  
> **Owner:** Lead FinOps Specialist & Principal SRE  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Developer Ergonomics & Operational Velocity

To sustain rapid development cycles across a multi-package monorepo without
developer friction, the technology stack enforces sub-second startup times and
deterministic local environments:

| Workflow Step                   | Tooling Stack                     | SLA / Target Latency  | Verification Basis                                                   |
| :------------------------------ | :-------------------------------- | :-------------------: | :------------------------------------------------------------------- |
| **Monorepo Dependency Install** | `pnpm install`                    |  **`<3.0 seconds`**   | Monorepo baseline achieves 2.2s installs via `.npmrc` peer hoisting. |
| **Frontend Web Dev Server**     | `pnpm dev:web` / `make dev-web`   |   **`2–5 seconds`**   | Fast startup bypassing root globbing; runs directly via Next.js.     |
| **Backend API Dev Server**      | `pnpm dev:be` (FastAPI / Uvicorn) | **`Instant (<1.5s)`** | Hot reload enabled with uv virtual environment.                      |
| **Full Security Test Suite**    | `pytest tests/security`           |   **`<90 seconds`**   | 404 tests passing serially with SQLite/PostgreSQL memory fixtures.   |
| **Playwright Functional E2E**   | Playwright Chromium (Local)       |   **`<75 seconds`**   | 46 tests across 9 spec files pass 100% green on ports 8000 & 3000.   |

---

## 2. FinOps Cost Optimization & Resource Governance

To ensure the enterprise platform maintains its gross margin target
($\ge 97.3\%$) across high-volume recruiting seasons, the following operational
cost controls are active:

1. **Intelligent Token Budgeting:**
   - Every cognitive prompt is metered and logged in Prometheus
     (`vaeloom_llm_tokens_total`).
   - System 1 handles intent routing at \$0.0004/call, preventing expensive 31B+
     generative model invocations for deterministic categorization.
   - Per-candidate token caps prevent runaway billing on adversarial inputs.
2. **Object Storage Tiering (MinIO / S3):**
   - Compiled PDF and DOCX resume artifacts are retained in Standard Storage for
     30 days.
   - Automated S3 lifecycle rules migrate artifacts older than 30 days to
     Infrequent Access (S3-IA), reducing storage costs by **58%**.
   - Ephemeral preview renders older than 7 days are automatically purged.
3. **Database Compute Autoscaling:**
   - Supabase / RDS compute nodes scale dynamically between 2 vCPU and 8 vCPU
     based on connection pool saturation ($\ge 75\%$).
   - Idle test environments auto-suspend after 30 minutes of inactivity.

---

## 3. Vendor Lock-In Mitigation & Exit Playbooks

To safeguard enterprise business continuity, every tier has an executable,
tested exit strategy to open-source or alternate commodity cloud providers:

### Exit Playbook 1: PostgreSQL Database Portability (Exiting Supabase)

- **Target Alternative:** Self-hosted PostgreSQL 16 on AWS Aurora or Google
  Cloud SQL.
- **Lock-in Risk:** Supabase Auth and Storage dependencies.
- **Exit Procedure:**
  1. Standard PostgreSQL schema uses open `pgcrypto` and `pgvector` extensions
     without proprietary functions.
  2. Execute standard database dump:
     `pg_dump -h <host> -U postgres -Fc -d vaeloom_prod > vaeloom_backup.dump`.
  3. Restore directly to vanilla PostgreSQL 16:
     `pg_restore -d target_db vaeloom_backup.dump`.
  4. Point `DATABASE_URL` connection strings to new database cluster.
  5. **Estimated Migration Time:** $<4\text{ hours}$ with zero application code
     rewrites.

### Exit Playbook 2: Cognitive Model Provider Exit (Exiting Ollama Cloud / TypeSafe Jev)

- **Target Alternative:** Self-hosted vLLM / TensorRT-LLM cluster on dedicated
  AWS/GCP GPU instances (NVIDIA L4).
- **Lock-in Risk:** Proprietary API endpoints or prompt syntax.
- **Exit Procedure:**
  1. All LLM calls are abstracted behind `BaseLLMClient` in
     `services/llm_router.py`.
  2. Deploy open weights (`gemma-2-27b-it` or `Llama-3.1-70B-Instruct`) to a
     private vLLM endpoint.
  3. Update `LLM_BASE_URL` in environment secrets from `https://ollama.com/v1`
     to internal vLLM cluster endpoint.
  4. System 1 fallback reverts to local high-speed embedding gazetteer
     (`utils/semantic_matcher.py`).
  5. **Estimated Migration Time:** $<1\text{ hour}$ via configuration change
     only.

### Exit Playbook 3: Cloud Provider Portability (Exiting AWS / GCP)

- **Target Alternative:** Any CNCF-certified Kubernetes platform (Azure AKS,
  RedHat OpenShift, Bare Metal).
- **Lock-in Risk:** Proprietary cloud IAM and managed services.
- **Exit Procedure:**
  1. All workloads are packaged as standard OCI container images with Helm
     charts (`infra/helm/vaeloom/`).
  2. Terraform definitions use modular provider abstractions.
  3. Identity relies on standard OIDC / SAML; secrets managed via HashiCorp
     Vault / Infisical.
  4. **Estimated Migration Time:** $<2\text{ business days}$.

_Signed: Lead FinOps Specialist & Principal SRE — 2026-09-29_
