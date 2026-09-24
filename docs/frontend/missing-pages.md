# Vaeloom Specification: Newly Implemented Product Routes & Aliases

**Date**: September 24, 2026  
**Status**: 100% Production Implemented & Verified

---

## 1. Newly Added Routes Overview

During the forensic audit and zero-trust implementation cycle, 10 missing or
aliased routes were constructed to complete the enterprise frontend application
tree:

1. `/workspace/[workspaceId]/career/page.tsx`
2. `/workspace/[workspaceId]/search/page.tsx`
3. `/workspace/[workspaceId]/tasks/page.tsx`
4. `/workspace/[workspaceId]/email/page.tsx`
5. `/workspace/[workspaceId]/help/page.tsx`
6. `/workspace/[workspaceId]/settings/security/page.tsx`
7. `/workspace/[workspaceId]/documents/page.tsx` (Alias redirect to `/files`)
8. `/workspace/[workspaceId]/resumes/page.tsx` (Alias redirect to `/resume`)
9. `/account-locked/page.tsx` (Authentication & Security Recovery)
10. `/invite/[token]/page.tsx` (Collaboration Invitation Acceptance)

---

## 2. Route Specifications & State Contracts

### 2.1 Strategic Career Hub (`/workspace/[workspaceId]/career`)

- **Purpose**: Bridge the gap between tactical job searches and long-term career
  progression benchmarks.
- **Components**: `StatCard`, `Tabs`, `TabPanel`, `Card`, `Badge`, `Button`.
- **States**:
  - `Loading`: Displays dedicated `CareerLoading` with radar calibration
    message.
  - `Empty`: Graceful fallback if no target role is configured.
  - `Error`: `CareerError` boundary with error-tracking telemetry and retry
    button.
- **Fixture Source**: `@/lib/fixtures/career.ts` (`DEMO_CAREER_STRATEGY`).
- **Demo Indicator**: Marked with `[DEMO PREVIEW]` badge.

### 2.2 Unified Enterprise Search (`/workspace/[workspaceId]/search`)

- **Purpose**: Full-page faceted global search across all workspace partitions
  (memories, files, resumes, jobs, DAG tasks, and graph entities).
- **Components**: `Input`, `Select`, `Card`, `Badge`, `EmptyState`.
- **States**:
  - Instant client-side search filtering across query strings and tags.
  - Category partition filters (`All`, `Documents`, `Memories`, `Resumes`,
    `Jobs`, `Tasks`, `Entities`).
  - Sort options (`Relevance Score`, `Date`, `Title`).
  - `EmptyState`: Renders clear search filters CTA when query returns 0 matches.
- **Fixture Source**: `@/lib/fixtures/search.ts` (`DEMO_SEARCH_RESULTS`).
- **Demo Indicator**: Marked with `[DEMO INDEX]` badge and 14ms traversal
  telemetry.

### 2.3 Autonomous Tasks & Workflow DAGs (`/workspace/[workspaceId]/tasks`)

- **Purpose**: Telemetry and execution inspection center for multi-agent
  background workflows.
- **Components**: `StatCard`, `Card`, `Badge`, `Button`, `EmptyState`.
- **States**:
  - Status filters (`ALL`, `RUNNING`, `PENDING_APPROVAL`, `COMPLETED`,
    `FAILED`).
  - Expandable linear execution DAGs showing subtasks, durations, assigned
    agents, and step output summaries.
  - Direct deep link to `/approvals` for tasks gated on human-in-the-loop
    decisions.
- **Fixture Source**: `@/lib/fixtures/tasks.ts` (`DEMO_AUTONOMOUS_TASKS`).

### 2.4 Email Intelligence & Recruiter Triage (`/workspace/[workspaceId]/email`)

- **Purpose**: Gmail/Outlook recruiter correspondence inbox with AI extraction
  of interview stages, deadlines, and memory assertions.
- **Components**: `Card`, `Badge`, `Button`, `EmptyState`.
- **Layout**: 2-Column Master/Detail layout (threads list on left, selected
  email & AI extraction box on right).
- **States**:
  - Category filters (`ALL`, `INTERVIEW_INVITE`, `STATUS_UPDATE`, `RECRUITER`,
    `GENERAL`).
  - Unread indicators and sync connection status pill
    (`Google Workspace / Gmail: HEALTHY`).
  - Direct action: "Draft AI Response" linking to `/chat`.
- **Fixture Source**: `@/lib/fixtures/email.ts` (`DEMO_EMAIL_THREADS`,
  `DEMO_EMAIL_SYNC_STATUS`).

### 2.5 Help Center & Shortcuts Cheatsheet (`/workspace/[workspaceId]/help`)

- **Purpose**: Self-service enterprise architectural documentation, agent
  governance manuals, and keyboard shortcuts directory.
- **Components**: `Card`, `Input`, `Badge`, `Button`.
- **Features**:
  - Keyboard shortcuts table covering global, approvals, and chat hotkeys.
  - Expandable architectural guide accordion by category (`Getting Started`,
    `Agents & Autonomy`, `Connectors`, `Security & Privacy`).
  - Search filter across guides and shortcuts.
- **Fixture Source**: `@/lib/fixtures/help.ts` (`DEMO_SHORTCUTS`,
  `DEMO_HELP_ARTICLES`).

### 2.6 Security Settings & MFA (`/workspace/[workspaceId]/settings/security`)

- **Purpose**: Dedicated user security posture management.
- **Components**: `Card`, `Input`, `Badge`, `Button`.
- **Features**:
  - TOTP two-factor authentication setup with secret key copy and 6-digit test
    token verification.
  - Downloadable emergency backup recovery codes bundle (`.txt`).
  - Active user session table with IP, device, and "Revoke All Other Sessions"
    action.
  - Inactivity session timeout selector (15m, 1h, 8h, 24h).

### 2.7 Canonical Route Forwarders (`/documents` & `/resumes`)

- `/workspace/[workspaceId]/documents/page.tsx` forwards seamlessly to
  `/workspace/[workspaceId]/files`.
- `/workspace/[workspaceId]/resumes/page.tsx` forwards seamlessly to
  `/workspace/[workspaceId]/resume`.
- Eliminates 404 dead ends caused by plural vs singular naming discrepancies.

### 2.8 Auth & Security Edge Pages

- `/account-locked/page.tsx`: Presents transparent zero-trust defense
  explanations, incident reference codes (`SEC-LOCK-2026-9411`), and password
  reset / unlock actions.
- `/invite/[token]/page.tsx`: Displays target organization, assigned RBAC role,
  and RLS tenant isolation guarantees, allowing the recipient to accept or
  decline the invite.
