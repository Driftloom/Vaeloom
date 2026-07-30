# User Stories

> **Purpose:** Provide the consolidated user-story backlog organized by epic, with acceptance criteria and priority mapping
> **Status:** ðŸ†• New
> **Owner:** Product Team
> **Version:** 1.0
> **Last Updated:** 2026-07-16
> **Dependencies:** [`User-Personas.md`](./User-Personas.md), [`PRD.md`](./PRD.md), [`Functional-Requirements.md`](./Functional-Requirements.md), [`Feature-Specs/`](./Feature-Specs/)
> **Implementation Status:** ðŸ“‹ Spec Only

## Overview

User stories capture requirements from the user's perspective: "As a [persona], I want [action] so that [benefit]." This document consolidates all user stories into a single backlog organized by epic, each with acceptance criteria and priority. Individual feature specs (in [`Feature-Specs/`](./Feature-Specs/)) provide deeper detail; this document is the master index.

## Format

```text
As a [persona], I want [action] so that [benefit].
Acceptance Criteria:
  - [observable condition]
  - [observable condition]
Priority: P0 (MVP) | P1 (v1.5) | P2 (Enterprise)
```text

## Epic Dependency Map

```mermaid
graph TD
    classDef epic fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef found fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:2px

    ONBOARD["Onboarding"]:::found
    DOCS["Document Management"]:::found
    MEM["Memory & Knowledge Graph"]:::found
    RESUME["Resume Building"]:::epic
    ATS["ATS & Job Matching"]:::epic
    APPS["Application Tracking"]:::epic
    AGENT["Agent Interactions"]:::epic
    SCHED["Scheduling & Deadlines"]:::epic
    ADMIN["Enterprise Admin"]:::epic

    ONBOARD --> DOCS --> MEM
    MEM --> RESUME & ATS & AGENT
    RESUME & ATS --> APPS
    AGENT --> SCHED
    ONBOARD -.->|"enterprise"| ADMIN
```text

> **Diagram:** Epic dependencies. Onboarding, Documents, and Memory are foundational — other epics depend on them.

## Epic: Onboarding

| ID | Story | Priority |
|----|-------|----------|
| US-O01 | As a new user, I want to sign up with email/password so that I can start using Vaeloom. | P0 |
| US-O02 | As a new user, I want to sign up with Google so that I don't need a new password. | P0 |
| US-O03 | As a new user, I want a guided onboarding tour so that I understand what Vaeloom does. | P0 |
| US-O04 | As a new user, I want to upload my first document during onboarding so that I see value immediately. | P0 |
| US-O05 | As a returning user, I want to connect Gmail/GitHub during onboarding so that Vaeloom can ingest my data. | P1 |

## Epic: Document Management

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-D01 | As a user, I want to upload documents (PDF, DOCX) so that Vaeloom can read them. | Files appear in document list within 5s; processing status shown | P0 |
| US-D02 | As a user, I want to see all my documents in one list so that I can find them. | List paginated; sortable by date/name; searchable | P0 |
| US-D03 | As a user, I want Vaeloom to auto-organize my documents into categories. | Organization Agent suggests categories; user approves | P0 |
| US-D04 | As a user, I want to search document content so that I can find specific information. | Search returns results in <2s; highlights matches | P0 |
| US-D05 | As a user, I want to delete a document so that it's removed from my account. | Soft-delete; confirmation dialog; data removed within 30 days | P0 |
| US-D06 | As a user, I want to connect Gmail so that emails are auto-ingested. | OAuth flow; emails appear as documents; user can filter | P1 |

## Epic: Memory & Knowledge Graph

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-M01 | As a user, I want Vaeloom to remember facts about me so I don't have to repeat myself. | Facts extracted from documents; visible in memory view | P0 |
| US-M02 | As a user, I want to see what Vaeloom remembers about me. | Memory graph view; searchable; filterable by type | P0 |
| US-M03 | As a user, I want to correct a memory that's wrong. | Edit/delete any memory; change logged | P0 |
| US-M04 | As a user, I want Vaeloom to connect related memories. | Graph edges visible; related memories suggested | P0 |
| US-M05 | As a user, I want to delete all memories (privacy). | Bulk delete; confirmation; irreversible after 30 days | P0 |

## Epic: Resume Building

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-R01 | As a user, I want Vaeloom to extract achievements from my documents. | Achievements extracted in XYZ format; source cited | P0 |
| US-R02 | As a user, I want to maintain a master resume that updates automatically. | New achievements added to master; user approves | P0 |
| US-R03 | As a user, I want to generate a tailored resume for a specific job posting. | Job URL → tailored resume; ATS-optimized; <30s | P0 |
| US-R04 | As a user, I want to edit resume content manually. | Inline editing; changes saved; version history | P0 |
| US-R05 | As a user, I want to export my resume as PDF. | Download in <5s; ATS-readable format | P0 |

## Epic: ATS & Job Matching

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-A01 | As a user, I want Vaeloom to score my resume against a job posting. | ATS score 0-100; gap analysis; <10s | P0 |
| US-A02 | As a user, I want to see which keywords I'm missing. | Missing keywords listed; suggestions to add | P0 |
| US-A03 | As a user, I want Vaeloom to find jobs that match my profile. | Job recommendations ranked by fit; explanation provided | P0 |
| US-A04 | As a user, I want to save interesting jobs for later. | Saved jobs list; reminders for deadlines | P1 |

## Epic: Application Tracking

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-AP01 | As a user, I want to track applications I've submitted. | Application list; status tracking; company/role/date | P0 |
| US-AP02 | As a user, I want Vaeloom to draft a cover letter for an application. | Draft generated; user reviews and edits; no auto-send | P0 |
| US-AP03 | As a user, I want reminders for application follow-ups. | Reminder 7 days after submission if no response | P1 |

## Epic: Agent Interactions

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-AG01 | As a user, I want to chat with Vaeloom to ask questions about my data. | Chat interface; responses grounded in memory; citations | P0 |
| US-AG02 | As a user, I want to approve or reject agent-suggested actions. | Approval prompt before any consequential action | P0 |
| US-AG03 | As a user, I want to see what an agent did (transparency). | Agent run trace visible; tools called; memories written | P0 |
| US-AG04 | As a user, I want to cancel a running agent task. | Cancel button; task stops within 5s | P0 |

## Epic: Scheduling & Deadlines

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-S01 | As a user, I want Vaeloom to detect deadlines in my documents/emails. | Deadlines surfaced; source cited; user confirms | P0 |
| US-S02 | As a user, I want reminders before deadlines. | Configurable reminders (1 day, 3 days, 1 week before) | P0 |
| US-S03 | As a user, I want a calendar view of all deadlines. | Calendar UI; color-coded by type; filterable | P1 |

## Epic: Enterprise Administration

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-E01 | As a tenant admin, I want to provision users for my organization. | Bulk invite; role assignment; SSO mapping | P2 |
| US-E02 | As a tenant admin, I want to configure SSO. | SAML/OIDC metadata upload; test connection | P2 |
| US-E03 | As a tenant admin, I want to view audit logs. | Searchable; filterable; exportable | P2 |
| US-E04 | As a tenant admin, I want to manage billing and seats. | Seat count; invoices; plan changes | P2 |

## Priority Summary

| Priority | Count | Phase |
|----------|-------|-------|
| P0 (MVP) | 30 stories | MVP |
| P1 (v1.5) | 8 stories | v1.5 |
| P2 (Enterprise) | 4 stories | Enterprise |
| **Total** | **42 stories** | |

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | Every story has observable acceptance criteria | "Done" must be verifiable, not subjective |
| 2 | Stories are INVEST-compliant (Independent, Negotiable, Valuable, Estimable, Small, Testable) | Prevents bloated, untestable stories |
| 3 | Map every story to a persona | Prevents building features nobody asked for |

## Related Documents

- [`User-Personas.md`](./User-Personas.md) — personas referenced in stories
- [`PRD.md`](./PRD.md) — product requirements
- [`Functional-Requirements.md`](./Functional-Requirements.md) — functional requirements (system perspective)
- [`Feature-Specs/`](./Feature-Specs/) — detailed feature specs
