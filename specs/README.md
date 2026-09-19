# Vaeloom System Specifications (`specs/`)

> **Role:** **Authoritative, normative, implementation-facing requirements, contracts, and system invariants.**  
> **Rule:** Every document in this directory represents a binding engineering contract. Changes to files in this directory require architectural approval and formal review.

## Specification Domains

| Domain | Directory | Scope & Governing Authority | Key Artifacts |
| :--- | :--- | :--- | :--- |
| **Phase Engineering Contracts** | [`phase-contracts/`](./phase-contracts/) | 66 standalone phase prompts (Track 1 MVP, Track 2 CONT, Track 3 ENT), standards overlay, and 12-category gate rubrics | [`00-master-index.md`](./phase-contracts/00-master-index.md), [`EXECUTION-STATUS.md`](./phase-contracts/EXECUTION-STATUS.md), [`SHA256SUMS.md`](./phase-contracts/SHA256SUMS.md) |
| **HTTP & API Contracts** | [`api/`](./api/) | Single machine-readable source of truth (162 paths / 203 ops) + REST standards | [`openapi.yaml`](./api/openapi.yaml), [`API-Reference.md`](./api/API-Reference.md), [`REST-Standards.md`](./api/REST-Standards.md) |
| **Product & Feature Requirements** | [`product/`](./product/) | PRD, functional/non-functional requirements, and 13 feature specifications | [`PRD.md`](./product/PRD.md), [`features/`](./product/features/), [`Functional-Requirements.md`](./product/Functional-Requirements.md) |
| **Architecture & Structure** | [`architecture/`](./architecture/) | C4 model contracts, low-level component designs, event catalog, and service contracts | [`C4-Architecture.md`](./architecture/C4-Architecture.md), [`Low-Level-Design.md`](./architecture/Low-Level-Design.md), [`Event-Architecture.md`](./architecture/Event-Architecture.md) |
| **Database & Schema Invariants** | [`database/`](./database/) | 67 database tables, column types, constraints, and vector index parameters | [`Schema.md`](./database/Schema.md), [`Data-Dictionary.md`](./database/Data-Dictionary.md), [`Indexes.md`](./database/Indexes.md), [`ER-Diagram.md`](./database/ER-Diagram.md) |
| **AI Agents, Prompts, & Safety** | [`ai/`](./ai/) | Canonical 28-agent roster, tool calling schemas, prompt standards, and guardrails | [`REGISTRY_INDEX.md`](./ai/REGISTRY_INDEX.md), [`Tool-Calling.md`](./ai/Tool-Calling.md), [`Guardrails.md`](./ai/Guardrails.md), [`prompts/`](./ai/prompts/) |
| **Security & Privacy Policies** | [`security/`](./security/) | Identity & access control, encryption mandates, threat model, and data retention schedules | [`IAM.md`](./security/IAM.md), [`Encryption.md`](./security/Encryption.md), [`Threat-Model.md`](./security/Threat-Model.md), [`Data-Retention-Policy.md`](./security/Data-Retention-Policy.md) |
| **Durable Execution & Queues** | [`temporal/`](./temporal/) | 8 Temporal task queues, 6 workflows, activity retries, and idempotency rules | [`catalog.md`](./temporal/catalog.md), [`idempotency.md`](./temporal/idempotency.md) |
| **Frontend Design System** | [`frontend/`](./frontend/) | Design tokens, component prop contracts, forms validation, and accessibility invariants | [`Design-System.md`](./frontend/Design-System.md), [`Component-Library.md`](./frontend/Component-Library.md), [`Accessibility.md`](./frontend/Accessibility.md) |
| **Quality & SLA Standards** | [`quality/`](./quality/) | Test pyramid budget (75/20/5), test matrix (R01..R08), coverage floors, SLA/SLO/SLI contracts | [`Testing-Strategy.md`](./quality/Testing-Strategy.md), [`Test-Matrix.md`](./quality/Test-Matrix.md), [`Coverage.md`](./quality/Coverage.md), [`SLA.md`](./quality/SLA.md) |
| **Enterprise Subsystems** | [`enterprise/`](./enterprise/) | Admin portal, billing, licensing, organizations, and marketplace schemas | [`Admin-Portal.md`](./enterprise/Admin-Portal.md), [`Billing.md`](./enterprise/Billing.md), [`Multi-Tenancy.md`](./enterprise/Multi-Tenancy.md) |
| **Engineering Implementation** | [`engineering/`](./engineering/) | 19 implementation build orders and technical delivery blueprints | [`implementation/`](./engineering/implementation/) |
