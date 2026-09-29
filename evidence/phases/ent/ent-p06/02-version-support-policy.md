# ENT-P06 — 02 Version Pinning & Support Lifecycle Policy

> **Phase:** `ENT-P06` (Technology Stack and Engineering Standards)  
> **Deliverable:** `DEL-ENT-P06-02` (v1.0)  
> **Owner:** Lead Platform Engineer & Security Operations Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Runtime Version Pinning Baseline

To eliminate non-deterministic build failures and production environment drift,
all runtime environments, language interpreters, database engines, and
third-party frameworks are strictly pinned to verified LTS releases:

| Component / Layer        | Technology          | Exact Pinned Version | Configuration / Lockfile Source              | Verification Command                                            |
| :----------------------- | :------------------ | :------------------: | :------------------------------------------- | :-------------------------------------------------------------- |
| **Backend Runtime**      | Python (CPython)    |    **`3.12.13`**     | `apps/api/.python-version`, `pyproject.toml` | `uv run python --version`                                       |
| **Frontend Runtime**     | Node.js LTS         |    **`20.17.0`**     | `.nvmrc`, `package.json:engines`             | `node --version`                                                |
| **Package Manager (JS)** | pnpm                |     **`9.9.0`**      | `package.json:packageManager`                | `pnpm --version`                                                |
| **Python Tooling**       | uv                  |     **`0.4.15`**     | Monorepo CI workflow                         | `uv --version`                                                  |
| **Frontend Framework**   | Next.js             |     **`15.0.0`**     | `apps/web/package.json`                      | `pnpm list next`                                                |
| **UI Library**           | React               |     **`19.0.0`**     | `package.json`                               | `pnpm list react`                                               |
| **Backend API**          | FastAPI             |    **`0.115.0`**     | `apps/api/pyproject.toml`                    | `uv run pip list \| grep fastapi`                               |
| **Data Validation**      | Pydantic v2         |     **`2.8.2`**      | `apps/api/pyproject.toml`                    | `uv run pip list \| grep pydantic`                              |
| **Relational Database**  | PostgreSQL          |      **`16.4`**      | Supabase Enterprise Cluster                  | `SELECT version();`                                             |
| **Vector Extension**     | pgvector            |     **`0.7.4`**      | PostgreSQL Extension Config                  | `SELECT extversion FROM pg_extension WHERE extname = 'vector';` |
| **Task Queue & Broker**  | Redis               |     **`7.2.5`**      | Dedicated Valkey / Redis Cluster             | `redis-cli INFO server \| grep redis_version`                   |
| **Queue Worker SDK**     | BullMQ              |     **`5.12.0`**     | `apps/api/package.json`                      | `pnpm list bullmq`                                              |
| **Headless Browser**     | Playwright Chromium |     **`1.46.1`**     | `package.json`, Dockerfile                   | `uv run playwright --version`                                   |

---

## 2. Lockfile Governance & Zero-Drift Policy

1. **Floating Dependencies Prohibited:** Semantic version wildcards (`^`, `~`,
   `latest`, `*`) are strictly prohibited in production `package.json` and
   `pyproject.toml` manifests.
2. **Immutable Lockfile Enforcement:**
   - Frontend CI builds enforce `pnpm install --frozen-lockfile`.
   - Backend CI builds enforce `uv sync --locked`.
   - Any CI build detecting an uncommitted lockfile drift fails immediately with
     exit code 1.
3. **Reproducible Base Container Images:**
   - Base Docker images must use immutable multi-architecture SHA-256 digest
     pinning (e.g. `python:3.12.13-slim@sha256:7b54a8...`).
   - Mutable tags (e.g. `:latest`, `:alpine`) are strictly banned in enterprise
     deployment manifests.

---

## 3. Support Lifecycle & End-of-Life (EOL) Calendar

| Technology Layer   | Current Pinned | Upstream EOL Date | Minimum Support Window |       Next Evaluation Date       |
| :----------------- | :------------: | :---------------: | :--------------------: | :------------------------------: |
| **Python 3.12**    |    3.12.13     |   October 2028    |       24 Months        |     Q2 2027 (Evaluate 3.13)      |
| **Node.js 20 LTS** |    20.17.0     |    April 2026     |       18 Months        | Q4 2026 (Migrate to Node 22 LTS) |
| **PostgreSQL 16**  |      16.4      |   November 2028   |       36 Months        |     Q3 2027 (Evaluate PG 17)     |
| **Next.js 15**     |     15.0.0     |   October 2026    |       18 Months        |  Q2 2026 (Semver patch review)   |
| **Redis 7.2**      |     7.2.5      |   December 2026   |       18 Months        |  Q3 2026 (Evaluate Valkey 8.0)   |

---

## 4. Vulnerability SLA & Patching Cadence

Security patches and dependency updates are categorized into three operational
tracks:

1. **Critical Vulnerabilities (CVSS $\ge 9.0$ or Active Zero-Day):**
   - Remediation SLA: **$<24\text{ hours}$** from publication.
   - Hotfix emergency deployment permitted under break-glass CCB protocol.
2. **High Vulnerabilities (CVSS $7.0 - 8.9$):**
   - Remediation SLA: **$<72\text{ hours}$**.
   - Requires automated regression testing and normal CCB review.
3. **Medium / Low / Routine Upgrades:**
   - Bundled into bi-weekly sprint dependency maintenance cycles.
   - Requires full staging smoke validation and green Playwright E2E suites.

_Signed: Lead Platform Engineer & Security Operations Lead — 2026-09-29_
