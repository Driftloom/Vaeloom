# Vaeloom — MVP End-to-End Enterprise Hardening and Completion Specification

> **Purpose:** Close the material architecture, data, API, security,
> AI-evaluation, CI/CD, accessibility, integration, deletion, and
> release-readiness gaps identified in `vaeloom-mvp-e2e.md`.
>
> **Status:** Implementation-ready design baseline; runtime execution and
> production authorization remain `NOT_EXECUTED`.
>
> **Version:** 2.0
>
> **Last updated:** 2026-08-04
>
> **Owner:** Product, Architecture, Security, AI/ML, Data, Platform, QA, and
> Operations
>
> **Supersedes:** Any contradictory or weaker statement in `vaeloom-mvp-e2e.md`,
> especially in Phases 4–8 and 12–20.
>
> **Preserves:** The source document's 22-phase delivery structure, memory-first
> product philosophy, suggest-mode-first trust model, non-fabrication policy,
> and MVP-before-enterprise sequencing.

---

## 0. Document Authority and Reading Rules

### 0.1 Why this document exists

The original MVP end-to-end execution document is a strong delivery blueprint.
It correctly distinguishes design completion from actual code, infrastructure,
testing, deployment, and runtime evidence. It also contains several areas where
a representative pattern is described as if it were a complete implementation
artifact, and a few technical assumptions that are inconsistent with the
selected stack or current platform behavior.

This document turns those findings into implementation-ready decisions and
artifacts.

It does **not** claim that Vaeloom has been built, deployed, penetration-tested,
load-tested, legally reviewed, or released. Any runtime result remains
`NOT_EXECUTED` until a repository, environment, credentials, datasets, and test
evidence exist.

### 0.2 Authority order

When statements conflict, use this order:

1. This hardening and completion specification.
2. `01-vaeloom-mvp-spec.md` as the canonical product-scope source.
3. `02-system-architecture.md`, `03-agent-workflow.md`, and
 `04-memory-knowledge-graph.md` for subsystem intent.
4. `vaeloom-complete-documentation.md` and `vaeloom-documentation-site.md` for
 wider product context.
5. `vaeloom-mvp-e2e.md` for the original 22-phase execution structure.
6. Superseded or alternative-format documents only for historical context.

### 0.3 Evidence labels

Every decision in this file uses one of these labels:

| Label | Meaning |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `SOURCE-DERIVED` | Directly supported by the Vaeloom source corpus |
| `EXTERNAL-VERIFIED` | Confirmed against current official documentation, a primary GitHub repository, or a model card |
| `NEW-DESIGN-DECISION` | Added to close a real implementation gap |
| `STAKEHOLDER-DECISION` | Cannot be finalized responsibly without business, legal, budget, or launch input |
| `NOT_EXECUTED` | Designed but not run against a repository or environment |

### 0.4 Required merge behavior

This document may be used in either of two ways:

- **Preferred:** Keep it as the authoritative hardening companion to
 `vaeloom-mvp-e2e.md`.
- **Alternative:** Merge each numbered section into the corresponding original
 phase using the phase-mapping table in Section 17.

Do not copy only the code samples while ignoring the surrounding invariants,
threat assumptions, tests, and release gates.

---

## 1. Executive Completion Status

### 1.1 Final assessment

Vaeloom's MVP design is viable, but implementation must not begin from the
original file alone without the corrections in this specification.

The following items are now resolved at design level:

- Canonical eight-agent MVP roster.
- Embedding and reranking provider abstraction.
- Model and embedding versioning.
- Workspace isolation through composite constraints and row-level security.
- Authenticated service-to-service identity and authorization context.
- Approval-token and idempotency design for consequential actions.
- Async job API and webhook reliability design.
- Correct OpenAPI 3.1 conventions.
- Deletion, object-version, audit, and backup semantics.
- Full data-provenance model.
- Statistical AI evaluation gates.
- Corrected capacity model and benchmark triggers.
- Executable CI/CD structure with software-supply-chain controls.
- WCAG 2.2 AA accessibility baseline.
- Current Gmail push-watch lifecycle requirements.
- Job-platform integration compliance posture.
- Version-pinned MCP compatibility policy.
- Production release blockers and evidence requirements.

### 1.2 Truthful project status

| Dimension | Status |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Product concept | Complete enough to implement |
| MVP scope | Complete after Section 2 corrections |
| Architecture | Complete at design level |
| Data contracts | Complete at design level; migrations unexecuted |
| API contracts | Endpoint catalog and mandatory contract standards complete; generated OpenAPI artifact still requires repository materialization |
| UI/UX | Interaction requirements complete; visual files and usability evidence unexecuted |
| AI/ML | Architecture and evaluation plan complete; provider benchmark unexecuted |
| Security/privacy | Control design complete; legal review, penetration test, and DPIA unexecuted |
| CI/CD | Workflow specification complete; pipeline unexecuted |
| Infrastructure | Reference architecture complete; provider selection and provisioning unresolved |
| Release | **NOT AUTHORIZED** |

### 1.3 Release authorization rule

No phase-level phrase such as “approved” authorizes production deployment.
Production authorization requires every mandatory evidence item in Section 16 to
exist and pass.

---

## 2. Canonical MVP Scope

### 2.1 Product statement

`SOURCE-DERIVED`

Vaeloom MVP is a single-user personal intelligence platform for students and
early-career professionals. It ingests user-authorized documents, code metadata,
and communications; builds structured memory; and runs permission-scoped agents
that organize information, maintain career artifacts, surface deadlines, and
assist with opportunity discovery.

The architectural center remains memory, not chat.

### 2.2 Canonical agent roster

The MVP contains **eight total runtime agents, including the Orchestrator**.

| # | Agent | Mission | Consequential actions |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1 | Orchestrator | Route requests, assemble workflow context, enforce workflow state | None directly |
| 2 | Organization Agent | Classify, name, tag, deduplicate, version-chain, and propose file operations | Move/rename/archive only after approval unless narrowly authorized |
| 3 | Memory Agent | Extract, validate, merge, supersede, retrieve, and consolidate memory | Internal memory writes within declared policy |
| 4 | Resume Agent | Maintain the master resume and create traceable variants | User-visible document creation; never silently publishes |
| 5 | ATS Agent | Compare a resume with a supplied job description | Read-only scoring and suggestions |
| 6 | Job Search & Application Agent | Discover permitted opportunities, rank fit, prepare materials, deep-link, or use formally approved partner APIs | Submission only after role-specific approval |
| 7 | Gmail Agent | Classify permitted email, extract deadlines, and create drafts | Draft-only in MVP; never sends |
| 8 | Scheduler Agent | Normalize deadlines/events, detect conflicts, and send reminders | May create reminders; external calendar writes require approval or explicit action authorization |

### 2.3 Removed MVP-agent references

The following are **not separate MVP agents**:

- Application Agent
- Recommendation Agent
- Reflection Agent
- Analytics Agent
- Connector Agent
- GitHub Agent
- Coding Agent
- Document Agent
- Learning Agent
- Planning Agent

Their MVP behavior must be implemented as:

- A tool called by one of the eight agents.
- A deterministic service/module.
- A background workflow.
- A post-MVP capability.

### 2.4 Corrected career-intelligence boundary

The Job Search & Application Agent may:

- Rank jobs from lawful, licensed, user-supplied, or formally approved sources.
- Analyze a pasted job description.
- Generate tailored resume and cover-letter drafts.
- Prepare structured application answers.
- Deep-link the user to the original listing.
- Submit only through a formally authorized partner API and only after explicit
 approval.

It may not:

- Scrape or automate a platform in violation of its terms.
- Circumvent anti-bot controls.
- reuse a user's browser credentials outside an approved integration.
- Submit to a role the user did not specifically approve.
- invent qualifications, work history, education, or demographic data.

### 2.5 Corrected build-phase reference

Where the original execution plan says “Application Agent,” read it as “Job
Search & Application Agent.”

### 2.6 MVP and post-MVP boundary

| Capability | MVP | Post-MVP / enterprise |
| ------------------------------------------------------ | ------: | -----------------------------------------: |
| Eight-agent roster | Yes | Expanded roster later |
| Six memory types | Yes | Expanded taxonomy later |
| Single-user workspace isolation | Yes | Multi-tenant institution model later |
| Suggest-mode-first | Yes | Earned autonomy later |
| Official connectors | Limited | Marketplace and third-party plugins later |
| MCP-shaped internal tools | Yes | External MCP servers after security review |
| Full admin portal | No | Enterprise |
| Institution analytics | No | Enterprise |
| Cross-user memory sharing | No | Enterprise |
| Autonomous job submission across unsupported platforms | No | Not permitted without valid integration |

---

## 3. Corrected Requirements Baseline

### 3.1 Existing requirement amendments

The original FR-01 through FR-51 remain in force except for these amendments.

| Requirement | Required amendment |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-30 | Search only approved sources; every source must have a documented legal/technical access basis |
| FR-32 | Approval must bind role, platform, document versions, answers, expiry, and permitted action |
| FR-33 | Direct submission is permitted only through an approved integration contract; otherwise deep-link |
| FR-34 | Every manual or automated application must record source, approval, artifact versions, status provenance, and timestamps |
| FR-35 | Expand prohibition to all unauthorized automation, access-control circumvention, scraping, credential replay, or platform simulation |
| FR-37 | Gmail push notifications must use watch renewal, deduplication, history reconciliation, and periodic recovery sync |
| FR-43 | Export must include a machine-readable manifest, provenance, object inventory, and failure report |
| FR-44 | Replace “immediate deletion of all copies” with the deletion lifecycle in Section 8; the user receives an immediate processing receipt and a final completion receipt |
| FR-48 | Named-agent routing is limited to the canonical eight-agent roster |
| NFR-09 | Replace WCAG 2.1 AA with **WCAG 2.2 AA** |

### 3.2 New functional requirements

| ID | Requirement | Priority |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-52 | The system shall select embeddings through a provider-neutral interface and persist model, version, dimension, input type, normalization, and chunking metadata | Must |
| FR-53 | The system shall support re-embedding into a new version without overwriting the previous vector until validation and cutover complete | Must |
| FR-54 | Every retrieved fact shall carry source provenance sufficient to identify source object, version, location, extraction version, and confidence | Must |
| FR-55 | The system shall separate proposed actions from applied actions and require an immutable approval record for every consequential action | Must |
| FR-56 | Every action-application request shall support idempotency and reject replay with changed payload | Must |
| FR-57 | Long-running ingestion, agent, export, deletion, and connector operations shall use asynchronous jobs with status, progress, cancellation policy, and terminal result | Must |
| FR-58 | External webhook ingestion shall verify signature/authenticity where supported, deduplicate events, tolerate out-of-order delivery, and reconcile missed events | Must |
| FR-59 | Workspace identity shall be derived from verified membership and server-owned authorization state, never trusted from path/body input alone | Must |
| FR-60 | Service-to-service calls shall authenticate workload identity and carry user, workspace, actor, purpose, policy-decision, and trace context | Must |
| FR-61 | The system shall support a complete erasure workflow across relational, graph, vector, search, object versions, cache, queue, secret, and analytics stores | Must |
| FR-62 | The system shall issue a deletion receipt listing immediate actions, pending backup expiration, exceptions, and final completion status | Must |
| FR-63 | The system shall record all AI model, prompt, tool-schema, retrieval, and policy versions used for an agent result | Must |
| FR-64 | The system shall provide source-grounded explanations for memory-derived claims and never present low-confidence inferred facts as confirmed facts | Must |
| FR-65 | The system shall quarantine unsupported, malicious, malformed, or oversized documents and surface a safe failure state | Must |
| FR-66 | The system shall maintain an external-integration registry with access basis, scopes, quota, terms-review date, owner, and kill switch | Must |
| FR-67 | The system shall maintain a version-pinned MCP compatibility profile; an MCP specification upgrade requires security and interoperability regression testing | Should |
| FR-68 | The system shall support correction of a memory fact without deleting its provenance; corrections create a new state and supersession link | Must |
| FR-69 | The system shall expose export and deletion progress without revealing sensitive internal infrastructure details | Must |
| FR-70 | The system shall prevent untrusted retrieved content from modifying system policy, tool authorization, or approval requirements | Must |

### 3.3 New non-functional requirements

| ID | Category | Requirement |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-15 | Isolation | Cross-workspace access shall be prevented by database policy, composite constraints, service authorization, and tests—not convention alone |
| NFR-16 | Integrity | All consequential writes shall use optimistic concurrency or a precondition token |
| NFR-17 | Reliability | Webhooks and queue consumers shall be at-least-once safe through idempotency and deduplication |
| NFR-18 | AI traceability | Every AI output shall be reproducible to the extent possible from stored model/prompt/retrieval/tool metadata |
| NFR-19 | Supply chain | CI shall generate an SBOM, scan dependencies/images/IaC, sign release images, and preserve provenance |
| NFR-20 | Data lifecycle | Deletion status shall distinguish primary-store completion from backup-expiration completion |
| NFR-21 | Accessibility | All MVP web workflows shall meet WCAG 2.2 AA and support keyboard-only, screen-reader, reduced-motion, zoom, and non-color-only communication |
| NFR-22 | Resilience | Connector outage shall degrade only the affected capability and shall not corrupt memory or duplicate actions |
| NFR-23 | Portability | Export format shall be documented, versioned, and importable by a future Vaeloom version |
| NFR-24 | Model portability | No database schema or API shall assume a single fixed embedding dimension or provider |
| NFR-25 | Privacy | Raw content sent to external models shall be minimized, purpose-bound, logged, and governed by a provider data-processing configuration |
| NFR-26 | Audit | Security-relevant audit events shall be append-only for application roles and periodically anchored to tamper-evident storage |
| NFR-27 | Operability | Every SLO alert shall link to a tested runbook and have an owner |
| NFR-28 | Minor-user safety | Launch policy shall define minimum age, consent basis where applicable, and restricted processing for minors before public release |

### 3.4 Revised success metrics and evidence rules

| Metric | Target | Evidence rule |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Organization proposal acceptance | ≥90% for eligible proposals | Exclude cancellations, duplicates, and unavailable-source failures; report by proposal type |
| Wrong entity merge | Release threshold defined after pilot benchmark | Use a sufficiently powered, stratified labeled set; do not claim <0.5% from a sample of 300 |
| Missed urgent mail | <2% on an approved labeled evaluation set | Report confidence interval and per-class recall |
| Time to first value | P50 and P95, not only a single target | Measured from successful upload completion to first validated entity visible |
| Retrieval quality | Recall@k, nDCG@k, citation accuracy | Separate by query type and document format |
| Cross-workspace leakage | Zero | Mandatory negative tests at API, service, SQL, cache, search, export, and background-job layers |
| Deletion | 100% primary-store completion within approved SLO | Backups reported separately until expiration |
| Approval integrity | Zero action outside bound approval | Replay, payload mutation, expiry, and cross-workspace tests |
| AI cost | Budget per successful workflow | Report model, embedding, reranker, OCR, and storage costs separately |
| Accessibility | Zero critical/serious automated violations plus manual acceptance | Automated tools alone are insufficient |

---

## 4. Architecture Hardening

### 4.1 Corrected system boundary

```mermaid
flowchart LR
 U[User / Client]--> EDGE[Edge / API Gateway]
 EDGE--> API[Core API]
 API--> POLICY[Policy Decision Point]
 API--> JOBS[Job Orchestrator]
 JOBS--> AI[AI and Agent Service]
 JOBS--> WORKERS[Ingestion / Connector Workers]
 AI--> RETRIEVAL[Retrieval Service]
 AI--> TOOLS[Policy-Enforced Tool Gateway]
 RETRIEVAL--> PG[(PostgreSQL + pgvector)]
 RETRIEVAL--> GRAPH[Graph Access Layer]
 WORKERS--> OBJECTS[(Encrypted Object Storage)]
 WORKERS--> PG
 API--> PG
 API--> SECRETS[Secrets Manager]
 TOOLS--> CONNECTORS[Approved External Connectors]
 API--> AUDIT[Audit / Security Event Sink]
 AI--> AUDIT
 WORKERS--> AUDIT
```

### 4.2 Trust-boundary rules

1. Client input is untrusted, including `workspaceId`.
2. Authenticated user identity is necessary but not sufficient; membership and
 policy must be evaluated.
3. The Core API is the policy enforcement point for user-facing operations.
4. Internal services authenticate using workload identity.
5. Agent prompts are never authorization controls.
6. The AI service cannot directly execute consequential connector actions.
7. Tool calls pass through a Tool Gateway that validates policy, approval,
 idempotency, and payload constraints.
8. The database independently enforces workspace isolation.
9. Retrieved text is untrusted data, not instructions.
10. Audit events are emitted before and after consequential operations.

### 4.3 Corrected component ownership

| Component | Owns | Explicitly does not own |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Core API | User auth, workspace membership, policy enforcement, approval lifecycle, public API | LLM reasoning |
| Policy Decision Point | Policy evaluation from actor, workspace, agent, action, resource, purpose, approval | Business workflow execution |
| Job Orchestrator | Long-running job state, retries, cancellation, timeouts, dedupe | Model logic |
| AI/Agent Service | Planning, retrieval requests, content transformation, proposal generation | Direct connector credentials or unrestricted DB access |
| Retrieval Service | Hybrid retrieval, provenance, filter enforcement, reranking | Memory mutation |
| Memory Write Service | Validated memory writes, merge decisions, supersession, provenance | Connector actions |
| Tool Gateway | Tool schema validation, scopes, approval binding, rate/quota checks | User authentication issuance |
| Connector Worker | Official connector API calls | Policy decisions |
| Audit Service | Immutable event receipt and tamper-evident export | Product analytics aggregation |

### 4.4 New architecture decisions

| ADR | Decision | Rationale |
| ------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ADR-007 | Pin PostgreSQL 16 for the initial combined AGE + pgvector deployment | Apache AGE's current published support includes PostgreSQL 11–16; a pinned version avoids unsupported combinations |
| ADR-008 | Use a provider-neutral embedding interface; no fixed `VECTOR(1536)` assumption | Claude does not provide embeddings; providers and dimensions vary |
| ADR-009 | Separate proposal creation, approval, and execution | Prevents an agent or stale client from converting a suggestion into an action |
| ADR-010 | Require database RLS plus composite workspace foreign keys | A `workspace_id` column alone does not prevent cross-workspace references |
| ADR-011 | Use async jobs for ingestion, export, deletion, agent workflows, and connector sync | These operations exceed safe synchronous request lifetimes |
| ADR-012 | Use an outbox/inbox pattern for internal events and webhook deduplication | Provides at-least-once safety and recovery |
| ADR-013 | Treat retrieved documents, emails, job descriptions, and web content as untrusted prompt input | Prevents prompt injection from becoming authorization |
| ADR-014 | Distinguish primary-store erasure from backup-expiration completion | Makes deletion claims truthful and auditable |
| ADR-015 | Pin an MCP protocol profile and upgrade only through compatibility/security gates | MCP evolves; “MCP-shaped” without a version is not a stable contract |
| ADR-016 | Keep job-platform integrations disabled by default until an access basis is approved | Partner access and platform terms are external dependencies |

### 4.5 Consequential-action sequence

```mermaid
sequenceDiagram
 participant C as Client
 participant A as Core API
 participant P as Policy Engine
 participant AI as Agent Service
 participant T as Tool Gateway
 participant X as External Connector

 C->>A: Request recommendation/workflow
 A->>P: Authorize read/propose
 P-->>A: Permit
 A->>AI: Signed actor/workspace/purpose context
 AI-->>A: Proposal + immutable payload hash
 A-->>C: Proposal diff
 C->>A: Approve proposal/version
 A->>P: Authorize exact action + resource + expiry
 P-->>A: Permit + approval decision
 A->>T: Execute with approval token + idempotency key
 T->>P: Revalidate token and policy
 P-->>T: Permit
 T->>X: Approved API operation
 X-->>T: Result
 T-->>A: Result + connector receipt
 A-->>C: Final status
```

### 4.6 Internal authorization context

Every internal request must carry a signed, short-lived context:

```json
{
  "iss": "vaeloom-core-api",
  "aud": "vaeloom-ai-service",
  "sub": "user_123",
  "workspace_id": "ws_123",
  "actor_type": "user",
  "agent": "job_search_application",
  "purpose": "prepare_application",
  "allowed_actions": ["career.read", "resume.variant.create"],
  "approval_id": null,
  "policy_version": "policy-2026-08-04.1",
  "trace_id": "7c2f...",
  "exp": 1785853000
}
```

The receiving service must validate issuer, audience, expiry, signature,
workspace, and allowed action. It must not accept an equivalent JSON body
supplied by a client.

---

## 5. AI, Embeddings, Retrieval, and Evaluation Architecture

### 5.1 Provider reality

`EXTERNAL-VERIFIED`

Anthropic does not provide its own embedding model. Claude may remain the
primary reasoning model, but embeddings require a separate provider or a
self-hosted model.

Therefore, the MVP stack shall define:

- `ReasoningProvider`
- `EmbeddingProvider`
- `RerankerProvider`
- `OCRProvider`
- `SafetyClassifierProvider`

These may point to the same vendor only if that vendor supports the relevant
capability and passes the benchmark.

### 5.2 Required provider interface

```python
from typing import Literal, Protocol
from pydantic import BaseModel, Field

InputType = Literal["document", "query", "code", "multimodal"]

class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=128)
    model: str
    model_version: str
    input_type: InputType
    output_dimension: int
    normalize: bool = True

class EmbeddingResult(BaseModel):
    vectors: list[list[float]]
    model: str
    model_version: str
    dimension: int
    provider_request_id: str | None = None

class EmbeddingProvider(Protocol):
    async def embed(self, request: EmbeddingRequest) -> EmbeddingResult: ...
```

### 5.3 Benchmark candidates

Candidates are not production selections until Vaeloom's benchmark passes.

| Candidate | Type | Why evaluate | Required diligence |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Voyage 4 family | Managed embeddings | Current configurable dimensions; Anthropic documentation references Voyage as an embedding option | Data-processing terms, regional availability, cost, latency, quality |
| BGE-M3 | Self-hosted/open model | Multilingual, dense+sparse+multi-vector, long-context model card | Infrastructure cost, license review, quality on Vaeloom data |
| BGE reranker v2 M3 | Self-hosted reranker | Multilingual reranking candidate | Latency and GPU/CPU benchmark |
| A second managed provider | Managed fallback | Avoid single-provider dependency | Same benchmark and privacy review |

### 5.4 Embedding metadata contract

Each vector record must persist:

| Field | Purpose |
| ------------------------- | ------------------------------ |
| `embedding_provider` | Provider identity |
| `embedding_model` | Model identifier |
| `embedding_model_version` | Immutable or pinned version |
| `embedding_dimension` | Actual dimension |
| `input_type` | Query/document/code/multimodal |
| `normalized` | Similarity interpretation |
| `chunking_strategy` | Chunker identifier |
| `chunking_version` | Reproducibility |
| `source_content_hash` | Avoid duplicate re-embedding |
| `embedding_created_at` | Lifecycle |
| `superseded_at` | Migration/cutover |
| `quality_status` | pending/validated/failed |

### 5.5 Retrieval pipeline

```mermaid
flowchart LR
 Q[Agent query]--> CLASSIFY[Query classification]
 CLASSIFY--> FILTER[Workspace + policy filters]
 FILTER--> DENSE[Dense retrieval]
 FILTER--> KEYWORD[Keyword retrieval]
 FILTER--> GRAPH[Graph traversal]
 DENSE--> FUSE[Rank fusion]
 KEYWORD--> FUSE
 GRAPH--> FUSE
 FUSE--> RERANK[Reranker]
 RERANK--> PROV[Attach provenance]
 PROV--> BUDGET[Context budget and dedupe]
 BUDGET--> AGENT[Agent]
```

Mandatory rules:

- Workspace filters are applied before ranking.
- Source permissions are checked before results are returned.
- Results include provenance and confidence.
- Contradictory facts are retained and labeled.
- A low-confidence inferred fact cannot be phrased as confirmed.
- Retrieved content cannot change tool scope or approval policy.
- Retrieval results are not logged verbatim unless needed and permitted.

### 5.6 Prompt and model versioning

Every agent run stores:

```json
{
  "agent_name": "resume",
  "agent_version": "1.3.0",
  "system_prompt_version": "resume-system-2026-08-01",
  "policy_prompt_version": "shared-policy-2026-08-04",
  "reasoning_provider": "anthropic",
  "reasoning_model": "<pinned-model-id>",
  "embedding_model": "<pinned-embedding-id>",
  "reranker_model": "<pinned-reranker-id>",
  "tool_schema_version": "tools-1.2.0",
  "retrieval_pipeline_version": "rag-1.4.0",
  "policy_version": "policy-2026-08-04.1"
}
```

Do not use a floating alias in a production release without a controlled rollout
and rollback plan.

### 5.7 AI evaluation suites

| Suite | Primary metrics | Minimum slices |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| Entity extraction | Precision, recall, F1 | PDF, DOCX, scans, certificates, resumes, email, code metadata |
| Entity resolution | False merge, missed merge, abstention | Alias, acronym, homonym, multilingual, conflicting dates |
| Retrieval | Recall@5/10, nDCG@10, MRR | Exact fact, semantic, relationship, time-sensitive, contradictory |
| Reranking | nDCG lift and latency | Short and long contexts |
| Provenance | Citation correctness and coverage | Every memory type |
| Resume | Unsupported-claim rate, omission rate, traceability | Students with sparse and rich histories |
| ATS | Stability, explanation quality, calibration | Multiple job families; do not claim employer ATS equivalence |
| Gmail | Per-class precision/recall, urgent false-negative | Interview, deadline, action-required, spam, ordinary |
| Prompt injection | Policy bypass rate | Documents, email, job descriptions, connector output |
| Privacy | Sensitive-data leakage | Cross-workspace, logs, model prompts, exports |
| Tool use | Unauthorized-tool-call rate | All agents and autonomy states |
| Deletion | Residual-data detection | All primary stores and indexes |

### 5.8 Statistical evaluation rule

A release claim such as “wrong-merge rate below 0.5%” must include:

- Sample design.
- Number of independent examples.
- Stratification.
- Number of observed failures.
- Confidence interval.
- Labeling procedure.
- Inter-rater agreement.
- Excluded cases.

A sample of 300 with no observed failures is not sufficient to prove a rate
below 0.5% at a conventional 95% confidence level. Release thresholds must be
approved after a pilot dataset is assembled.

### 5.9 Ingestion implementation candidates

`EXTERNAL-VERIFIED`

Docling is a credible candidate because its repository supports multiple
document formats, OCR, layout, and table-oriented processing. It is not
automatically selected.

Required bake-off:

- Docling
- Unstructured
- PaddleOCR or another OCR-specific option
- A minimal native parser baseline

Benchmark dimensions:

- Text fidelity.
- Reading order.
- Table reconstruction.
- Page/section provenance.
- Scan quality.
- Processing latency.
- Memory usage.
- Failure transparency.
- License and deployment posture.

---

## 6. Hardened Data Architecture

### 6.1 Database version and extension policy

- PostgreSQL: pin version 16 for the initial combined deployment.
- pgvector: pin an exact tested release.
- Apache AGE: pin an exact tested release compatible with PostgreSQL 16.
- Build a Vaeloom-owned database image for development and CI.
- Production managed-Postgres support for both extensions must be confirmed
 before provider selection.
- Do not assume a generic pgvector image includes AGE.

### 6.2 Core isolation invariant

Every workspace-owned table must implement all of:

1. `workspace_id NOT NULL`.
2. Composite unique key `(workspace_id, id)`.
3. Composite foreign keys that include `workspace_id`.
4. Row-level security.
5. Transaction-scoped workspace context.
6. Service-level authorization.
7. Cross-workspace negative tests.

### 6.3 Hardened schema patch

The following migration supersedes the weaker original relationships and vector
assumptions. It is a reference artifact and remains `NOT_EXECUTED`.

```sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS age;

-- Application roles are examples; provision through IaC in a real environment.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaeloom_app') THEN
    CREATE ROLE vaeloom_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaeloom_audit_writer') THEN
    CREATE ROLE vaeloom_audit_writer NOLOGIN;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','suspended','deletion_pending','deleted')),
    encryption_key_ref TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    source_connector_id UUID,
    logical_path TEXT NOT NULL,
    media_type TEXT NOT NULL,
    raw_storage_key TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    UNIQUE (workspace_id, content_hash, logical_path),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    storage_key TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    parser_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_at TIMESTAMPTZ,
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    UNIQUE (workspace_id, document_id, version_number),
    FOREIGN KEY (workspace_id, document_id)
      REFERENCES documents(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_records (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    memory_type TEXT NOT NULL
      CHECK (memory_type IN ('profile','document','career','episodic','preference','working')),
    content JSONB NOT NULL,
    confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    state TEXT NOT NULL DEFAULT 'active'
      CHECK (state IN ('candidate','active','disputed','superseded','archived')),
    source_document_id UUID,
    source_document_version_id UUID,
    source_locator JSONB,
    extraction_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_by UUID,
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id, source_document_id)
      REFERENCES documents(workspace_id, id),
    FOREIGN KEY (workspace_id, source_document_version_id)
      REFERENCES document_versions(workspace_id, id),
    FOREIGN KEY (workspace_id, superseded_by)
      REFERENCES memory_records(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS entities (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    state TEXT NOT NULL DEFAULT 'active'
      CHECK (state IN ('candidate','active','disputed','merged','archived')),
    merged_into_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id, merged_into_id)
      REFERENCES entities(workspace_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_entity_name
  ON entities(workspace_id, entity_type, normalized_name)
  WHERE state = 'active';

-- Flexible vector storage avoids one fixed dimension.
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    object_type TEXT NOT NULL CHECK (object_type IN ('document_chunk','memory','entity')),
    object_id UUID NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    model_version TEXT NOT NULL,
    dimension INTEGER NOT NULL CHECK (dimension IN (256, 384, 512, 768, 1024, 1536, 2048)),
    input_type TEXT NOT NULL,
    normalized BOOLEAN NOT NULL DEFAULT true,
    chunking_strategy TEXT NOT NULL,
    chunking_version TEXT NOT NULL,
    source_content_hash TEXT NOT NULL,
    vector_data VECTOR,
    quality_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (quality_status IN ('pending','validated','failed','superseded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_at TIMESTAMPTZ,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_embeddings_lookup
  ON embeddings(workspace_id, object_type, object_id, quality_status);

CREATE TABLE IF NOT EXISTS relationships (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    from_entity_id UUID NOT NULL,
    to_entity_id UUID NOT NULL,
    relation_type TEXT NOT NULL,
    confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    source_memory_id UUID NOT NULL,
    state TEXT NOT NULL DEFAULT 'active'
      CHECK (state IN ('candidate','active','disputed','superseded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id, from_entity_id)
      REFERENCES entities(workspace_id, id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id, to_entity_id)
      REFERENCES entities(workspace_id, id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id, source_memory_id)
      REFERENCES memory_records(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS proposals (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    agent_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    payload JSONB NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','approved','rejected','expired','superseded','executed','failed')),
    version INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS approvals (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    proposal_id UUID NOT NULL,
    proposal_version INTEGER NOT NULL,
    approver_user_id UUID NOT NULL,
    approved_payload_hash TEXT NOT NULL,
    approved_action_scope JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','used','revoked','expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at TIMESTAMPTZ,
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id, proposal_id)
      REFERENCES proposals(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    workspace_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    state TEXT NOT NULL DEFAULT 'started'
      CHECK (state IN ('started','completed','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, idempotency_key),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
      CHECK (status IN ('queued','running','waiting_for_user','succeeded','failed','cancelled','partially_succeeded')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    request JSONB NOT NULL,
    result JSONB,
    error JSONB,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_inbox (
    provider TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    workspace_id UUID,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    signature_valid BOOLEAN NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received'
      CHECK (status IN ('received','processed','ignored','failed')),
    payload JSONB,
    PRIMARY KEY (provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    event_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deletion_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    requested_by UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK (status IN ('requested','primary_erasure_running','primary_erasure_complete','backup_expiry_pending','complete','failed','cancelled')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    primary_erasure_completed_at TIMESTAMPTZ,
    backup_expiry_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure JSONB,
    PRIMARY KEY (id),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS deletion_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    deletion_request_id UUID NOT NULL,
    receipt_type TEXT NOT NULL CHECK (receipt_type IN ('accepted','primary_complete','final_complete','failed')),
    manifest JSONB NOT NULL,
    manifest_hash TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (workspace_id, deletion_request_id)
      REFERENCES deletion_requests(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS security_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    decision TEXT,
    policy_version TEXT,
    trace_id TEXT NOT NULL,
    details JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS helper. The API sets this in every transaction after authorization.
CREATE OR REPLACE FUNCTION app_workspace_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.workspace_id', true), '')::uuid
$$;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_workspace_policy ON documents
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY document_versions_workspace_policy ON document_versions
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY memory_workspace_policy ON memory_records
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY entity_workspace_policy ON entities
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY embedding_workspace_policy ON embeddings
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY relationship_workspace_policy ON relationships
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY proposal_workspace_policy ON proposals
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY approval_workspace_policy ON approvals
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

CREATE POLICY job_workspace_policy ON jobs
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

REVOKE UPDATE, DELETE ON security_audit_events FROM vaeloom_app;
GRANT INSERT, SELECT ON security_audit_events TO vaeloom_audit_writer;

COMMIT;
```

### 6.4 Vector-dimension implementation note

PostgreSQL/pgvector indexing behavior and provider dimensions must be tested
before finalizing the production representation.

Acceptable patterns:

- Separate typed vector tables per approved dimension.
- Provider-specific partitions.
- A generic storage table plus dimension-specific indexed projections.
- `halfvec` after quality validation where supported and beneficial.

Do not create one HNSW index over arbitrary mixed dimensions.

### 6.5 AGE usage boundary

Apache AGE may hold graph projections, but the relational tables remain the
authoritative source for:

- Workspace ownership.
- Entity identity.
- Provenance.
- Approval and audit.
- Deletion.
- Access-control enforcement.

Every graph node and edge must contain `workspace_id`, and graph access must be
wrapped by a service that enforces the same transaction context. Cross-workspace
graph-leak tests are mandatory.

### 6.6 Backup and erasure semantics

- Primary relational/object/search/vector/graph/cache data: erased during
 primary erasure.
- Secrets: revoked and deleted during primary erasure.
- Audit: retain only what legal/security policy requires, minimize content, and
 pseudonymize where possible.
- Backups: encrypted, access-restricted, not restored except disaster recovery.
- A deleted workspace restored from backup must be re-deleted using a tombstone
 registry.
- Final deletion completion occurs after the last relevant backup expires or is
 cryptographically rendered inaccessible.
- The receipt must not falsely claim immediate removal from all backups.

---

## 7. API and Integration Contracts

### 7.1 Public API conventions

| Concern | Standard |
| ---------------- | -------------------------------------------------------------------------- |
| Base | `/v1` |
| Authentication | Short-lived bearer token |
| Authorization | Server-side membership + policy decision |
| Workspace path | May be present for resource addressing, but never trusted as authorization |
| Correlation | `X-Request-ID` and W3C `traceparent` |
| Idempotency | `Idempotency-Key` required for consequential POST requests |
| Concurrency | `ETag`/`If-Match` or explicit proposal version |
| Async operations | `202 Accepted` with `jobId` and status URL |
| Pagination | Cursor-based |
| Errors | One schema under `components.schemas.ErrorEnvelope` |
| Rate limits | Per user, workspace, IP-risk signal, operation, and upstream quota |
| Webhooks | Signature verification where available, inbox dedupe, replay protection |
| Versioning | URL major version plus explicit deprecation policy |

### 7.2 Correct OpenAPI 3.1 fragment

```yaml
openapi: 3.1.1
info:
  title: Vaeloom Core API
  version: 1.0.0
servers:
  - url: https://api.vaeloom.example/v1
security:
  - bearerAuth: []

paths:
  /workspaces/{workspaceId}/documents:
    get:
      operationId: listDocuments
      parameters:
        - $ref: '#/components/parameters/WorkspaceId'
        - $ref: '#/components/parameters/Cursor'
      responses:
        '200':
          description: Documents
          headers:
            X-Request-ID:
              $ref: '#/components/headers/RequestId'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DocumentPage'
        '403':
          $ref: '#/components/responses/Forbidden'

  /workspaces/{workspaceId}/proposals/{proposalId}/approvals:
    post:
      operationId: approveProposal
      parameters:
        - $ref: '#/components/parameters/WorkspaceId'
        - name: proposalId
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: Idempotency-Key
          in: header
          required: true
          schema: { type: string, minLength: 16, maxLength: 128 }
        - name: If-Match
          in: header
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApprovalRequest'
      responses:
        '202':
          description: Approval accepted and execution job created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/JobAccepted'
        '409':
          $ref: '#/components/responses/Conflict'
        '412':
          $ref: '#/components/responses/PreconditionFailed'

  /workspaces/{workspaceId}/jobs/{jobId}:
    get:
      operationId: getJob
      parameters:
        - $ref: '#/components/parameters/WorkspaceId'
        - name: jobId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Job status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Job'

  /workspaces/{workspaceId}/deletion-requests:
    post:
      operationId: requestWorkspaceDeletion
      parameters:
        - $ref: '#/components/parameters/WorkspaceId'
        - name: Idempotency-Key
          in: header
          required: true
          schema: { type: string, minLength: 16, maxLength: 128 }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [confirmation]
              properties:
                confirmation:
                  type: string
                  const: DELETE
      responses:
        '202':
          description: Deletion accepted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeletionAccepted'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    WorkspaceId:
      name: workspaceId
      in: path
      required: true
      description:
        Resource locator only; authorization derives from verified membership.
      schema: { type: string, format: uuid }
    Cursor:
      name: cursor
      in: query
      required: false
      schema:
        type: [string, 'null']

  headers:
    RequestId:
      schema: { type: string }

  schemas:
    Document:
      type: object
      required: [id, path, mediaType, archived, createdAt]
      properties:
        id: { type: string, format: uuid }
        path: { type: string }
        mediaType: { type: string }
        summary: { type: [string, 'null'] }
        archived: { type: boolean }
        createdAt: { type: string, format: date-time }

    DocumentPage:
      type: object
      required: [items, nextCursor]
      properties:
        items:
          type: array
          items: { $ref: '#/components/schemas/Document' }
        nextCursor:
          type: [string, 'null']

    ApprovalRequest:
      type: object
      required: [proposalVersion, approvedPayloadHash]
      additionalProperties: false
      properties:
        proposalVersion: { type: integer, minimum: 1 }
        approvedPayloadHash: { type: string, pattern: '^[a-f0-9]{64}$' }

    JobAccepted:
      type: object
      required: [jobId, status, statusUrl]
      properties:
        jobId: { type: string, format: uuid }
        status: { type: string, const: queued }
        statusUrl: { type: string, format: uri-reference }

    Job:
      type: object
      required: [id, type, status, progress, createdAt]
      properties:
        id: { type: string, format: uuid }
        type: { type: string }
        status:
          type: string
          enum:
            [
              queued,
              running,
              waiting_for_user,
              succeeded,
              failed,
              cancelled,
              partially_succeeded,
            ]
        progress: { type: integer, minimum: 0, maximum: 100 }
        result: { type: [object, 'null'] }
        error:
          {
            oneOf:
              [
                { $ref: '#/components/schemas/ErrorEnvelope' },
                { type: 'null' },
              ],
          }
        createdAt: { type: string, format: date-time }

    DeletionAccepted:
      type: object
      required: [deletionRequestId, status, receiptId]
      properties:
        deletionRequestId: { type: string, format: uuid }
        status: { type: string, const: requested }
        receiptId: { type: string, format: uuid }

    ErrorEnvelope:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message, requestId]
          properties:
            code: { type: string }
            message: { type: string }
            requestId: { type: string }
            details: { type: object, additionalProperties: true }

  responses:
    Forbidden:
      description: Permission denied
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorEnvelope' }
    Conflict:
      description: Resource conflict or idempotency payload mismatch
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorEnvelope' }
    PreconditionFailed:
      description: Proposal version or ETag no longer matches
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorEnvelope' }
```

### 7.3 Endpoint catalog

| Domain | Mandatory endpoints |
| -------------- | --------------------------------------------------------------------------------------- |
| Auth/workspace | Session, membership, workspace status |
| Connectors | List, authorize, callback, scopes, sync, disconnect, reauth |
| Documents | Upload-init, upload-complete, list, detail, versions, archive, restore, viewer metadata |
| Proposals | List, detail, approve, reject, supersede, batch decision |
| Jobs | Create, get, cancel where safe, event stream |
| Memory | Query, fact detail, provenance, correction, dispute, graph subgraph |
| Resume | Master, versions, variants, render, gap questions |
| ATS | Score job description, score status, suggestions |
| Career | Sources, shortlist, role detail, prepare application, approve action, status |
| Gmail | Sync, classifications, draft detail, extracted deadlines |
| Scheduler | Events, conflicts, reminders, approved external write |
| Audit | Filtered actions, action detail, undo where supported |
| Settings | Agent/action autonomy, privacy, model consent, notification preferences |
| Export | Request, status, manifest, download |
| Deletion | Request, status, receipt |
| System | Health, readiness, version metadata |

### 7.4 Webhook reliability

For Gmail and other event sources:

- Authenticate provider message/channel.
- Store provider event ID or a deterministic dedupe key.
- Acknowledge quickly.
- Process asynchronously.
- Use source history APIs for reconciliation.
- Handle duplicate and out-of-order messages.
- Renew Gmail mailbox watches at least every seven days; schedule daily renewal.
- Run periodic history reconciliation because notifications may be delayed or
 missed.
- Alert before watch expiry.

### 7.5 Integration registry

```yaml
integration:
  id: indeed_partner
  status: disabled
  access_basis: unconfirmed_partner_dependency
  owner: product_integrations
  allowed_capabilities: []
  prohibited_capabilities:
    - candidate_search_scraping
    - unauthorized_application_submission
  terms_reviewed_at: null
  security_reviewed_at: null
  kill_switch: true
```

No integration is enabled until product, legal, security, and engineering owners
approve this record.

---

## 8. Security, Privacy, Consent, and Deletion

### 8.1 Corrected security claim

A foreign key to a workspace-owned table does not by itself make cross-workspace
access impossible. The design must use the layered controls in Sections 4 and 6.

### 8.2 Security control domains

| Domain | Minimum MVP control |
| ------------------ | ------------------------------------------------------------------------------ |
| Identity | Managed auth, short sessions, secure refresh, MFA option for sensitive actions |
| Authorization | Central policy decision, exact action/resource/purpose checks |
| Workload identity | Signed service identity with audience and expiry |
| Database isolation | RLS and composite workspace FKs |
| Secrets | KMS-backed secrets manager, rotation, no plaintext app DB token |
| File ingestion | Type detection, malware scanning, sandbox, decompression limits, macro disable |
| AI | Prompt-injection defense, tool isolation, output validation |
| Connectors | Scope minimization, quota controls, token revocation, kill switch |
| Audit | Append-only application permission, tamper-evident anchoring |
| Supply chain | Dependency lock, scans, SBOM, signed images |
| Data lifecycle | Retention, export, correction, deletion, backup tombstones |
| Incident response | Severity model, containment, evidence preservation, user notification process |

### 8.3 Prompt injection and untrusted-content policy

Untrusted content includes:

- Documents.
- Emails.
- Job descriptions.
- Repository text.
- Webhook payloads.
- Connector API results.
- Retrieved memory originally derived from external content.

Rules:

1. Wrap untrusted content in explicit data boundaries.
2. Never concatenate content into policy or system instructions without
 structured encoding.
3. Tool authorization comes only from signed policy context.
4. Ignore instructions inside content that request secrets, policy changes, tool
 access, or data from other users.
5. Validate tool arguments against a strict schema and policy.
6. Apply output validation before memory writes.
7. Record prompt-injection detection and outcome in security telemetry.
8. Red-team each agent and connector.

### 8.4 Deletion lifecycle

```mermaid
stateDiagram-v2
 [*]--> Requested
 Requested--> PrimaryErasureRunning
 PrimaryErasureRunning--> PrimaryErasureComplete
 PrimaryErasureComplete--> BackupExpiryPending
 BackupExpiryPending--> Complete
 PrimaryErasureRunning--> Failed
 BackupExpiryPending--> Failed
```

#### Step 1 — request acceptance

- Reauthenticate the user for destructive account deletion.
- Record the request and immutable receipt.
- Freeze new ingestion and agent execution.
- Revoke connector access.
- Disable external callbacks and watches.

#### Step 2 — primary erasure

Erase or render inaccessible:

- Relational workspace records.
- Graph projections.
- Vector records and indexes.
- Search indexes.
- Object versions and multipart uploads.
- Cache entries.
- Queue payloads and delayed jobs.
- Connector secrets and refresh tokens.
- Generated documents.
- Product analytics identifiers where deletion is permitted.
- Model-provider stored data according to configured provider controls.

#### Step 3 — audit minimization

- Keep only legally/security-required event metadata.
- Remove unnecessary content.
- Pseudonymize user identifiers where permitted.
- Record the policy basis and retention deadline.

#### Step 4 — backup handling

- Add workspace ID to a deletion tombstone registry.
- Prevent accidental resurrection after restore.
- Track the latest backup expiry.
- Issue a primary-erasure receipt.
- Issue final completion only after backup expiry or key destruction.

### 8.5 Export contract

The export archive contains:

```text
manifest.json
profile/
documents/
document-metadata/
memory/
knowledge-graph/
resumes/
applications/
schedule/
connector-metadata/
audit/
provenance/
README.md
checksums.sha256
```

The manifest includes schema version, generation time, included and excluded
categories, failed items, object counts, and checksums.

### 8.6 Privacy decisions required before launch

`STAKEHOLDER-DECISION`

- Legal entity and jurisdiction.
- Initial launch countries.
- Minimum user age.
- Whether users below the applicable digital-consent age are excluded or require
 verified guardian consent.
- Model-provider data retention and training settings.
- Data-retention defaults.
- DPO/privacy contact.
- Whether a formal DPIA is legally required; perform one regardless if risk is
 high.
- Terms and privacy policy review.
- Job-platform and connector legal review.

### 8.7 Minor-user considerations

Because the primary audience includes students, the MVP must not assume every
user is an adult.

At minimum:

- Do not collect age unless needed for a defined legal/product purpose.
- If an age gate is used, implement it consistently and document handling of
 underage attempts.
- Do not enable autonomous consequential actions for minor users by default.
- Avoid exposing sensitive inferred traits.
- Provide understandable privacy explanations.
- Make export, correction, and deletion accessible.
- Obtain qualified legal advice for target launch regions.

---

## 9. UI/UX and Accessibility Completion

### 9.1 Accessibility baseline

`EXTERNAL-VERIFIED`

Use **WCAG 2.2 AA** as the target baseline.

Mandatory manual coverage:

- Keyboard-only completion of every workflow.
- Visible focus.
- Screen-reader labels and announcements.
- Zoom/reflow.
- Reduced motion.
- Non-color-only state communication.
- Accessible drag-and-drop alternatives.
- Accessible data tables.
- Graph-view alternative as a list/table.
- Timeout warnings and extensions.
- Error identification and recovery.
- Accessible authentication.

### 9.2 Required interaction states

Every async feature must define:

| State | Required UI |
| ------------------------ | ----------------------------------------------------------- |
| Idle | Clear starting action |
| Uploading | Byte/file progress and cancel behavior |
| Queued | Queue state and expected next step, without false precision |
| Processing | Stage-level progress |
| Waiting for user | Specific question or approval |
| Partial success | Itemized success/failure and retry |
| Success | Result, provenance, next action |
| Recoverable failure | Plain-language cause, safe retry |
| Permanent failure | Alternative path and support reference |
| Permission denied | Missing scope and how to grant safely |
| Connector degraded | Affected capability only |
| Rate limited | Retry guidance |
| Deleted/expired proposal | Explain stale state and show newer proposal |
| Offline/reconnect | Preserve safe local state without duplicating action |

### 9.3 Approval UI invariant

A proposal diff must show:

- Agent.
- Exact action.
- Resource.
- Before and after.
- Reason.
- Evidence/provenance.
- Confidence.
- Side effects.
- Reversibility.
- Expiry.
- The exact document or payload version.
- Approve, reject, and edit where safe.

Approval must not be represented by a vague “Continue” button.

### 9.4 Memory confidence UI

Distinguish:

- Confirmed fact.
- Extracted fact.
- Inferred preference.
- Disputed fact.
- Superseded fact.
- Low-confidence candidate.

Every fact detail view links to source provenance and correction controls.

### 9.5 Deletion UI

Deletion UX must:

- Explain immediate primary erasure versus backup expiration.
- Require reauthentication.
- Present a final impact summary.
- Avoid dark patterns.
- Provide receipt download.
- Show progress and any failures.
- Provide a support/escalation path.

---

## 10. Testing and Quality Engineering Completion

### 10.1 Mandatory test layers

| Layer | Gate |
| ------------- | ------------------------------------------------------- |
| Unit | Critical policy, merge, parser, and state-machine logic |
| Schema | JSON Schema/OpenAPI/event-schema validation |
| Database | Migrations, constraints, RLS, rollback compatibility |
| Integration | API↔DB, API↔AI, tool gateway↔connector |
| Contract | Consumer/provider contracts |
| E2E | First-value and career workflows |
| AI eval | Every prompt/model/retrieval change |
| Security | STRIDE/abuse-case tests |
| Privacy | Export/deletion/resurrection tests |
| Accessibility | Automated plus manual |
| Load | Staging release gate |
| Resilience | Connector outage, duplicate webhook, queue retry |
| Supply chain | Dependencies, image, IaC, SBOM, signature |

### 10.2 Cross-workspace isolation test matrix

Mandatory attacks:

- Path workspace differs from token workspace.
- Body resource belongs to another workspace.
- Composite relationship references another workspace.
- Search filter omitted.
- Vector result from another workspace.
- Graph traversal crosses workspace.
- Cache key collision.
- Job worker receives forged workspace payload.
- Export includes another workspace.
- Audit query leaks identifiers.
- Connector callback mapped to wrong workspace.
- Deletion job targets another workspace.

Every test must fail closed.

### 10.3 Approval integrity tests

- Approval for proposal v1 cannot execute v2.
- Payload hash mismatch is rejected.
- Expired approval is rejected.
- Revoked approval is rejected.
- Used approval cannot be replayed.
- Idempotent retry returns original result.
- Same idempotency key with different request fails.
- Approval cannot be used by a different workspace.
- Approval cannot execute a broader connector scope.
- Agent cannot synthesize an approval token.

### 10.4 Deletion tests

- All primary stores are checked.
- Object versions are checked.
- Search/vector/graph residuals are checked.
- Cache and queues are checked.
- Connector tokens are unusable.
- Restoring a backup triggers tombstone deletion.
- Receipts match actual store results.
- Partial failure remains visible and retryable.
- Audit minimization meets policy.
- Final completion is not issued early.

### 10.5 AI quality gate example

```yaml
ai_release_gate:
  dataset_version: vaeloom-eval-1.0.0
  required:
    extraction:
      macro_f1: '>= approved_baseline'
      no_slice_regression: true
    retrieval:
      recall_at_10: '>= approved_baseline'
      citation_accuracy: '>= approved_baseline'
    safety:
      unauthorized_tool_calls: 0
      cross_workspace_leakage: 0
      prompt_injection_policy_bypass: 0
    resume:
      unsupported_material_claims: 0
  statistical_report_required: true
  human_review_required: true
```

Numeric baselines are set only after the first labeled dataset and benchmark.

### 10.6 E2E canonical journey

1. Create account and isolated workspace.
2. Upload a resume.
3. Complete async ingestion.
4. View extracted facts with provenance.
5. Correct one fact.
6. Review an organization proposal.
7. Approve the exact version.
8. Verify idempotent application.
9. Generate a master resume.
10. Paste a job description.
11. Receive ATS suggestions with traceable evidence.
12. Search an approved source or use a user-supplied listing.
13. Prepare, review, and approve application artifacts.
14. Deep-link or call an approved partner API.
15. Record outcome.
16. Verify the outcome affects future ranking.
17. Export data.
18. Delete the workspace in a dedicated destructive test environment.
19. Verify primary erasure and receipts.

---

## 11. Performance, Reliability, and Capacity Completion

### 11.1 Corrected vector storage estimate

The original model estimated approximately 15 million entity rows and treated
this as comfortably inside one normal PostgreSQL instance.

A raw 1536-dimensional float32 vector is approximately 6,144 bytes. Fifteen
million such vectors are about 92 GB **before**:

- Row overhead.
- HNSW index.
- Relational indexes.
- Graph data.
- Text chunks.
- WAL.
- Replication.
- Backups.
- Temporary build space.
- Dead tuples and vacuum headroom.

Therefore, no “comfortably fits” claim is accepted without a benchmark.

### 11.2 Capacity model inputs

Track separately:

- Workspaces.
- Active users.
- Documents.
- Document versions.
- Chunks per document.
- Embeddings per chunk.
- Vector dimension and representation.
- Graph nodes and edges.
- Connector events.
- Agent jobs.
- Audit events.
- Object-storage bytes.
- Model tokens.
- Peak synchronized Gmail work.

### 11.3 Benchmark stages

| Stage | Dataset | Gate |
| -------------- | ------------------------ | --------------------------------------------- |
| Developer | 10 workspaces | Functional correctness |
| CI | 100 synthetic workspaces | Isolation and migration |
| Staging small | 500 workspaces | Query plans and job behavior |
| Staging target | Expected launch cohort | SLO validation |
| Stress | 2–3× target | Failure mode and recovery |
| Soak | 24–72 hours | Memory leaks, queue growth, index maintenance |

### 11.4 Revised migration triggers

Triggers require sustained measurement and cost review, not a single spike.

| Signal | Investigate | Migration candidate |
| ------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------- |
| Vector P95 exceeds approved SLO after query/index tuning | Partition, `halfvec`, filters, iterative scans, hardware | Dedicated vector service |
| Graph traversal exceeds SLO after bounded-depth/query optimization | Materialized relationships, read models | Dedicated graph database |
| Combined extension support blocks managed production | Separate graph or vector workload | Managed compatible services |
| HNSW build/vacuum causes unacceptable operational impact | Partition or rebuild strategy | Dedicated vector service |
| Queue retry/replay needs exceed BullMQ design | Outbox, durable event log | Kafka-compatible platform |

### 11.5 SLO set

| SLO | MVP target |
| ----------------------------------- | ---------------------------------------- |
| Core API availability | 99.5% monthly |
| Read API P95 | <300 ms excluding large content transfer |
| Async job acceptance P95 | <1 s |
| Upload-init P95 | <1 s |
| First validated entity | P95 <5 min for supported file sizes |
| Proposal approval application | P95 <10 s for local/internal operations |
| Webhook acknowledgment | Within provider requirement |
| Gmail watch renewal success | >99.9% before expiration |
| Cross-workspace leakage | 0 |
| Data-loss event | 0 |
| Deletion primary-erasure completion | Approved SLO after benchmark |

### 11.6 Reliability patterns

- Exponential backoff with jitter.
- Dead-letter queues.
- Maximum attempts and poison-message quarantine.
- Idempotent consumers.
- Circuit breakers around external APIs.
- Per-connector bulkheads.
- Queue lag alerting.
- Outbox publisher recovery.
- Graceful worker drain.
- No model or connector retry after an uncertain consequential action without
 idempotency verification.

---

## 12. DevOps, CI/CD, and Supply-Chain Completion

### 12.1 CI design correction

GitHub-hosted jobs use fresh runner instances. Each job must check out code and
set up its dependencies, or consume explicit artifacts from an earlier job. The
original representative workflow omitted those steps in multiple jobs.

### 12.2 Reference CI workflow

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'
  PYTHON_VERSION: '3.12'

jobs:
  lint_type_unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip

      - run: npm ci
      - run: python -m pip install --upgrade pip
      - run: pip install -r apps/ai-service/requirements.txt
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit -- --coverage
      - run: ruff check apps/ai-service
      - run: mypy apps/ai-service
      - run: pytest apps/ai-service/tests/unit --cov

  api_contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run openapi:lint
      - run: npm run openapi:breaking -- --base origin/main
      - run: npm run event-schemas:validate

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: ghcr.io/vaeloom/postgres-age-pgvector:pg16-age-pinned-vector-pinned
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vaeloom_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres -d vaeloom_test"
          --health-interval 10s --health-timeout 5s --health-retries 10
      redis:
        image: redis:7.4
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 10s --health-timeout
          5s --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vaeloom_test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip
      - run: npm ci
      - run: pip install -r apps/ai-service/requirements.txt
      - run: npm run db:migrate
      - run: npm run test:integration
      - run: pytest apps/ai-service/tests/integration
      - run: npm run test:rls-isolation
      - run: npm run db:migrate:rollback-compat

  ai_eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip
      - run: pip install -r apps/ai-service/requirements.txt
      - run: python apps/ai-service/eval/run.py --config eval/release-gate.yaml
        env:
          EVAL_MODE: deterministic_or_recorded
      - uses: actions/upload-artifact@v4
        with:
          name: ai-eval-report
          path: artifacts/ai-eval/

  security:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/scan-secrets.sh
      - run: ./scripts/scan-dependencies.sh
      - run: ./scripts/scan-sast.sh
      - run: ./scripts/scan-iac.sh

  build:
    needs: [lint_type_unit, api_contract, integration, ai_eval, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/build-images.sh "${GITHUB_SHA}"
      - run: ./scripts/generate-sbom.sh "${GITHUB_SHA}"
      - run: ./scripts/scan-images.sh "${GITHUB_SHA}"
      - run: ./scripts/sign-images-keyless.sh "${GITHUB_SHA}"
      - run: ./scripts/push-images.sh "${GITHUB_SHA}"
```

Action versions and base images must be pinned and maintained. Production may
additionally pin third-party actions by commit SHA.

### 12.3 Custom database image

The repository must contain a reproducible image build that:

- Starts from the official PostgreSQL 16 image.
- Installs pinned pgvector.
- Installs pinned Apache AGE.
- Runs extension smoke tests.
- Publishes an SBOM.
- Is vulnerability-scanned.
- Is never assumed equivalent to the production managed service without
 validation.

### 12.4 Deployment pipeline

```mermaid
flowchart LR
 PR[Pull request]--> CI[Quality and security gates]
 CI--> IMAGE[Signed images + SBOM]
 IMAGE--> STAGE[Deploy staging]
 STAGE--> MIG[Migration checks]
 MIG--> E2E[E2E + AI eval + load + accessibility]
 E2E--> APPROVAL[Manual production approval]
 APPROVAL--> CANARY[Canary / blue-green]
 CANARY--> VERIFY[Smoke + SLO + security checks]
 VERIFY--> PROMOTE[Promote]
 VERIFY--> ROLLBACK[Rollback]
```

### 12.5 Migration deployment

- Expand/contract only.
- Backward-compatible API and worker rollout.
- Schema change separate from app startup.
- Pre-deploy backup/checkpoint.
- Lock-time budget.
- Query-plan check.
- Roll-forward preferred; rollback plan for code and data.
- Embedding migration uses dual-write and shadow read before cutover.

### 12.6 Environment rules

- Dev, staging, and production have separate accounts/projects, databases,
 buckets, secrets, and connector applications.
- No production personal data in lower environments.
- Synthetic or explicitly consented test data only.
- Production access is least-privilege, time-bound, and audited.
- Break-glass access is documented and reviewed.

---

## 13. Observability and Operations Completion

### 13.1 Required telemetry

Every workflow must emit:

- Trace ID.
- Request ID.
- Workspace pseudonymous ID.
- Actor type.
- Agent and version.
- Job ID.
- Proposal/approval ID where applicable.
- Tool call name.
- Policy decision and version.
- Model/provider IDs.
- Token and cost metrics without sensitive prompt logging.
- Retrieval count and latency.
- Connector latency/quota status.
- Memory-write result.
- Error category.

### 13.2 Logging policy

Never log by default:

- Full resume content.
- Email bodies.
- OAuth tokens.
- Application answers.
- Raw model prompts containing personal data.
- Document text.
- Deletion export contents.

Use structured redaction and allow-list logging.

### 13.3 Mandatory dashboards

- API SLO.
- Async jobs and queue lag.
- Ingestion stages.
- Model latency/error/cost.
- Retrieval quality operational signals.
- Connector health and Gmail watch expiry.
- Authorization denials.
- Cross-workspace test monitor.
- Deletion backlog.
- Audit sink health.
- Database extension health/index size.
- Object storage and backup status.

### 13.4 Runbook minimum set

1. Cross-workspace exposure suspected.
2. Connector token compromise.
3. Prompt-injection/tool-abuse spike.
4. Gmail watch-expiry or history-gap incident.
5. Queue backlog.
6. Database extension failure.
7. Vector-index degradation.
8. Wrong entity-merge incident.
9. Model/provider outage.
10. Deletion job partial failure.
11. Audit sink failure.
12. Production rollback.
13. External platform terms/access revoked.

### 13.5 Incident priorities

A suspected cross-workspace leak, credential compromise, or unauthorized
consequential action is Severity 1 until disproved.

Immediate actions:

- Disable affected route/tool/connector.
- Preserve evidence.
- Revoke credentials/tokens.
- Contain workspace/service scope.
- Start incident timeline.
- Engage privacy/legal owner if personal data may be affected.
- Do not silently correct and close.

---

## 14. Implementation Sequence and Gates

### Stage 0 — Repository and governance foundation

Deliver:

- Monorepo.
- CODEOWNERS.
- Branch protection.
- ADR directory.
- Threat-model directory.
- OpenAPI source.
- Event schemas.
- CI baseline.
- Custom test database image.
- Secrets and environment conventions.

Exit gate:

- CI runs successfully.
- Combined AGE + pgvector smoke test passes.
- Security scans run.
- No production credentials exist in development.

### Stage 1 — Identity, workspace, and isolation

Deliver:

- Auth.
- Workspace membership.
- Signed internal context.
- RLS.
- Composite constraints.
- Audit events.
- Negative isolation tests.

Exit gate:

- All cross-workspace test cases pass.
- No service accepts client-created permission context.

### Stage 2 — Async jobs, files, and ingestion

Deliver:

- Upload workflow.
- Object storage.
- File safety.
- Job state.
- Parser bake-off.
- Provenance.
- Connector registry.

Exit gate:

- Supported formats pass acceptance dataset.
- Malicious/unsupported file tests pass.
- P95 first-entity target passes in staging.

### Stage 3 — Memory and retrieval

Deliver:

- Six memory types.
- Entity resolution.
- Embedding provider abstraction.
- Hybrid retrieval.
- Reranker.
- Corrections and supersession.
- Provenance UI/API.

Exit gate:

- AI evaluation baseline approved.
- Cross-workspace vector/graph tests pass.
- No unsupported source claims in release set.

### Stage 4 — Organization and trust workflow

Deliver:

- Proposals.
- Diff UI.
- Approval binding.
- Idempotent action execution.
- Undo.
- Audit detail.

Exit gate:

- Approval integrity suite passes.
- Organization acceptance measured on pilot users.

### Stage 5 — Resume and ATS

Deliver:

- Master resume.
- Variants.
- Gap questions.
- ATS analysis.
- Version traceability.

Exit gate:

- Zero material unsupported claims on evaluation set.
- Accessibility review passes.

### Stage 6 — Career intelligence

Deliver:

- Approved source registry.
- Ranking.
- Application material preparation.
- Deep-link flow.
- Partner API adapters disabled by default.

Exit gate:

- Legal/access basis approved per enabled source.
- No unauthorized automation.
- Every action bound to approval.

### Stage 7 — Gmail and scheduler

Deliver:

- OAuth scopes.
- Scheduled sync.
- Push watch.
- Daily watch renewal.
- History reconciliation.
- Deadline extraction and conflicts.
- Draft-only UI.

Exit gate:

- Urgent-mail evaluation approved.
- Duplicate/missed/out-of-order event tests pass.
- Watch-expiry alert works.

### Stage 8 — Data control and release hardening

Deliver:

- Export.
- Deletion state machine.
- Receipts.
- Backup tombstones.
- Accessibility completion.
- Runbooks.
- Staging load/soak/security tests.

Exit gate:

- Section 16 checklist complete.
- Production authorization recorded by named owners.

---

## 15. Traceability for Added Requirements

| Requirement | Architecture | Data | API | UI | Tests | Ops |
| -------------------------- | ------------ | ------------------------------- | --------------------- | -------------------- | ---------------------- | ------------------ |
| FR-52/53 embeddings | §5 | §6.3 | Internal provider API | Settings/status | AI benchmark/migration | Model dashboards |
| FR-54 provenance | §5.5 | Memory/source fields | Memory fact endpoints | Fact detail | Citation accuracy | Retrieval metrics |
| FR-55/56 approvals | §4.5 | proposals/approvals/idempotency | Approval endpoints | Diff card | Approval suite | Audit |
| FR-57 jobs | §4 | jobs table | Job endpoints | Progress states | Retry/cancel tests | Queue dashboards |
| FR-58 webhooks | ADR-012 | webhook inbox | Provider callback | Connector health | Duplicate/order tests | Watch alerts |
| FR-59/60 auth context | §4 | RLS/context | Middleware | Permission errors | Cross-workspace suite | Denial telemetry |
| FR-61/62 deletion | §8 | deletion tables/tombstones | Deletion endpoints | Receipts/progress | Residual-data suite | Deletion dashboard |
| FR-63 model versions | §5.6 | Run metadata | Result metadata | Explainability | Reproducibility | Model dashboard |
| FR-64 grounded claims | §5.5 | Provenance | Fact/result schema | Confidence labels | Citation tests | Quality monitor |
| FR-65 quarantine | §8.2 | Quarantine metadata | Job error | Safe error state | Malicious file tests | Quarantine alert |
| FR-66 integration registry | §7.5 | Registry table/config | Admin config | Connector status | Disabled-by-default | Kill switch |
| FR-67 MCP pin | ADR-015 | Version metadata | Tool schema profile | N/A | Compatibility suite | Upgrade runbook |
| FR-68 corrections | §5.5 | Supersession | Correction endpoint | Fact correction | History tests | Audit |
| FR-70 prompt injection | ADR-013 | Security events | Tool gateway | Warning where useful | Red-team suite | Incident monitor |

---

## 16. Production Release Evidence Checklist

Production is blocked until all mandatory items are complete.

### 16.1 Product and legal

- [ ] MVP scope and agent roster signed off.
- [ ] Launch geography selected.
- [ ] Minimum-age/consent policy approved.
- [ ] Privacy policy and terms reviewed by qualified counsel.
- [ ] Connector and job-source access basis approved.
- [ ] Model-provider data-processing configuration approved.
- [ ] Stakeholder-approved numeric release thresholds.

### 16.2 Architecture and data

- [ ] ADR-007 through ADR-016 accepted.
- [ ] PostgreSQL/AGE/pgvector compatibility proven in staging.
- [ ] RLS and composite constraints deployed.
- [ ] Cross-workspace negative suite passes.
- [ ] Backup and restore drill passes.
- [ ] Backup tombstone deletion test passes.
- [ ] Vector capacity benchmark passes.

### 16.3 API and application

- [ ] Complete generated OpenAPI artifact exists.
- [ ] OpenAPI lint and breaking-change checks pass.
- [ ] All consequential endpoints require idempotency.
- [ ] Async job endpoints and cancellation semantics pass.
- [ ] Webhook dedupe/reconciliation passes.
- [ ] Approval integrity suite passes.

### 16.4 AI

- [ ] Embedding and reranker benchmark completed.
- [ ] Model/prompt/tool/retrieval versions pinned.
- [ ] Golden dataset versioned.
- [ ] Statistical evaluation report approved.
- [ ] Prompt-injection red-team passes.
- [ ] Zero cross-workspace leakage.
- [ ] Zero unauthorized tool calls in release suite.
- [ ] Unsupported-claim gate passes.

### 16.5 Security/privacy

- [ ] Full threat model complete.
- [ ] Penetration test complete with no unresolved critical/high finding.
- [ ] Secret rotation and revocation tested.
- [ ] Audit tamper-evidence tested.
- [ ] Export verified.
- [ ] Primary deletion verified across all stores.
- [ ] Final deletion receipt semantics reviewed.
- [ ] Incident-response exercise completed.

### 16.6 Quality and accessibility

- [ ] Unit/integration/contract/E2E suites green.
- [ ] Load and soak tests green.
- [ ] Resilience tests green.
- [ ] WCAG 2.2 AA automated and manual review complete.
- [ ] Keyboard and screen-reader critical journeys pass.
- [ ] No critical/serious unresolved accessibility defects.

### 16.7 Platform and operations

- [ ] Images scanned, signed, and accompanied by SBOM.
- [ ] IaC reviewed and scanned.
- [ ] Staging/prod isolation confirmed.
- [ ] SLO dashboards and alerts live.
- [ ] Runbooks tested.
- [ ] Rollback drill complete.
- [ ] On-call ownership assigned.
- [ ] Production manual approval recorded.

**Release decision:** `BLOCKED` until every mandatory item is satisfied or a
formally documented risk acceptance is approved by the accountable owner.
Cross-workspace isolation, unauthorized actions, critical security findings, and
false deletion claims are not waivable for MVP release.

---

## 17. Phase-by-Phase Merge Map

| Original phase | Add/replace with |
| -------------- | -------------------------------------------------------------------------- |
| Phase 0 | Authority rules and external dependency register |
| Phase 1 | Revised success-metric evidence rules |
| Phase 2 | Updated external integration and platform-access research |
| Phase 3 | Section 3 requirements |
| Phase 4 | Corrected eight-agent build-plan terminology |
| Phase 5 | Section 4 architecture and ADR-007–016 |
| Phase 6 | Provider-neutral AI stack and pinned versions |
| Phase 7 | Section 6 hardened schema and deletion semantics |
| Phase 8 | Section 7 API and OpenAPI contract |
| Phase 9 | Section 9 WCAG 2.2 and state requirements |
| Phase 10 | Approval, async, provenance, and deletion UI invariants |
| Phase 11 | Policy context, tool gateway, jobs, idempotency |
| Phase 12 | Section 5 AI architecture and evaluation |
| Phase 13 | Section 8 security/privacy |
| Phase 14 | Section 10 test matrix |
| Phase 15 | Section 11 capacity and benchmark correction |
| Phase 16 | Section 12 corrected CI/CD |
| Phase 17 | Section 13 telemetry/runbooks |
| Phase 18 | This document plus generated API/schema/runbook artifacts |
| Phase 19 | Section 16 release checklist |
| Phase 20 | Post-deploy SLO, isolation, connector, and deletion verification |
| Phase 21 | Model/embedding refresh, access review, backup drills, threat-model review |

---

## 18. Open Stakeholder Decisions

| ID | Decision | Blocks |
| ----- | ------------------------------------------------------------------------- | ------------------------------- |
| SD-01 | Legal entity and jurisdiction | Public launch |
| SD-02 | Launch countries | Privacy/terms/data region |
| SD-03 | Minimum age and consent policy | Public launch |
| SD-04 | Cloud and managed database provider | Infrastructure provisioning |
| SD-05 | Budget and model-cost envelope | Provider selection |
| SD-06 | Target launch cohort and traffic | Final capacity target |
| SD-07 | Embedding/reranker deployment preference: managed, self-hosted, or hybrid | Benchmark shortlist |
| SD-08 | Audit retention period | Privacy/security implementation |
| SD-09 | Backup retention period | Final deletion timing |
| SD-10 | Enabled job sources and signed partner relationships | Career source enablement |
| SD-11 | Exact autonomy eligibility policy | Autonomy UI and policy |
| SD-12 | Support/on-call staffing | Production launch |

No design document should silently decide these as if stakeholder approval
occurred.

---

## 19. External Verification Register

The following current primary sources informed corrections. They do not replace
Vaeloom's product requirements; they verify external technical/platform facts.

1. Anthropic Claude Platform documentation — Embeddings 
 `https://docs.anthropic.com/en/docs/build-with-claude/embeddings` 
 Confirms Anthropic does not provide its own embedding model.

2. W3C — Web Content Accessibility Guidelines 2.2 
 `https://www.w3.org/TR/WCAG22/` 
 Current accessibility target used by this specification.

3. GitHub Docs — Choosing the runner for a job 
 `https://docs.github.com/actions/using-jobs/choosing-the-runner-for-a-job` 
 Confirms GitHub-hosted jobs use fresh runner instances.

4. Google Gmail API — Configure push notifications 
 `https://developers.google.com/workspace/gmail/api/guides/push` 
 Confirms watch renewal requirements and operational considerations.

5. OpenAPI Specification 3.1.1 
 `https://spec.openapis.org/oas/v3.1.1.html` 
 Basis for OpenAPI and JSON Schema conventions.

6. Apache AGE Quick Start 
 `https://age.apache.org/getstarted/quickstart/` 
 Current published PostgreSQL compatibility information.

7. pgvector repository 
 `https://github.com/pgvector/pgvector` 
 Current vector types, indexes, and iterative-scan capabilities.

8. Indeed Partner Documentation — Job Sync API 
 `https://docs.indeed.com/job-sync-api` 
 Shows the partner/ATS-oriented integration scope.

9. LinkedIn User Agreement 
 `https://www.linkedin.com/legal/user-agreement` 
 Current restrictions on scraping and unauthorized automation.

10. Model Context Protocol specification/blog 
 `https://modelcontextprotocol.io/` 
 Basis for version-pinning and authorization compatibility requirements.

11. BAAI BGE-M3 model card 
 `https://huggingface.co/BAAI/bge-m3` 
 Open-model benchmark candidate.

12. BAAI BGE reranker v2 M3 model card 
 `https://huggingface.co/BAAI/bge-reranker-v2-m3` 
 Reranking benchmark candidate.

13. Voyage AI embedding documentation 
 `https://docs.voyageai.com/reference/embeddings-api` 
 Managed-provider benchmark candidate and configurable dimensions.

14. Docling repository 
 `https://github.com/docling-project/docling` 
 Ingestion/parser benchmark candidate.

All external dependencies must be rechecked during implementation because
versions, access programs, terms, and capabilities can change.

---

## 20. Final Quality Gate

### Design axis

| Area | Result |
| -------------------------- | ---------------------------------------- |
| Scope consistency | Passed after canonical roster correction |
| Architecture boundaries | Passed |
| Isolation design | Passed |
| Data model | Passed at specification level |
| Embedding/reranking design | Passed; benchmark pending |
| API standards | Passed |
| Security/privacy | Passed at design level |
| Accessibility | Passed at requirement level |
| QA strategy | Passed |
| Capacity model | Passed as benchmark-driven plan |
| CI/CD | Passed at specification level |
| Operations | Passed at specification level |

### Execution axis

| Evidence | Result |
| ------------------------- | -------------- |
| Repository implementation | `NOT_EXECUTED` |
| Database migration run | `NOT_EXECUTED` |
| CI pipeline run | `NOT_EXECUTED` |
| AI benchmark | `NOT_EXECUTED` |
| Security test/pen test | `NOT_EXECUTED` |
| Accessibility audit | `NOT_EXECUTED` |
| Load/soak test | `NOT_EXECUTED` |
| Backup/restore drill | `NOT_EXECUTED` |
| Deletion verification | `NOT_EXECUTED` |
| Production deploy | `NOT_EXECUTED` |

## Final Statement

**Vaeloom MVP is now specified at an enterprise-quality implementation-planning
level, subject to the explicit stakeholder decisions and runtime evidence gates
in this document.**

**Production release remains blocked.**

The correct next action is repository implementation beginning with Stage 0 and
Stage 1—not another broad vision pass and not premature feature development.
