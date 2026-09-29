# DEL-ENT-P18-04 — Internal Knowledge Transfer & Developer Onboarding Package

**Deliverable ID:** DEL-ENT-P18-04  
**Phase:** ENT-P18 — Documentation and Knowledge Transfer  
**Version:** 1.0.0  
**Owner:** Technical Writer + Lead Architect  
**Reviewer:** CTO + Engineering Managers  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:**
`evidence/phases/ent/ent-p18/04-knowledge-transfer-package.md`

---

## 1. 28-Agent Roster Governance Blueprint

The Vaeloom agent fleet consists of 28 strictly governed agent roles categorized
into 4 operational tiers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     28-AGENT ROSTER ARCHITECTURE                        │
│                                                                         │
│  TIER 1: Discovery & Research (Read-Only, Unapproved Execution)         │
│    • JobSearchAgent, MarketIntelligenceAgent, CompanyResearchAgent,     │
│      SkillGapAgent, TrendAnalysisAgent, BenchmarkAgent, ProfileScout    │
│                                                                         │
│  TIER 2: Document Synthesis & Strategy (Grounded Creation)              │
│    • ResumeTailoringAgent, CoverLetterAgent, PortfolioCuratorAgent,     │
│      InterviewPrepAgent, SalaryStrategyAgent, NetworkingOutreachAgent   │
│                                                                         │
│  TIER 3: Coordination & Orchestration (State-Graph Supervisors)         │
│    • WorkflowOrchestrator, CandidateAdvisor, ApplicationTracker,        │
│      CareerPathingAgent, OpportunityScoringAgent, FeedbackLoopAgent     │
│                                                                         │
│  TIER 4: Consequential Action Agents (MANDATORY HITL APPROVAL GATE)     │
│    • ApplicationSubmissionAgent, RecruiterDirectAgent,                 │
│      AccountDeletionAgent, DataExportAgent, CredentialLinkAgent,         │
│      ConsentRevocationAgent, EnterpriseBillingAgent, SAMLAdminAgent     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 22-Memory Type Taxonomy & Sovereignty Model

Every memory record in Vaeloom is typed, workspace-scoped, cryptographic-erasure
protected, and owned by the candidate:

1. `core_profile` (demographics, contact)
2. `work_experience` (roles, achievements, metrics)
3. `education_history` (degrees, certifications, coursework)
4. `hard_skills` (technologies, programming languages)
5. `soft_skills` (leadership, communication)
6. `project_portfolio` (repositories, case studies)
7. `job_preferences` (salary floor, remote policy, titles)
8. `search_query_history` (past job searches, filters)
9. `job_match_cache` (scored opportunities)
10. `application_history` (submission logs, status)
11. `resume_version` (tailored variants, template IDs)
12. `cover_letter_history` (custom outreach drafts)
13. `interview_notes` (q&a transcripts, practice feedback)
14. `salary_negotiation_profile` (counteroffer logs)
15. `network_connection` (referrals, recruiters)
16. `user_instruction_preference` (agent tone, guidelines)
17. `feedback_history` (human edits to agent text)
18. `consent_grant_log` (institutional sharing permits)
19. `audit_trail_entry` (cryptographic action logs)
20. `credential_metadata` (encrypted connector links)
21. `career_milestone_plan` (long-term target goals)
22. `agent_scratchpad_memory` (ephemeral ReAct state)

---

## 3. Developer Onboarding (< 30 Minutes Setup)

```bash
# 1. Clone repository and install toolchains
git clone https://github.com/vaeloom/vaeloom.git && cd vaeloom
pnpm install

# 2. Set up Python backend environment
cd apps/api
uv sync
uv run python -m playwright install chromium

# 3. Initialize local PostgreSQL and MinIO via Docker
docker-compose -f infra/docker-compose.local.yml up -d

# 4. Run database migrations to HEAD (0061)
uv run alembic upgrade head

# 5. Start dev environments
# Terminal 1: API (instant start)
pnpm dev:be
# Terminal 2: Web (2-5s startup)
pnpm dev:web
```

---

_Deliverable DEL-ENT-P18-04 v1.0.0 — Technical Writer — 2026-09-29_
