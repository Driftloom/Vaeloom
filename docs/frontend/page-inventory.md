# Vaeloom Master Page Inventory

**Last Updated**: September 24, 2026  
**Total Routes**: 60 Active App Router Routes  
**Status**: 100% Production Verified (Build Exit Code 0)

---

## 1. Authentication & Onboarding Routes

| Route              | Type          | Auth Required | State Handling                                     | Description                                                                    |
| ------------------ | ------------- | ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/login`           | Static        | No            | Loading, Error, Password Visibility, SSO Providers | Primary user authentication with email/password and OAuth (Google, Microsoft). |
| `/signup`          | Static        | No            | Loading, Error, Validation                         | Account registration with tenant invite detection.                             |
| `/forgot-password` | Static        | No            | Form submission, Success Alert                     | Password recovery trigger with rate-limited email dispatch.                    |
| `/reset-password`  | Static        | No            | Token validation, Error, Success                   | Secure password reset completion form.                                         |
| `/verify-email`    | Static        | No            | Token validation, Error, Retry                     | Email address verification flow.                                               |
| `/onboarding`      | Static        | Yes           | Multi-step wizard, Skip, Complete                  | First-run onboarding questionnaire (role, target comp, skills).                |
| `/callback`        | Static        | No            | Loading, Redirect, Error                           | OAuth authorization callback handler.                                          |
| `/auth/callback`   | Dynamic Route | No            | Token exchange, Redirect                           | OAuth API route handler for social identity providers.                         |
| `/account-locked`  | Static        | No            | Security Incident card, Recovery actions           | Security lockout resolution page with zero-trust defense explanations.         |
| `/session-expired` | Static        | No            | Auto-redirect countdown (5s), Re-login CTA         | Graceful session termination notification.                                     |

---

## 2. Public & System Routes

| Route             | Type          | Auth Required | State Handling                            | Description                                                            |
| ----------------- | ------------- | ------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `/`               | Static        | No            | 3D WebGL hero, Testimonials, CTA          | High-fidelity marketing landing page with interactive canvas.          |
| `/forbidden`      | Static        | No            | Error banner, Return CTA                  | HTTP 403 Forbidden handler with tenant privilege context.              |
| `/status`         | Static        | No            | System health, Uptime indicators          | Real-time platform status and service telemetry.                       |
| `/privacy`        | Static        | No            | Static markdown, TOC navigation           | Sovereign data privacy and GDPR compliance terms.                      |
| `/terms`          | Static        | No            | Static markdown, TOC navigation           | Enterprise service terms and SLA commitments.                          |
| `/robots.txt`     | Route Handler | No            | Dynamic crawl rules                       | Search engine indexing rules.                                          |
| `/sitemap.xml`    | Route Handler | No            | Dynamic XML generation                    | Search engine sitemap index.                                           |
| `/p/[userId]`     | Dynamic Route | No            | Loading, Profile view, Public credentials | Shareable public professional portfolio and verifiable achievements.   |
| `/invite/[token]` | Dynamic Route | No            | Token validation, Accept, Decline         | Organization and workspace collaboration invitation acceptance screen. |

---

## 3. Workspace Routes (`/workspace/[workspaceId]/*`)

### Assist & Core Intelligence

| Route                                       | Section | Integration Type   | States                            | Description                                                                    |
| ------------------------------------------- | ------- | ------------------ | --------------------------------- | ------------------------------------------------------------------------------ |
| `/workspace/[workspaceId]`                  | Assist  | Live Backend / SWR | Loading, Empty, Dashboard Cards   | Workspace dashboard with live metrics, quick actions, and recent activity.     |
| `/workspace/[workspaceId]/capabilities`     | Assist  | Live Backend       | Loading, Tabs, Dynamic Connectors | Unified agent capabilities, MCP servers, and tool registry.                    |
| `/workspace/[workspaceId]/chat`             | Assist  | Live Backend / SSE | Loading, Streaming, Composer      | Streaming AI assistant with multi-agent slash routing and XML context fencing. |
| `/workspace/[workspaceId]/agents`           | Assist  | Live Backend       | Loading, Empty, Config modal      | Registry of autonomous specialized agents with autonomy tiers.                 |
| `/workspace/[workspaceId]/agents/[agentId]` | Assist  | Live Backend       | Loading, Detail view, Logs        | Individual agent configuration, memory partition, and execution history.       |
| `/workspace/[workspaceId]/cognition`        | Assist  | Live Backend       | Loading, Reality Gap radar        | Dual-brain cognitive architecture telemetry (System 1 + System 2).             |
| `/workspace/[workspaceId]/council`          | Assist  | Live Backend       | Loading, Consensus voting         | Multi-agent deliberation and consensus chamber.                                |

### Memory & Knowledge Retrieval

| Route                                        | Section | Integration Type      | States                                | Description                                                                         |
| -------------------------------------------- | ------- | --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `/workspace/[workspaceId]/memory`            | Memory  | Live Backend          | Loading, Graph view, Search           | Visual knowledge graph and episodic memory claim browser.                           |
| `/workspace/[workspaceId]/memory/[memoryId]` | Memory  | Live Backend          | Loading, Entity inspector, Provenance | Deep-dive inspector for individual memory assertions with cryptographic provenance. |
| `/workspace/[workspaceId]/search`            | Memory  | Deterministic Preview | Loading, Empty, Faceted filtering     | Full-page enterprise search across documents, memories, jobs, and tasks.            |
| `/workspace/[workspaceId]/documents`         | Memory  | Route Alias           | Loading, Instant Redirect             | Clean redirect forwarder to canonical `/files` route.                               |

### Career Architecture & Job Discovery

| Route                                             | Section | Integration Type      | States                             | Description                                                                      |
| ------------------------------------------------- | ------- | --------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `/workspace/[workspaceId]/career`                 | Career  | Deterministic Preview | Loading, Tabs, Radar, Roadmap      | Strategic career progression dashboard, skills radar, and target comp bands.     |
| `/workspace/[workspaceId]/resume`                 | Career  | Live Backend          | Loading, Templates, Compilation    | Master ATS resume editor, Jinja2 template picker, and PDF/DOCX compiler.         |
| `/workspace/[workspaceId]/resume/[resumeId]/edit` | Career  | Live Backend          | Loading, Live Preview, Diff        | Granular section-by-section resume tailoring view.                               |
| `/workspace/[workspaceId]/resumes`                | Career  | Route Alias           | Loading, Instant Redirect          | Clean redirect forwarder to canonical `/resume` route.                           |
| `/workspace/[workspaceId]/jobs`                   | Career  | Live Backend          | Loading, Empty, Job Board, Match % | Tactical job discovery feed with ATS match scoring and company metadata.         |
| `/workspace/[workspaceId]/applications`           | Career  | Live Backend          | Loading, Kanban / Table, Stages    | End-to-end application lifecycle tracker (Applied, Screening, Interview, Offer). |

### Operations & Autonomous Execution

| Route                                         | Section    | Integration Type      | States                              | Description                                                                   |
| --------------------------------------------- | ---------- | --------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `/workspace/[workspaceId]/tasks`              | Operations | Deterministic Preview | Loading, Empty, DAG Subtasks        | Multi-agent autonomous workflow DAG execution center with step duration logs. |
| `/workspace/[workspaceId]/email`              | Operations | Deterministic Preview | Loading, Empty, Master-Detail, Sync | AI Recruiter Triage and entity memory extraction feed.                        |
| `/workspace/[workspaceId]/files`              | Operations | Live Backend          | Loading, Empty, Upload, Tree view   | Document management pipeline with MinIO live S3 and folder hierarchies.       |
| `/workspace/[workspaceId]/files/[documentId]` | Operations | Live Backend          | Loading, DiffViewer, Versions       | Document inspection view with historical diffing and sharing controls.        |
| `/workspace/[workspaceId]/history`            | Operations | Live Backend          | Loading, Empty, Filter, Export      | Immutable activity and audit log with SHA-256 integrity verification.         |
| `/workspace/[workspaceId]/schedule`           | Operations | Live Backend          | Loading, Calendar, Crons, Modals    | Recurring autonomous task scheduler and cron management.                      |
| `/workspace/[workspaceId]/approvals`          | Operations | Live Backend          | Loading, Empty, Approval Cards      | Human-in-the-loop (HITL) approval queue for high-impact agent proposals.      |
| `/workspace/[workspaceId]/connectors`         | Operations | Live Backend          | Loading, Connectors Grid, Health    | Third-party integrations (GitHub, Gmail, Slack, Composio MCP).                |
| `/workspace/[workspaceId]/connectors/dynamic` | Operations | Live Backend          | Loading, Dynamic Schema Builder     | Dynamic runtime MCP server connector creator.                                 |
| `/workspace/[workspaceId]/notifications`      | Operations | Live Backend          | Loading, Empty, Mark Read, Filter   | Real-time notifications and system alerts feed.                               |

### Trust, Rights & Workspace Settings

| Route                                        | Section        | Integration Type | States                             | Description                                                                     |
| -------------------------------------------- | -------------- | ---------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `/workspace/[workspaceId]/settings`          | Trust & Rights | Live Backend     | Loading, Tabs, Autonomy, Privacy   | Workspace configurations, autonomy policy matrix, and GDPR export/delete.       |
| `/workspace/[workspaceId]/settings/security` | Trust & Rights | Dedicated Page   | Loading, TOTP QR, Sessions, Codes  | Dedicated MFA / 2FA setup, recovery codes download, and session manager.        |
| `/workspace/[workspaceId]/vault`             | Trust & Rights | Live Backend     | Loading, Secrets List, BYOK        | Infisical-backed encrypted credential vault for provider API keys.              |
| `/workspace/[workspaceId]/profile`           | Trust & Rights | Live Backend     | Loading, Profile edit, Security    | Personal profile details, avatar upload, and password update.                   |
| `/workspace/[workspaceId]/billing`           | Trust & Rights | Live Backend     | Loading, Plan cards, Stripe Portal | Subscription tiers, compute usage quotas, and invoice management.               |
| `/workspace/[workspaceId]/help`              | Trust & Rights | Knowledge Base   | Loading, Search, Shortcuts Table   | Architectural documentation, agent handbook, and keyboard shortcuts cheatsheet. |

### Enterprise Gated Routes (`NEXT_PUBLIC_ENABLE_ENTERPRISE=true`)

| Route                                         | Section    | Integration Type | States                             | Description                                                                  |
| --------------------------------------------- | ---------- | ---------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `/workspace/[workspaceId]/admin`              | Enterprise | Live Backend     | Loading, Audit Table, Governance   | Global tenant administration, audit log exports, and compliance controls.    |
| `/workspace/[workspaceId]/organizations`      | Enterprise | Live Backend     | Loading, Org switcher, Member list | Multi-tenant organization hierarchies, seat quotas, and domain verification. |
| `/workspace/[workspaceId]/marketplace`        | Enterprise | Live Backend     | Loading, Plugin grid, Install CTA  | Verified agent templates, plugins, and pre-built workflows.                  |
| `/workspace/[workspaceId]/developer`          | Enterprise | Live Backend     | Loading, API keys, Usage charts    | Developer portal with API token generation and rate limit telemetry.         |
| `/workspace/[workspaceId]/developer/webhooks` | Enterprise | Live Backend     | Loading, Endpoint list, Ping test  | Outbound webhook subscriptions and event delivery logs.                      |
| `/workspace/[workspaceId]/feature-flags`      | Enterprise | Live Backend     | Loading, Flags toggle, Rollout %   | Dynamic feature flag configuration and canary rollout controls.              |
