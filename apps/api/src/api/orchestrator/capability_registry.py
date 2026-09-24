"""Capability Registry — The Authoritative Catalog of Agent Capabilities.

Provides reverse-DNS capability manifests, semantic descriptions, exemplars,
and least-privilege tool bounds for all 29 specialist agents.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from .contracts.capability import (
    AgentCapabilityManifest,
    AutonomyLevel,
    RiskClass,
    ToolCapabilityManifest,
)

logger = logging.getLogger(__name__)


# ── Canonical Agent Capability Manifests (All 29 Specialist Agents) ─────────

CANONICAL_CAPABILITIES: list[AgentCapabilityManifest] = [
    # 1. Conversation & Scaffolding
    AgentCapabilityManifest(
        capability_id="executive.companion.scaffold",
        agent_id="conversation",
        display_name="Executive Career Advisor & Cognitive Scaffolding",
        description="Empathetic containment, active listening for burnout, exhaustion, and despair, executive goal clarification, cognitive load reduction, and consultative guidance.",
        semantic_exemplars=[
            "hello",
            "hi vaeloom",
            "good morning",
            "i feel overwhelmed with my job search",
            "i'm stressed and don't know where to start",
            "i feel completely overwhelmed by the job hunt and don't know where to start",
            "i just got rejected after 6 rounds of interviews and feel exhausted",
            "i'm burned out from coding assessments and need a moment to breathe",
            "everything feels hopeless with this tech job market right now",
            "can you help me figure out my next career move?",
            "thanks for your help",
        ],
        required_tools=[],
        optional_tools=["search_documents", "query_graph", "web_search"],
        supported_memory_scopes=["profile", "preferences", "recent_activity"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="mvp",
    ),
    # 2. Resume Engineering
    AgentCapabilityManifest(
        capability_id="career.resume.tailor",
        agent_id="resume",
        display_name="Master Resume Engineering & Tailoring",
        description="Tailor, compile, and optimize resumes against job descriptions. Ground every claim in verified documents; never fabricate credentials.",
        semantic_exemplars=[
            "tailor my resume for google senior backend role",
            "update my resume with distributed systems experience",
            "compile my resume to pdf",
            "download my tailored cv in docx",
            "reformat my resume work history",
            "rewrite my summary section to sound more executive and leadership focused",
            "improve the bullet points on my cv",
            "create a new resume from my profile",
        ],
        required_tools=["search_documents"],
        optional_tools=[
            "query_graph",
            "calculate_semantic_ats_score",
            "audit_ats_formatting",
            "compile_resume_pdf",
            "compile_resume_docx",
        ],
        supported_memory_scopes=["career", "skills", "experience", "education"],
        required_context=["resume_id"],
        risk_class=RiskClass.MEDIUM,
        default_autonomy=AutonomyLevel.DRAFT,
        requires_approval_above=AutonomyLevel.DRAFT,
        tier_requirement="mvp",
    ),
    # 3. Semantic ATS Audit
    AgentCapabilityManifest(
        capability_id="career.resume.ats_audit",
        agent_id="ats",
        display_name="Semantic ATS Match & Keyword Audit",
        description="Audit resume formatting, extract missing hard skills, and calculate semantic similarity score against job descriptions.",
        semantic_exemplars=[
            "run ats audit on my resume",
            "what skills am i missing for this job?",
            "check my resume score against this description",
            "audit ats formatting for machine readability",
            "compare resume a vs resume b",
        ],
        required_tools=["calculate_semantic_ats_score"],
        optional_tools=["extract_missing_hard_skills", "audit_ats_formatting", "search_documents"],
        supported_memory_scopes=["skills", "experience"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="mvp",
    ),
    # 4. Job Search & Discovery
    AgentCapabilityManifest(
        capability_id="career.job.search",
        agent_id="job_search",
        display_name="Autonomous Job Discovery & Matching",
        description="Search job boards, greenhouse, lever, and company pages. Match roles against candidate skills and calculate grounded fit scores.",
        semantic_exemplars=[
            "find remote staff python roles",
            "search for engineering manager positions in new york",
            "show me jobs matching my profile",
            "discover machine learning roles in healthcare",
            "are there any remote golang tech lead openings posted this week?",
            "look up recent openings for senior ai research engineers",
            "what companies are currently hiring distributed systems architects?",
            "find startup founding engineer positions in seattle",
        ],
        required_tools=["search_jobs"],
        optional_tools=[
            "search_greenhouse_jobs",
            "search_lever_jobs",
            "search_jobs_board",
            "browse_job_page",
            "verify_application_link",
            "scrape_company_insights",
            "search_documents",
        ],
        supported_memory_scopes=["preference", "location", "skills"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="mvp",
    ),
    # 5. Application Preparation
    AgentCapabilityManifest(
        capability_id="career.application.draft",
        agent_id="application",
        display_name="Application Package & Cover Letter Drafting",
        description="Draft tailored cover letters, assemble submission packages, and track pending job applications. Submissions require explicit human approval.",
        semantic_exemplars=[
            "prepare application for stripe backend engineer",
            "write cover letter for medtech role",
            "draft job application package",
            "track my pending job applications and their current status",
        ],
        required_tools=["search_documents"],
        optional_tools=["browse_job_page", "compile_resume_pdf", "draft_email"],
        supported_memory_scopes=["career", "profile", "job_history"],
        risk_class=RiskClass.HIGH,
        default_autonomy=AutonomyLevel.DRAFT,
        requires_approval_above=AutonomyLevel.DRAFT,
        tier_requirement="mvp",
    ),
    # 6. Document Organization
    AgentCapabilityManifest(
        capability_id="workspace.doc.organize",
        agent_id="organization",
        display_name="Workspace Document Organization & Taxonomy",
        description="Categorize, deduplicate, and organize files and folders. Moving or renaming files is approval-gated.",
        semantic_exemplars=[
            "organize my files",
            "clean up my messy downloads",
            "sort these career documents into folders",
            "categorize my pdfs",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph", "categorize_document"],
        supported_memory_scopes=["document", "folder"],
        risk_class=RiskClass.HIGH,
        default_autonomy=AutonomyLevel.SUGGEST,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="mvp",
    ),
    # 7. Long-Term Memory
    AgentCapabilityManifest(
        capability_id="workspace.memory.index",
        agent_id="memory",
        display_name="Knowledge Graph & Entity Memory Consolidation",
        description="Extract facts, verify claims, link entity relations, and consolidate trajectories into long-term career memory.",
        semantic_exemplars=[
            "remember that i got promoted to principal engineer",
            "what companies have i worked at?",
            "update my skills list with rust and go",
            "check what you know about my career history",
        ],
        required_tools=["search_documents", "query_graph"],
        optional_tools=["get_entity", "create_entity", "merge_entities"],
        supported_memory_scopes=["career", "skills", "experience", "entities"],
        risk_class=RiskClass.MEDIUM,
        default_autonomy=AutonomyLevel.WRITE,
        requires_approval_above=AutonomyLevel.WRITE,
        tier_requirement="mvp",
    ),
    # 8. Gmail Communication
    AgentCapabilityManifest(
        capability_id="communication.email.draft",
        agent_id="gmail",
        display_name="Email Search, Triage & Drafting",
        description="Search job applications, interview invitations, and draft professional replies. Outbound sends require approval.",
        semantic_exemplars=[
            "check my email for interview invitations",
            "draft reply to the recruiter from amazon",
            "search gmail for rejection emails",
        ],
        required_tools=["search_gmail"],
        optional_tools=["draft_email", "search_outlook_mail", "draft_outlook_mail", "search_documents"],
        supported_memory_scopes=["communication", "contacts"],
        risk_class=RiskClass.HIGH,
        default_autonomy=AutonomyLevel.DRAFT,
        requires_approval_above=AutonomyLevel.DRAFT,
        tier_requirement="mvp",
    ),
    # 9. Calendar Scheduling
    AgentCapabilityManifest(
        capability_id="workspace.calendar.plan",
        agent_id="calendar",
        display_name="Interview & Milestone Calendar Planning",
        description="Schedule interview preparation, block focus time, and manage calendar events with conflict checking.",
        semantic_exemplars=[
            "schedule mock interview for tomorrow at 3pm",
            "schedule my mock interview session for tomorrow at 3pm",
            "check my calendar for interview conflicts",
            "block two hours for leetcode prep on thursday",
            "schedule an event on my calendar",
        ],
        required_tools=["list_calendar_events"],
        optional_tools=["create_calendar_event", "list_outlook_calendar_events", "create_outlook_calendar_event"],
        supported_memory_scopes=["calendar", "timeline"],
        risk_class=RiskClass.MEDIUM,
        default_autonomy=AutonomyLevel.SUGGEST,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="mvp",
    ),
    # 10. Document Inspection
    AgentCapabilityManifest(
        capability_id="workspace.doc.analyze",
        agent_id="document",
        display_name="Deep Document Inspection & Synthesis",
        description="Inspect document text, summarize contracts, extract key clauses, and cross-reference citations.",
        semantic_exemplars=[
            "summarize this document",
            "extract key points from the offer letter",
            "what does paragraph 4 say?",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph"],
        supported_memory_scopes=["document"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="mvp",
    ),
    # 11. PDF Engineering
    AgentCapabilityManifest(
        capability_id="workspace.pdf.extract",
        agent_id="pdf",
        display_name="PDF Parsing, Extraction & OCR",
        description="Extract raw text, tables, and metadata from PDF files using zero-trust sandboxed parsers.",
        semantic_exemplars=[
            "parse this pdf resume",
            "extract text from my portfolio.pdf",
            "inspect pdf metadata",
        ],
        required_tools=["search_documents"],
        optional_tools=[],
        supported_memory_scopes=["document"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="mvp",
    ),
    # 12. Cloud Storage Integration
    AgentCapabilityManifest(
        capability_id="integration.cloud_storage.search",
        agent_id="drive",
        display_name="Google Drive & OneDrive Cloud Search",
        description="Search, index, and retrieve files from Google Drive and Microsoft OneDrive.",
        semantic_exemplars=[
            "search google drive for my old resumes",
            "download my portfolio from onedrive",
            "sync drive folder with vaeloom",
        ],
        required_tools=["search_drive"],
        optional_tools=["list_drive_files", "download_drive_file", "search_onedrive", "list_onedrive_files"],
        supported_memory_scopes=["document", "cloud_storage"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="mvp",
    ),
    # 13. Learning & Upskilling
    AgentCapabilityManifest(
        capability_id="career.learning.roadmap",
        agent_id="learning",
        display_name="Curriculum & Upskilling Roadmap Engine",
        description="Generate tailored learning curricula, recommend technical courses, and track skill acquisition.",
        semantic_exemplars=[
            "i want to learn rust for systems programming",
            "recommend courses for system design",
            "build a 3-month upskilling plan for kubernetes",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph", "web_search"],
        supported_memory_scopes=["skills", "learning_goals"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.SUGGEST,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="enterprise",
    ),
    # 14. Career Trajectory Advisory
    AgentCapabilityManifest(
        capability_id="career.trajectory.advisory",
        agent_id="career",
        display_name="Strategic Career Trajectory & Promotion Planning",
        description="Analyze promotions, career pivot feasibility, compensation trajectories, and executive leveling.",
        semantic_exemplars=[
            "how do i transition from senior to staff engineer?",
            "evaluate my readiness for an engineering manager pivot",
            "plan my promotion roadmap for next year",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph"],
        supported_memory_scopes=["career", "timeline"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.SUGGEST,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="enterprise",
    ),
    # 15. Technical Coding & System Design
    AgentCapabilityManifest(
        capability_id="developer.code.review",
        agent_id="coding",
        display_name="Technical Code Review & Algorithms",
        description="Review code implementations, analyze algorithms and LeetCode problems, and optimize code complexity.",
        semantic_exemplars=[
            "review this python async code for race conditions",
            "how would you design a distributed rate limiter?",
            "critique my leetcode dynamic programming solution",
        ],
        required_tools=[],
        optional_tools=["search_documents"],
        supported_memory_scopes=["code", "technical_skills"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="enterprise",
    ),
    # 16. GitHub Integration
    AgentCapabilityManifest(
        capability_id="developer.github.inspect",
        agent_id="github",
        display_name="GitHub Repository & Portfolio Analysis",
        description="Inspect repositories, commits, pull requests, and quantify open-source engineering contributions.",
        semantic_exemplars=[
            "analyze my github profile for portfolio projects",
            "fetch stats for my open-source repository",
            "summarize my recent pull requests",
        ],
        required_tools=["get_github_profile"],
        optional_tools=["search_github_repos", "fetch_github_repo", "read_github_file"],
        supported_memory_scopes=["portfolio", "github"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="enterprise",
    ),
    # 17. Analytics & Reporting
    AgentCapabilityManifest(
        capability_id="workspace.analytics.report",
        agent_id="analytics",
        display_name="Job Search & Application Conversion Analytics",
        description="Generate funnel analytics, application response rates, and interview conversion metrics.",
        semantic_exemplars=[
            "show my job application stats",
            "what is my response rate across tech companies?",
            "generate weekly career progress report",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph"],
        supported_memory_scopes=["analytics", "applications"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="enterprise",
    ),
    # 18. Recommendation Letters
    AgentCapabilityManifest(
        capability_id="career.recommendation.draft",
        agent_id="recommendation",
        display_name="Recommendation Letter & Endorsement Drafter",
        description="Draft professional recommendation letters, LinkedIn endorsements, and reference packets.",
        semantic_exemplars=[
            "draft a recommendation letter for my former colleague",
            "write a linkedin endorsement for a frontend lead",
        ],
        required_tools=["search_documents"],
        optional_tools=[],
        supported_memory_scopes=["career", "contacts"],
        risk_class=RiskClass.MEDIUM,
        default_autonomy=AutonomyLevel.DRAFT,
        requires_approval_above=AutonomyLevel.DRAFT,
        tier_requirement="enterprise",
    ),
    # 19. Internship & Early Career
    AgentCapabilityManifest(
        capability_id="career.internship.search",
        agent_id="internship",
        display_name="Internship & University Recruiting Engine",
        description="Discover summer internships, co-ops, and new graduate engineering rotation programs.",
        semantic_exemplars=[
            "find summer software engineering internships",
            "new grad rotation programs in finance",
        ],
        required_tools=["search_jobs"],
        optional_tools=["search_documents"],
        supported_memory_scopes=["education", "preference"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="enterprise",
    ),
    # 20. Milestone & Strategy Planning
    AgentCapabilityManifest(
        capability_id="workspace.planning.roadmap",
        agent_id="planning",
        display_name="Executive Milestone & Career Sprint Planning",
        description="Break long-range career goals into quarterly milestones, sprint tasks, and review checkpoints.",
        semantic_exemplars=[
            "create a 90-day plan for landing a staff role",
            "set milestones for my executive job hunt",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph"],
        supported_memory_scopes=["timeline", "goals"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.SUGGEST,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="enterprise",
    ),
    # 21. Workspace Health & Governance
    AgentCapabilityManifest(
        capability_id="workspace.management.health",
        agent_id="workspace",
        display_name="Workspace Resource & Quota Health Diagnostics",
        description="Monitor workspace storage usage, member quotas, connector status, and system health.",
        semantic_exemplars=[
            "check my workspace storage quota",
            "diagnose connector health and sync status",
        ],
        required_tools=[],
        optional_tools=["search_documents"],
        supported_memory_scopes=["workspace_meta"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="enterprise",
    ),
    # 22. Portfolio & Case Studies
    AgentCapabilityManifest(
        capability_id="career.portfolio.curate",
        agent_id="portfolio",
        display_name="Executive Portfolio & Case Study Showcase",
        description="Curate project case studies, executive bios, and work samples into high-impact portfolio presentations.",
        semantic_exemplars=[
            "build a case study for my distributed cache project",
            "curate my design portfolio highlights",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph"],
        supported_memory_scopes=["portfolio", "projects"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.DRAFT,
        requires_approval_above=AutonomyLevel.DRAFT,
        tier_requirement="enterprise",
    ),
    # 23. Mock Interview Simulation
    AgentCapabilityManifest(
        capability_id="career.interview.mock",
        agent_id="interview",
        display_name="Interactive Mock Interviewer & Feedback Coach",
        description="Simulate behavioral, leadership, and system design interviews, and critique technical interview answers and explanations with instant rubric-based scoring.",
        semantic_exemplars=[
            "give me a behavioral mock interview for amazon leadership principles",
            "ask me a tough question about handling conflict with product managers",
            "practice behavioral interview questions using the star framework",
            "conduct a mock system design interview for a tier-1 tech company",
            "prep me for my upcoming executive engineering leadership screening",
            "critique my explanation of distributed consensus and paxos vs raft",
            "how should i answer tell me about a time you had a conflict",
        ],
        required_tools=[],
        optional_tools=["search_documents"],
        supported_memory_scopes=["interview_history", "skills"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="enterprise",
    ),
    # 24. Market & Salary Intelligence
    AgentCapabilityManifest(
        capability_id="market.salary.benchmark",
        agent_id="market_intelligence",
        display_name="Market Salary Benchmarking & Negotiation Intel",
        description="Benchmark base salary, equity grants, and total compensation percentiles across tech tiers.",
        semantic_exemplars=[
            "what is the market rate for a staff engineer in san francisco?",
            "how much equity should i expect at a series b startup?",
            "benchmark this job offer against levels.fyi data",
            "benchmark staff software engineer salaries in seattle vs bay area",
            "is a 350k total compensation package fair for an l6 at google?",
            "what is the current market rate for vp of engineering equity grants?",
            "give me a negotiation counter-offer strategy for my current offer",
            "break down compensation percentiles for ai infrastructure engineers",
        ],
        required_tools=["search_documents"],
        optional_tools=["web_search"],
        supported_memory_scopes=["compensation", "market"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="enterprise",
    ),
    # 25. Professional Network & Outreach
    AgentCapabilityManifest(
        capability_id="career.network.outreach",
        agent_id="network",
        display_name="Professional Network Graph & Outreach",
        description="Map professional connections, identify warm introduction paths, and draft networking and LinkedIn cold outreach messages.",
        semantic_exemplars=[
            "who in my network works at stripe?",
            "draft a warm outreach note to a tech recruiter",
            "compose a cold outreach message to an engineering director on linkedin",
            "find alumni from my university working at openai or anthropic",
            "generate coffee chat invitations for principal engineers in fintech",
            "how can i expand my professional network in the generative ai domain?",
            "draft a warm introduction request through our mutual contact",
        ],
        required_tools=["search_documents"],
        optional_tools=["query_graph"],
        supported_memory_scopes=["contacts", "network"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.DRAFT,
        requires_approval_above=AutonomyLevel.DRAFT,
        tier_requirement="enterprise",
    ),
    # 26. Executive Wellness & Burnout
    AgentCapabilityManifest(
        capability_id="executive.wellness.burnout_prevention",
        agent_id="wellness",
        display_name="Executive Wellness & Sustainable Pacing Partner",
        description="Address pre-interview anxiety, nervousness, grounding exercises, healthy pacing, and reflective restoration during grueling searches.",
        semantic_exemplars=[
            "i feel exhausted from interviewing all week",
            "help me pace my job applications so i don't burn out",
            "i'm anxious about tomorrow's final round",
            "i'm feeling super nervous about my final round loop tomorrow morning",
        ],
        required_tools=[],
        optional_tools=[],
        supported_memory_scopes=["wellness", "preferences"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="enterprise",
    ),
    # 27. Security & Compliance
    AgentCapabilityManifest(
        capability_id="workspace.security.audit",
        agent_id="security",
        display_name="PII Redaction, Permissions & Workspace Security Compliance",
        description="Audit permissions, access tokens for SaaS tools, scan documents for leaked credentials and PII, and verify multi-tenant workspace isolation.",
        semantic_exemplars=[
            "scan my uploaded documents for pii",
            "did i leave any secrets or api keys in my notes?",
            "audit workspace access logs",
            "audit permissions and access tokens for connected saas tools",
            "verify document encryption and multi-tenant workspace isolation",
            "scan uploaded documents for pii, secrets, and credentials",
        ],
        required_tools=["search_documents"],
        optional_tools=[],
        supported_memory_scopes=["security"],
        risk_class=RiskClass.LOW,
        default_autonomy=AutonomyLevel.READ,
        requires_approval_above=AutonomyLevel.READ,
        tier_requirement="enterprise",
    ),
    # 28. Connectors
    AgentCapabilityManifest(
        capability_id="integration.connector.configure",
        agent_id="connector",
        display_name="SaaS Connector Setup & Health Telemetry",
        description="Configure Composio, Google, Microsoft, and custom MCP connectors with encrypted credential vaulting.",
        semantic_exemplars=[
            "set up google drive connector",
            "check status of my github connector",
            "reconnect my expired slack integration",
        ],
        required_tools=[],
        optional_tools=[],
        supported_memory_scopes=["connectors"],
        risk_class=RiskClass.HIGH,
        default_autonomy=AutonomyLevel.SUGGEST,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="enterprise",
    ),
    # 29. Plugins
    AgentCapabilityManifest(
        capability_id="integration.plugin.browse",
        agent_id="plugin",
        display_name="Plugin Ecosystem & Extension Marketplace",
        description="Discover, verify compatibility, and install sandboxed community plugins and skill packs.",
        semantic_exemplars=[
            "browse available plugins",
            "install latex resume compiler plugin",
            "check compatibility of installed extensions",
        ],
        required_tools=[],
        optional_tools=[],
        supported_memory_scopes=["plugins"],
        risk_class=RiskClass.HIGH,
        default_autonomy=AutonomyLevel.SUGGEST,
        requires_approval_above=AutonomyLevel.SUGGEST,
        tier_requirement="enterprise",
    ),
]


ROUTING_STOPWORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with",
    "by", "of", "from", "up", "about", "into", "over", "after", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your",
    "yours", "it", "its", "they", "them", "their", "this", "that", "these", "those",
    "am", "will", "would", "shall", "should", "can", "could", "may", "might", "must",
    "m", "re", "ve", "ll", "d", "s", "t", "just", "so", "super", "very",
})


class CapabilityRegistry:
    """Authoritative repository of agent and tool capabilities."""

    def __init__(self) -> None:
        self._capabilities: dict[str, AgentCapabilityManifest] = {
            c.capability_id: c for c in CANONICAL_CAPABILITIES
        }
        self._agent_to_caps: dict[str, list[AgentCapabilityManifest]] = {}
        for c in CANONICAL_CAPABILITIES:
            self._agent_to_caps.setdefault(c.agent_id, []).append(c)

    def get_by_id(self, capability_id: str) -> AgentCapabilityManifest | None:
        return self._capabilities.get(capability_id)

    def get_by_agent(self, agent_id: str) -> list[AgentCapabilityManifest]:
        return self._agent_to_caps.get(agent_id.lower(), [])

    def list_all(self) -> list[AgentCapabilityManifest]:
        return list(self._capabilities.values())

    def resolve_candidate_capabilities(
        self,
        query: str,
        top_k: int = 5,
        mvp_only: bool = False,
    ) -> list[AgentCapabilityManifest]:
        """Fast semantic candidate scoring using token overlap and exemplar similarity."""
        clean_q = query.strip().lower()
        if not clean_q:
            conv = self.get_by_id("executive.companion.scaffold")
            return [conv] if conv else []

        raw_words = set(re.findall(r"\b\w+\b", clean_q))
        query_words = raw_words - ROUTING_STOPWORDS
        if not query_words:
            query_words = raw_words
        if not query_words:
            conv = self.get_by_id("executive.companion.scaffold")
            return [conv] if conv else []

        scored: list[tuple[float, AgentCapabilityManifest]] = []

        for cap in self._capabilities.values():
            if mvp_only and cap.tier_requirement != "mvp":
                continue

            score = 0.0
            # 1. Match description tokens
            desc_words = set(re.findall(r"\b\w+\b", cap.description.lower())) - ROUTING_STOPWORDS
            overlap = len(query_words.intersection(desc_words))
            score += overlap * 0.15

            # 2. Match exemplars
            for ex in cap.semantic_exemplars:
                ex_lower = ex.lower()
                ex_words = set(re.findall(r"\b\w+\b", ex_lower)) - ROUTING_STOPWORDS
                ex_overlap = len(query_words.intersection(ex_words))
                if ex_overlap > 0:
                    score += (ex_overlap / max(1, len(ex_words))) * 0.5
                # Whole word or phrase match (at least 3 chars)
                if len(clean_q) >= 3 and clean_q in ex_lower:
                    if re.search(r"\b" + re.escape(clean_q) + r"\b", ex_lower):
                        score += 0.8

            scored.append((score, cap))

        scored.sort(key=lambda x: x[0], reverse=True)
        # If all scores are zero, return default conversation capability
        if not scored or scored[0][0] <= 0.0:
            conv = self.get_by_id("executive.companion.scaffold")
            return [conv] if conv else [c for _, c in scored[:top_k]]
        return [c for _, c in scored[:top_k]]


# Global singleton
capability_registry = CapabilityRegistry()
