# Functional Requirements

> **Purpose:** Define the functional requirements for Vaeloom organized by module â€” what the system must do, with priority and acceptance criteria
> **Status:** ðŸ†• New
> **Owner:** Product Team
> **Version:** 1.0
> **Last Updated:** 2026-07-16
> **Dependencies:** [`PRD.md`](./PRD.md), [`User-Stories.md`](./User-Stories.md), [`Non-Functional-Requirements.md`](./Non-Functional-Requirements.md)
> **Implementation Status:** ðŸ“‹ Spec Only

## Overview

Functional requirements define what the Vaeloom system must *do* â€” the behaviors, features, and capabilities it must provide. This document organizes requirements by module, each with a unique ID, priority, and acceptance criteria. It is the system-perspective complement to the user-perspective [`User-Stories.md`](./User-Stories.md).

## Goals

- Define all functional requirements organized by module
- Assign priority (P0/P1/P2) to each requirement
- Provide acceptance criteria for verification
- Enable traceability to user stories and feature specs

## Format

```text
FR-XXX | Requirement description | Priority (P0/P1/P2) | Acceptance criteria
```text

## Requirements Traceability

```mermaid
graph LR
    classDef input fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef req fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef output fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px

    US["User Stories"]:::input --> FR["Functional Requirements"]:::req
    BR["Business Requirements"]:::input --> FR
    FR --> FS["Feature Specs"]:::output
    FR --> TEST["Test Cases"]:::output
```text

> **Diagram:** Requirements traceability. User stories and business requirements inform functional requirements, which drive feature specs and test cases.

## Authentication & Authorization

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-AUTH-001 | Users must authenticate via email/password or OAuth (Google) | P0 | Login succeeds; JWT issued; session persisted |
| FR-AUTH-002 | System must enforce role-based access control (RBAC) | P0 | Unauthorized actions return 403 |
| FR-AUTH-003 | System must support multi-factor authentication (MFA) | P1 | TOTP-based MFA; recovery codes |
| FR-AUTH-004 | System must support SSO (SAML/OIDC) for enterprise | P2 | IdP integration; JIT provisioning |
| FR-AUTH-005 | Sessions must expire after configurable timeout | P0 | Idle timeout 30 min; absolute 24h |

## Document Management

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-DOC-001 | Users must be able to upload documents (PDF, DOCX, TXT, code files) | P0 | File stored; processing initiated; metadata recorded |
| FR-DOC-002 | System must parse documents and extract text content | P0 | Text extracted within 60s for <10MB files |
| FR-DOC-003 | System must detect and classify document type | P0 | Type classified (resume, transcript, project, etc.) |
| FR-DOC-004 | System must detect PII in documents | P0 | PII fields flagged; not exposed in search snippets |
| FR-DOC-005 | Users must be able to search document content | P0 | Full-text search returns results in <2s |
| FR-DOC-006 | Users must be able to soft-delete documents | P0 | Marked deleted; purged after 30 days |
| FR-DOC-007 | System must chunk documents for embedding | P0 | Semantic chunking; chunk size 500-1000 tokens |

## Memory System

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-MEM-001 | System must extract entities from documents into a knowledge graph | P0 | Entities (skills, companies, achievements) extracted with confidence |
| FR-MEM-002 | System must generate vector embeddings for all content | P0 | Embeddings stored in pgvector; 1536 dimensions |
| FR-MEM-003 | System must link related entities in the knowledge graph | P0 | Edges created (has_skill, worked_at, achieved) |
| FR-MEM-004 | Users must be able to view their memory graph | P0 | Graph visualization; searchable; filterable |
| FR-MEM-005 | Users must be able to edit or delete any memory | P0 | Edit/delete logged; changes propagate |
| FR-MEM-006 | System must rank memories by relevance and importance | P0 | Ranking combines recency, confidence, importance |

## Agent System

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-AGT-001 | System must provide 8 specialist agents (MVP) | P0 | All 8 agents functional; routed by Orchestrator |
| FR-AGT-002 | Agents must operate in suggest-mode by default | P0 | No consequential action without user approval |
| FR-AGT-003 | Agents must read from and write to the memory system | P0 | Memory reads ground responses; writes logged |
| FR-AGT-004 | Agents must follow the shared agentic loop (Planâ†’Actâ†’Observeâ†’Reflect) | P0 | Loop steps visible in trace |
| FR-AGT-005 | System must route requests to the correct agent via Orchestrator | P0 | Routing accuracy >95% on golden dataset |
| FR-AGT-006 | Agents must have a fallback behavior ("ask, never guess") | P0 | Ambiguous requests trigger clarification |
| FR-AGT-007 | System must run all agent outputs through a QA gate | P0 | Guardrail checks; blocked outputs flagged |

## Resume & ATS

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-RES-001 | System must extract achievements from documents in XYZ format | P0 | Achievements extracted; source cited |
| FR-RES-002 | System must maintain a master resume | P0 | Single source of truth; updates with new achievements |
| FR-RES-003 | System must generate tailored resumes for job postings | P0 | Job URL â†’ tailored resume in <30s |
| FR-RES-004 | System must score resumes against job postings (ATS) | P0 | Score 0-100; gap analysis |
| FR-RES-005 | System must identify missing keywords for ATS optimization | P0 | Missing keywords listed with suggestions |

## Job Search & Applications

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-JOB-001 | System must search and surface job opportunities | P0 | Jobs ranked by fit; explanation provided |
| FR-JOB-002 | System must score job-user fit | P0 | Fit score with reasoning |
| FR-JOB-003 | System must track application status | P0 | Status tracking (applied, interviewing, offer, rejected) |
| FR-JOB-004 | System must draft cover letters | P0 | Draft generated; user reviews; no auto-send |

## Scheduler & Notifications

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-SCH-001 | System must detect deadlines from documents and emails | P0 | Deadlines surfaced; source cited |
| FR-SCH-002 | System must send configurable deadline reminders | P0 | Reminders at 1d/3d/1week before |
| FR-NOT-001 | System must send in-app notifications | P0 | Notifications appear in <5s of event |
| FR-NOT-002 | System must send email notifications (opt-in) | P1 | Email sent within 5 min of event |

## Connectors

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-CON-001 | System must support Gmail connector (OAuth) | P0 | Emails ingested; user can filter |
| FR-CON-002 | System must support GitHub connector (OAuth) | P0 | Repos and commits ingested |
| FR-CON-003 | System must support Google Drive connector (OAuth) | P1 | Drive files ingested |
| FR-CON-004 | System must sync connectors periodically | P0 | Sync every 15 min; delta sync |

## Enterprise Administration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-ENT-001 | System must support multi-tenant isolation | P2 | RLS enforced; no cross-tenant data access |
| FR-ENT-002 | System must provide an admin portal | P2 | Tenant/org/user management screens |
| FR-ENT-003 | System must support seat-based licensing | P2 | Seat count enforced; overage blocked |
| FR-ENT-004 | System must provide audit logging | P2 | Immutable audit events; 7-year retention |

## Priority Summary

| Priority | Count | Phase |
|----------|-------|-------|
| P0 (MVP) | 38 requirements | MVP |
| P1 (v1.5) | 6 requirements | v1.5 |
| P2 (Enterprise) | 7 requirements | Enterprise |
| **Total** | **51 requirements** | |

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | Every requirement has a unique ID and testable acceptance criteria | Enables verification and traceability |
| 2 | Requirements are prioritized (P0/P1/P2) | Guides sequencing and scope decisions |
| 3 | Every requirement traces to a user story and a test case | Closes the requirementsâ†’implementationâ†’verification loop |

## Related Documents

- [`PRD.md`](./PRD.md) â€” product requirements (higher level)
- [`User-Stories.md`](./User-Stories.md) â€” user-perspective stories
- [`Non-Functional-Requirements.md`](./Non-Functional-Requirements.md) â€” quality attributes
- [`Business-Requirements.md`](./Business-Requirements.md) â€” business objectives
- [`Feature-Specs/`](./Feature-Specs/) â€” detailed feature specifications
