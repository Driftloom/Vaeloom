# MVP-P06 — 01. Source Register

> Prompt §4 + §15. Repo manifests read live 2026-08-07 (`a7024cc`).

## 1. Internal sources

| ID | Source | Use | Status |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------- | --------- |
| INT-01..10 | gatekeeper, INT-02 (SHA-256 `2FA8966F…69640`), INT-03/05/07/08/09 | as prior phases | Available |
| REPO | `master` @ `a7024cc` | Implementation truth; manifests read for versions | Available |

## 2. External standards — verified at phase start

| ID | Standard | Snapshot | Applicability |
| --------- | ---------------------- | ---------- | ----------------------------------- |
| EXT-01 | MCP Spec | 2026-07-28 | APPLICABLE — connectors/mcp |
| EXT-02/03 | OWASP Agentic/LLM | 2026/2025 | APPLICABLE — P13 |
| EXT-05 | WCAG 2.2 | W3C Rec | APPLICABLE — P09 |
| EXT-06 | RFC 9700 OAuth | IETF | APPLICABLE — P08 |
| EXT-08 | OpenAPI 3.x | current | APPLICABLE — pin 3.1 at P08 |
| EXT-09 | OpenTelemetry | latest | APPLICABLE — repo has OTel |
| EXT-10 | SLSA v1.2 | current | DEFER — P16 |
| EXT-11 | NIST SSDF 800-218 v1.1 | current | APPLICABLE — this phase (standards) |
| EXT-12 | Gmail API | current | APPLICABLE — P07 connector |
| EXT-16 | DPDP Rules 2025 | 2025-11-13 | APPLICABLE — P13 |

## 3. Version evidence (live manifests, 2026-08-07)

| Component | Manifest | Version/constraint |
| ------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| Nx | root package.json | `20.0.0` |
| TypeScript | root package.json | `^5.5.0` |
| Node engine | root package.json | `>=20.0.0`; pnpm `9.12.0` |
| Next.js | apps/web | `^15.0.0`; React `^18.3.0` |
| FastAPI | pyproject.toml | `>=0.111.0`; uvicorn `>=0.29.0`; Python `>=3.12` (repo runs 3.14) |
| Pydantic | pyproject | `>=2.7.0`; pydantic-settings `>=2.3.0` |
| SQLAlchemy | pyproject | `>=2.0.30` async; asyncpg `>=0.29.0`; alembic `>=1.13.0`; pgvector `>=0.2.5` |
| Redis | pyproject | `redis[hiredis]>=5.0.0`; TS packages/queue uses BullMQ |
| LLM SDKs | pyproject | anthropic `>=0.34.0`, openai `>=1.30.0`, httpx `>=0.27.0`, tenacity `>=8.3.0` |
| Google | pyproject | google-api-python-client `>=2.130.0`, google-auth-oauthlib `>=1.2.0` |
| Storage | pyproject | boto3 `>=1.34.0` (MinIO/S3) |
| Observability | pyproject | OTel distro/exporter/instrumentation `>=0.45b0`; prometheus-fastapi-instrumentator `>=7.0.0` |
| Parsing | pyproject | pymupdf `>=1.24.0`, python-docx `>=1.1.0` |
| Tests | pyproject dev | pytest `>=8.0.0`, pytest-asyncio, aiosqlite |

## 4. Conflict log

| ID | Conflict | Resolution | Authority | Date |
| --------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- |
| CF-P06-01 | Prompt §3 lists NestJS/Kafka-class stack; repo = FastAPI unified + Redis queue; phase rule prohibits premature Kafka | **Repo truth + phase rule**: single FastAPI service + BullMQ-compatible worker; no Kafka; no k8s in MVP path (carried CF-P05-01) | REPO > INT-05 > prompt | 2026-08-07 |
| CF-P06-02 | Paid LLM default (anthropic/openai) vs $0 cap | BQ-P06-02 (user): **local/free providers preferred**; mock-first; paid providers stay configured but not default for trial spend | User decision | 2026-08-07 |

Evidence: `EVD-MVP-P06-001` (manifest read, this register).
