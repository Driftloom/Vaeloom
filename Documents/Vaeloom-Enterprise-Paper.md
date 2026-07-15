Enterprise Product Vision Paper

# Vaeloom

**Document status:** Vision / Architecture Paper â€” Enterprise Edition
**Builds on:** Vaeloom MVP Product Spec (v1)
**Audience:** Founders, engineers, AI researchers, investors, enterprise design partners

> This paper assumes the MVP described in the companion spec has
> shipped and proven the core loop â€” ingest, organize, remember, assist â€”
> with real users. Everything here is what Vaeloom becomes once that loop
> is trusted: a multi-tenant, enterprise-grade personal intelligence
> platform, sold both to individuals and to institutions (universities,
> bootcamps, companies) that want to give every member of their population
> their own second brain.

---

## Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [User Journey](#user-journey)
4. [Workspace](#workspace)
5. [Connector Ecosystem](#connector-ecosystem)
6. [File Ingestion Engine](#file-ingestion-engine)
7. [Autonomous Organization Agent](#autonomous-organization-agent)
8. [Enterprise Memory System](#enterprise-memory-system)
9. [AI Agent System](#ai-agent-system)
10. [Resume Intelligence](#resume-intelligence)
11. [ATS Intelligence](#ats-intelligence)
12. [Career Intelligence](#career-intelligence)
13. [Gmail Intelligence](#gmail-intelligence)
14. [Scheduler](#scheduler)
15. [Knowledge Workspace](#knowledge-workspace)
16. [Dashboard](#dashboard)
17. [Application Pages](#application-pages)
18. [Global Search](#global-search)
19. [Security & Compliance](#security-compliance)
20. [AI Architecture](#ai-architecture)
21. [Future Innovations](#future-innovations)
22. [Gap Analysis & Missing Features](#gap-analysis-missing-features)
23. [From MVP to Enterprise â€” Migration Path](#from-mvp-to-enterprise-migration-path)
24. [Appendix: Glossary](#appendix-glossary)

---

## 1. Executive Summary

### 1.1 Vision

A personâ€™s knowledge, work, and career should not live scattered
across forty disconnected apps, each with no memory of the others.
Vaeloomâ€™s vision is a single, continuously learning intelligence layer
that sits underneath everything a person does professionally and
academically â€” one place that knows their education, their projects,
their skills, their conversations, their applications, and their goals,
and that uses that knowledge to act on their behalf, with their
permission, for years.

Not a workspace app with AI bolted on. Not a chatbot with a long
context window. An operating layer for a personâ€™s intellectual and
professional life â€” built around a memory that compounds rather than
resets every session.

### 1.2 Mission

Build the most trustworthy AI-native personal intelligence platform:
one that organizes a personâ€™s digital life, remembers everything that
matters about their education and career, and actively works on their
behalf â€” applying to opportunities, preparing them for interviews,
surfacing what theyâ€™d otherwise forget â€” while keeping the person in
control of every consequential action.

### 1.3 Goals

| Goal | What it means in practice |
| --- | --- |
| Persistent, structured memory | Every interaction makes the system know the user better â€” nothing is forgotten, nothing has to be re-explained |
| Zero manual organization | The user never has to name a file, sort a folder, or maintain a resume by hand |
| Proactive, not just reactive | The system surfaces opportunities, deadlines, and risks before being asked |
| Trustworthy autonomy | Every autonomous action is explainable, reversible, and was earned through a visible track record |
| Platform, not silo | Third parties can extend Vaeloom through a real plugin/MCP ecosystem rather than waiting on the core team |

### 1.4 Product Philosophy

Three commitments shape every design decision in this paper:

1. **Memory before features.** A flashier UI on a shallow
   memory loses to a plain UI on a deep one. Every new feature is evaluated
   by what it teaches the memory system, not just what it shows the
   user.
2. **Consent is the architecture, not a settings page.**
   Permission scopes, autonomy levels, and audit trails are core data-model
   concepts, present in every agent and every connector from the schema up
   â€” not a layer added later for compliance.
3. **Earned autonomy compounds.** The system starts
   conservative everywhere and becomes more autonomous only where it has
   demonstrated itâ€™s right â€” per agent, per user, per action type. Trust is
   a variable the product tracks, not an assumption it makes.

### 1.5 Long-term Vision

Five to ten years out, Vaeloom aims to be the layer a personâ€™s
entire professional identity is built on top of: the system that has
watched a studentâ€™s growth from their first semester through their fifth
job change, that knows which of their skills are current and which have
atrophied, that can answer â€œwhat have I actually accomplishedâ€ better
than the person can themselves because it has the receipts. At that
horizon, Vaeloom is less an app a person opens and more an ambient
layer that other tools â€” a companyâ€™s ATS, a universityâ€™s career office,
a personâ€™s own calendar â€” read from and write to, with the person as the
sole owner of the underlying memory.

### 1.6 Market Opportunity

The addressable population is anyone whose career depends on an
accurate, current account of what theyâ€™ve done: students (the largest,
most underserved segment â€” no existing tool builds a resume
*continuously* from real activity), early-career professionals
navigating frequent job changes, freelancers managing portfolios across
clients, and â€” at the enterprise tier â€” universities and companies that
want to offer this as a benefit to their students or employees (career
services, internal mobility, alumni engagement). The wedge is students,
because their pain (constantly rebuilding a resume, missing
opportunities, disorganized files) is acute, underserved by incumbents,
and produces a habit (continuous file/email connection) that naturally
extends into a multi-year professional relationship as the same person
becomes a job seeker, then an employee, then an alum.

### 1.7 Problems Solved

* Resumes that are perpetually out of date because updating them is
  manual, tedious work nobody prioritizes until a deadline forces it.
* Achievements and skills that quietly get forgotten â€” a hackathon
  win, a certification, a strong project â€” because nothing connects
  â€œthings I didâ€ to â€œthings on my resume.â€
* Job and internship search that is reactive, manual, and disconnected
  from any sense of personal fit.
* Important time-sensitive information (interview calls, application
  deadlines) buried in inboxes and missed.
* Files, documents, and knowledge scattered across a dozen tools with
  no single, trustworthy source of truth.
* The cognitive overhead of being your own project manager for your
  education and career, with no system tracking it for you.

### 1.8 Why Current Solutions Fail

| Category | Why it falls short |
| --- | --- |
| Generic AI chatbots | No persistent, structured memory of *this specific person* â€” every session starts from zero |
| Resume builders | Static templates; the user still has to remember and type everything manually |
| File storage (Drive, Dropbox) | Organizes by folder structure the user defines, not by what the content means |
| Note apps (Notion, Obsidian) | Powerful for manual organization, but the user does all the linking and tagging themselves |
| Job boards | Search and apply, but have no memory of the user beyond a stored resume PDF |
| Career services / counselors | High-touch and valuable, but donâ€™t scale to continuous, daily support |

### 1.9 Competitive Advantage

Vaeloomâ€™s moat isnâ€™t any single feature â€” resume builders, job
boards, and note apps are all individually replicable. The moat is the
compounding memory: the longer a person uses Vaeloom, the better every
feature gets, and the more painful it becomes to start over somewhere
else with a system that knows nothing about them. This is the same
dynamic that makes long-used note systems and CRMs sticky, applied for
the first time to a personâ€™s own career and knowledge rather than a
companyâ€™s customer data.

### 1.10 Future AI Vision

As underlying models improve, Vaeloomâ€™s agents donâ€™t need new
product surfaces to get more capable â€” they need better judgment inside
the same permission and memory architecture. The paper is written so
that â€œthe model got smarterâ€ is a quality improvement inside existing
agents, not a reason to redesign the product. The structural bet â€”
memory as the core asset, agents as thin, auditable wrappers around it â€”
is meant to outlast any particular model generation.

---

## 2. Product Overview

Vaeloom is a personal intelligence platform: it ingests a personâ€™s
documents, code, and communications; builds a continuously updated
memory of who they are and what theyâ€™ve done; and runs a set of
specialized agents on top of that memory to organize files, maintain a
resume, search for and apply to opportunities, track deadlines, and
answer questions â€” all with explicit, auditable permission controls.

It is not a chatbot that happens to remember things. It is a memory
system that happens to expose a chat interface, among several other
interfaces.

### 2.1 Who itâ€™s for

| Persona | Core need | Primary modules |
| --- | --- | --- |
| **Student** | Build a real resume from real activity; never miss an opportunity | Organization Agent, Resume Agent, Job/Internship Search, Scheduler |
| **Job seeker** | Apply efficiently and well-targeted, track everything | Career Intelligence, ATS Agent, Application tracking |
| **Early-career professional** | Keep a living record of growth across roles | Memory system, Resume Agent, Knowledge Workspace |
| **Researcher** | Organize papers, notes, citations; surface connections | Knowledge Workspace, Memory Graph, Document Agent |
| **Developer** | Connect code/projects to a career narrative automatically | GitHub Agent, Coding Agent, Resume Agent |
| **Freelancer** | Maintain a portfolio and pipeline across clients | Workspace, Career Memory, Document Agent |
| **Startup founder** | Track everything â€” fundraising docs, hiring, partnerships â€” in one brain | Workspace, Memory Graph, Document Agent, Scheduler |
| **Enterprise employee** (enterprise tier) | Internal mobility, skills tracking, structured growth within an org | Org-scoped memory, Admin-visible (with consent) skill graph |

---

## 3. User Journey

### 3.1 Registration

Standard auth (email, SSO for enterprise tenants) plus an identity
decision up front: personal account vs.Â organization-provisioned
account. Organization accounts inherit tenant-level policy (retention
windows, allowed connectors) but the underlying memory remains owned by
the individual â€” see Â§19 for the consent model that makes this work.

### 3.2 Workspace creation

A new, empty workspace is provisioned: an isolated memory namespace,
a default folder taxonomy (Education, Career, Projects, Certificates,
Research, Personal), and a blank knowledge graph. Nothing is
pre-populated â€” Vaeloom never assumes structure the user hasnâ€™t created
or content hasnâ€™t implied.

### 3.3 Memory initialization

The user is walked through a short, optional â€œseedâ€ flow: upload a
resume if one exists, connect one or two sources. This isnâ€™t required â€”
Vaeloom works from zero â€” but it gives the memory system enough signal
to be useful in the first session rather than the first week.

### 3.4 Knowledge graph creation

As soon as the first document or connector lands, the Memory Agent
begins extracting entities and relationships. The graph starts sparse
and grows denser with every file, email, and interaction â€” visible from
day one in the Memory Graph page, even when small, so the user sees the
system is building something rather than operating as a black box.

### 3.5 Agent initialization

Each of the platformâ€™s agents is instantiated for the workspace with
default (conservative) permission and autonomy settings. No agent begins
with write or act permissions â€” those are granted explicitly, per agent,
as described in Â§9.

### 3.6 Connector setup

The user connects the sources relevant to them â€” Gmail, GitHub,
Drive, a local folder, VS Code, and (enterprise tier) institutional
systems. Each connector setup is a distinct, scoped OAuth or permission
grant, never a single â€œconnect everythingâ€ toggle.

### 3.7 Daily usage

The system runs largely in the background: the Organization Agent
files new documents, the Gmail Agent runs its scheduled and
push-triggered passes, the Scheduler surfaces whatâ€™s coming up. The
userâ€™s active time is spent in short, high-value interactions â€”
approving a batch of file moves, picking which job matches to pursue,
asking the chat a specific question â€” rather than maintaining the
system.

### 3.8 Continuous learning

Every approval, correction, and rejection is itself a signal: when
the user renames a file the Organization Agent got wrong, or rejects a
job match, that correction is written back into Preference Memory and
changes future behavior. The system is never â€œdoneâ€ learning the
user.

### 3.9 Long-term personalization

Over months and years, Vaeloomâ€™s value shifts from â€œorganizes my
stuffâ€ to â€œknows my trajectoryâ€ â€” it can answer questions like â€œwhat
should I learn next given where I want to goâ€ or â€œhow has my skill set
actually changed in the last two yearsâ€ with real, sourced evidence
rather than generic advice, because it watched it happen.

---

## 4. Workspace

Vaeloomâ€™s workspace is the canonical home for everything a person
creates or collects in their education and career. It is intentionally
broad â€” the goal is that the user never has to ask â€œwhere should this
go,â€ because anything they touch has an obvious place.

**Supported content categories:** Projects, Documents,
Folders, Notes, Tasks, Goals, Knowledge items, Research, Bookmarks,
Certificates, Resume versions, Code & repositories, Learning
materials, Career artifacts (offer letters, job descriptions,
application records), Emails (referenced, not duplicated â€” see Â§13),
Calendar events, Drive-synced files, Images, Videos, PDFs,
Word/Excel/PowerPoint documents, Markdown, CSV, and source code in any
language.

**Design principle:** the workspace is a *view*
over the memory system, not a separate filesystem the memory system has
to be told about. A file moved in the workspace UI and a file moved by
the Organization Agent update the exact same underlying record â€” there
is no sync step, no separate source of truth to reconcile.

---

## 5. Connector Ecosystem

### 5.1 Connector catalog

| Category | Connectors |
| --- | --- |
| Cloud storage & docs | Google Drive, Google Docs/Sheets/Slides, Dropbox, OneDrive |
| Communication | Gmail, Slack, Discord |
| Code | GitHub, GitLab, VS Code, local folder sync |
| Career platforms | LinkedIn, Indeed, Naukri, Internshala, Wellfound |
| Competitive / coding profiles | LeetCode, Codeforces, HackerRank, Kaggle |
| Learning | YouTube, Coursera, Udemy |
| Knowledge tools | Notion, Obsidian, Figma, Canva |
| Productivity suites | Microsoft Office, Google Calendar |
| Access surfaces | Browser extension, desktop app, mobile app |

Each connector ships with: a defined scope set (read / write / act,
each separately grantable), a rate-limit and quota policy, and a health
status visible on the Connectors page (connected, degraded, needs
re-auth).

### 5.2 Plugin architecture

Third-party developers can register new connectors and agent tools
without touching Vaeloomâ€™s core. A plugin declares:

* **Manifest** â€” name, description, required scopes, auth
  type (OAuth2, API key, none)
* **Tool definitions** â€” JSON-schema input/output for
  each capability it exposes, identical in shape to an MCP tool
  definition
* **Permission tier** â€” read-only, write, or act
  (act-tier plugins always require explicit per-action approval until a
  user grants standing autonomy)
* **Sandboxing contract** â€” what the plugin can and
  cannot access outside its declared scopes; enforced by the Permission
  Engine (Â§19), not by developer self-policing

### 5.3 MCP architecture

Vaeloom both **consumes** external MCP servers (so any
MCP-compatible tool â€” a companyâ€™s internal Jira, a research database â€”
can be added as a connector without custom integration work) and
**exposes** an MCP server of its own, so that Vaeloomâ€™s
memory and agents can be called from other environments a user already
works in (an IDE, another assistant) under the same permission model.
The internal tool-calling format used throughout the platform (Â§5.2, Â§9)
is MCP-shaped from the ground up specifically so this dual role â€”
consumer and provider â€” doesnâ€™t require two different integration
layers.

### 5.4 SDK for third-party integrations

A typed SDK (TypeScript and Python first) wraps connector and plugin
registration, memory read/write calls (scoped to what the integration is
authorized for), and a local test harness that simulates the permission
engine so developers can verify a plugin respects its declared scopes
before submission.

---

## 6. File Ingestion Engine

### 6.1 Pipeline overview

```
Source (upload / connector / sync)
   â†’ Format detection
   â†’ Parsing (per-type)
   â†’ OCR (if scanned/image-based)
   â†’ Semantic extraction (entities, summary, embeddings)
   â†’ Dedup & version detection
   â†’ Memory write (knowledge graph + vector store)
   â†’ Organization Agent proposal (name, folder, tags)
```

### 6.2 Document parsing

Type-specific parsers for PDF, DOCX, PPTX, XLSX/CSV, Markdown, and
plain text extract both structure (headings, tables, sections) and
content. Structure is preserved in document memory so an agent can
answer â€œwhat does section 3 sayâ€ without re-parsing the source file.

### 6.3 OCR

Scanned certificates, transcripts, and photographed documents go
through OCR with confidence scoring; low-confidence extractions are
flagged for user confirmation rather than silently trusted â€” a misread
grade or date is worse than no data at all.

### 6.4 Image understanding

Photos and screenshots (e.g., a photographed certificate, a
whiteboard from a hackathon) are processed with vision models to extract
both text and contextual meaning (what kind of document this is, not
just what it says).

### 6.5 Code understanding

Repositories are parsed for structure (languages used, dependency
graph, README content, commit history shape) without ingesting full
source verbatim into memory â€” whatâ€™s stored is a semantic summary (what
the project does, what skills it demonstrates, what the userâ€™s
contribution was) plus a pointer back to the source, keeping memory
dense rather than bloated with raw code.

### 6.6 Spreadsheet understanding

Beyond raw parsing, the engine infers what a spreadsheet *is*
(a grade tracker, a budget, a project plan) from headers and structure,
so it can be summarized and categorized meaningfully rather than filed
generically as â€œExcel file.â€

### 6.7 Semantic extraction

The shared final stage for every content type: entity extraction
(skills, organizations, dates, people, projects), relationship
inference, a generated summary, and an embedding â€” this is the handoff
point into the Enterprise Memory System (Â§8).

---

## 7. Autonomous Organization Agent

The Organization Agent is the systemâ€™s most-run agent â€” every new
piece of content passes through it â€” and the one where conservative
defaults matter most, because its mistakes are the most visible (a
misfiled or wrongly-renamed document erodes trust fast).

### 7.1 Responsibilities

Read and understand each document; propose an intelligent name and
category; propose a destination folder; detect duplicates and version
chains; extract metadata; generate tags and a summary; maintain folder
hierarchy consistency; never overwrite or delete without approval;
maintain an archive system for superseded versions; maintain full
version history; generate periodic organization reports; proactively
suggest structural improvements (e.g., â€œyou have 40 uncategorized files
in Downloads-sync â€” want me to sort them?â€).

### 7.2 Version & duplicate handling

Version chains are detected by content similarity plus filename
heuristics, then presented to the user as a single grouped entity
(â€œResume â€” 4 versions, latest from Marchâ€) rather than four unrelated
files. Duplicates across sources (a file in both Drive and the local
folder) are merged at the memory layer without requiring the user to
manually reconcile them.

### 7.3 Archive, never delete

Superseded files move to an Archive namespace, fully searchable and
restorable, never to a trash bin with a retention timer. The only true
deletion path is the explicit â€œdelete everythingâ€ data control in
Settings (Â§19.6).

### 7.4 Autonomy progression

Starts in full suggest-mode for every workspace. As the user approves
the agentâ€™s proposals over time (configurable threshold, e.g., 95%+
approval rate over 50 actions), the system offers to upgrade specific
action types (e.g., â€œauto-file PDFs youâ€™ve approved the categorization
for 20 times in a rowâ€) to autonomous â€” always revocable, always logged,
always scoped to an action type rather than a blanket â€œtrust this agentâ€
toggle.

---

## 8. Enterprise Memory System

This is the section the rest of the product is built on top of. Every
agent, every page, every feature in this paper is, underneath, a read or
a write against the system described here.

### 8.1 Memory taxonomy

The MVP ships six load-bearing memory types. The enterprise system
completes the full taxonomy â€” each type exists because it answers a
different *kind* of question, not as taxonomy for its own
sake.

| Memory type | Answers the question | Example |
| --- | --- | --- |
| Long-term | Whatâ€™s durably true about this person? | Degree, core skills |
| Short-term | Whatâ€™s relevant right now? | Current task context |
| Working | Whatâ€™s active in this exact session? | This conversation |
| Conversation | What have we discussed before? | Past chat threads |
| Document | What does this specific file contain? | A research paperâ€™s summary |
| Career | Whatâ€™s happened in their job search? | Applications, outcomes |
| Skill | What can they do, and how well? | â€œIntermediate React, 14 monthsâ€ |
| Learning | What are they studying / have studied? | Course progress |
| Preference | What do they like, avoid, prefer? | â€œPrefers async communicationâ€ |
| Relationship | Who do they know, and how? | Mentor, recruiter contact |
| Task | What needs doing? | Open action items |
| Goal | What are they working toward? | â€œGet an SDE internship by Decâ€ |
| Project | What have they built? | Project descriptions, roles played |
| Research | What have they explored or read? | Paper notes, citations |
| Behavior | What patterns repeat? | Procrastinates on cover letters |
| Context | Whatâ€™s the situational backdrop? | â€œFinal semester, exam seasonâ€ |
| Semantic | General facts and concepts theyâ€™ve engaged with | Domain knowledge built over time |
| Procedural | How they do things, step by step | Their personal job-application checklist |
| Timeline | What happened, in order | Chronological life/career events |
| Event | Specific dated occurrences | â€œInterview on April 3â€ |
| Decision | Choices made and their reasoning | â€œChose internship A over B becauseâ€¦â€ |

### 8.2 Knowledge graph

Entities (Person, Skill, Project, Organization, Certificate, Event,
Job, Course, Publication) connected by typed, directional relationships
(`worked_on`, `awarded_to`,
`requires_skill`, `applied_to`,
`mentored_by`, `published_with`). The graph is the
structural backbone; the vector store (Â§8.4) is the semantic backbone.
Most useful queries need both.

### 8.3 Entity extraction & relationship graph

Extraction runs on every ingested document, email, and conversation
turn via the Memory Agent. New entities are deduplicated against
existing ones using a combination of string similarity, embedding
similarity, and graph context (a â€œProject Xâ€ mentioned in two different
documents is merged if other signals â€” dates, related skills â€” agree
theyâ€™re the same project). Relationships are inferred, not just
extracted verbatim, so the graph captures things no single document
stated outright (e.g., inferring `requires_skill` between a
project and a technology mentioned only in its code, not its
description).

### 8.4 Graph database & hybrid retrieval

The graph is backed by a dedicated graph database; document and
conversation content is separately embedded into a vector store.
**Agentic RAG** means the calling agent â€” not a fixed
pipeline â€” decides which combination of vector search (semantic
similarity), keyword search (exact term matching, useful for tool names,
course codes, IDs), and graph traversal (relationship-following queries
like â€œeverything connected to this skillâ€) best answers its current
question, and can combine results from more than one strategy in a
single query.

### 8.5 Memory lifecycle management

| Process | What it does |
| --- | --- |
| Compression | Collapses many low-information memories into fewer, denser ones over time |
| Reflection | Periodic agent passes that re-examine recent memory for higher-level patterns (e.g., â€œthis person has rejected three frontend-heavy roles â€” likely a real preference, not noiseâ€) |
| Consolidation | Merges duplicate or near-duplicate memories into one canonical record |
| Evolution | Updates a memoryâ€™s confidence/content as new, contradicting, or confirming evidence arrives, rather than treating memory as append-only |
| Ranking | Orders retrieved memories by a combination of relevance, recency, and confidence for a given query |
| Freshness | Tracks how recently a memory was confirmed true; stale memories are down-weighted automatically |
| Importance | A learned/assigned weight reflecting how central a memory is to the personâ€™s identity vs.Â incidental |
| Confidence | How strongly the system believes a given fact, based on source count and source reliability |

### 8.6 Memory governance

| Capability | What it provides |
| --- | --- |
| Versioning | Every memory record keeps its edit history, not just its current state |
| Provenance | Every fact traces back to the source document/event that produced it |
| Privacy | Per-memory-type visibility controls â€” whatâ€™s used internally vs.Â whatâ€™s ever surfaced to the user or an integration |
| Encryption | At-rest and in-transit encryption for all memory stores |
| Deletion | Granular (delete this fact) and total (delete everything) controls, both honored immediately and verifiably |
| Export | Full memory export in a structured, portable format â€” the personâ€™s data should never be unrecoverable from the platform |
| Import | Bootstrapping a new workspace from an export, or migrating from a competing tool |
| Visualization | The Memory Graph page (Â§17) â€” a navigable, not just illustrative, view of the graph |
| Timeline | A chronological view across Episodic and Timeline memory |
| Audit | A complete, queryable log of every read and write to memory, by which agent, for what reason |
| Explainability | For any fact or suggestion the system surfaces, a clear answer to â€œwhy does it think this,â€ tracing back through provenance to source documents |

### 8.7 Relationship to existing tools

Vaeloomâ€™s memory system is built in conversation with ideas from
personal knowledge tools like Obsidian (bi-directional linking, a
navigable graph of oneâ€™s own notes) and from GraphRAG-style approaches
to entity-and-relationship-grounded retrieval â€” without adopting either
wholesale. The key structural difference: in those tools, the graph is
built by the userâ€™s manual effort (linking notes, tagging entities). In
Vaeloom, the graph is built automatically by agents reading the userâ€™s
real activity, with the user able to view, correct, and override it, but
never required to maintain it by hand.

---

## 9. AI Agent System

### 9.1 Design principles

Every agent in this roster shares the same contract: a fixed mission
and tool list it cannot exceed, explicit read/write memory permissions,
a declared autonomy default, a defined failure-recovery behavior (ask
the user rather than guess), and a standard inter-agent communication
format so any agent can request work from any other through the
Orchestrator rather than agents calling each other ad hoc.

### 9.2 Full agent roster

| Agent | Mission | Key inputs | Key outputs | Default autonomy |
| --- | --- | --- | --- | --- |
| Orchestrator | Routes requests to the right specialist agent | User input, agent states | Routed task | Full |
| Workspace Agent | Maintains overall workspace structure and health | File system state | Structure suggestions | Suggest |
| Organization Agent | Names, files, deduplicates documents | New/changed files | Filed documents | Suggest â†’ earned auto |
| Memory Agent | Extracts entities, maintains graph and vector store | All agent outputs | Knowledge graph, vector store | Full (internal) |
| Resume Agent | Builds and maintains the master resume | Profile/Career memory | Resume documents | Suggest |
| ATS Agent | Scores resume against job descriptions | Resume, JD | Score, gap report | Read-only |
| Career Agent | Tracks overall career trajectory and goals | Career, Skill memory | Career insights | Suggest |
| Learning Agent | Tracks courses, skills in progress, learning goals | Learning memory, connectors | Learning roadmap | Suggest |
| Research Agent | Organizes papers, notes, citations | Document memory | Research summaries, links | Suggest |
| Coding Agent | Understands repos and coding activity | GitHub/local code | Project summaries | Suggest |
| GitHub Agent | Syncs repo activity, commit history | GitHub connector | Project memory updates | Read-only |
| Gmail Agent | Classifies mail, extracts deadlines/tasks | Gmail connector | Schedule entries, drafts | Suggest (drafts only) |
| Calendar Agent | Maintains calendar consistency | Calendar connector, Scheduler | Calendar events | Suggest |
| Job Search Agent | Finds and ranks job/internship matches | Career memory, connectors | Ranked shortlist | Suggest |
| Internship Agent | Specialized search for internships/fellowships | Career memory, connectors | Shortlist | Suggest |
| Application Agent | Tailors documents, submits or deep-links applications | Resume, ATS output | Tailored docs, submitted apps | Approval-gated |
| Document Agent | General-purpose document Q&A and summarization | Document memory | Answers, summaries | Read-only |
| PDF Agent | Specialized parsing/filling for PDF forms | PDF files | Filled forms | Suggest |
| Planning Agent | Builds learning/project/application roadmaps | Goal, Career memory | Roadmaps | Suggest |
| Scheduler Agent | Maintains deadlines, conflict detection | All agents, calendar | Schedule, alerts | Suggest / full for reminders |
| Reminder Agent | Sends timely nudges for upcoming items | Schedule | Notifications | Full (notify only) |
| Analytics Agent | Surfaces patterns and trends across memory | All memory | Dashboard insights | Read-only |
| Recommendation Agent | Suggests next actions, skills, opportunities | All memory | Suggestions | Read-only |
| Security Agent | Monitors for anomalous access, enforces policy | Audit log, Permission Engine | Alerts, blocks | Full (protective) |
| Plugin Agent | Manages plugin lifecycle and sandboxing | Plugin manifests | Plugin status | Full (internal) |
| Connector Agent | Manages connector health, token refresh | Connector states | Health status | Full (internal) |
| Reflection Agent | Periodic higher-level pattern review of memory | All memory | Consolidated insights | Full (internal) |
| Self-Improvement Agent | Tracks agent accuracy, proposes prompt/tool refinements | Agent performance logs | Improvement proposals | Human-reviewed |
| Quality Assurance Agent | Validates other agentsâ€™ outputs before they reach the user | All agent outputs | Pass/flag decisions | Full (internal gate) |

### 9.3 Flagship agents, in depth

**Memory Agent.** The most-called agent in the system,
though the user rarely interacts with it directly. Every other agentâ€™s
output passes through it on the way to becoming durable memory. Its core
skill is judgment about merging â€” deciding whether â€œMLâ€ and â€œMachine
Learningâ€ are the same skill node, whether two project mentions are the
same project â€” which it does using embedding similarity, graph context,
and confidence scoring rather than exact string matching. Failure mode
itâ€™s specifically designed against: silent incorrect merges, which are
worse than failing to merge at all (a wrong merge corrupts two records;
a missed merge just leaves them separate and correctable).

**Reflection Agent.** Runs on a schedule (not
per-event), reviewing recent memory for patterns no single document
would reveal â€” a string of rejected job types implying an unstated
preference, a skill that appears in projects but never in the resume.
Outputs are always presented as suggestions (â€œit looks like you might be
more interested in backend roles â€” want me to weight your search that
way?â€), never silent behavior changes, because pattern inference is
exactly the kind of agent output most likely to be subtly wrong.

**Job Search Agent.** Operates inside the real-world
constraints detailed in the MVP spec (Â§9 of the companion document) â€”
official APIs where available, tailored documents plus deep-links where
not. At enterprise scale, this agent also factors in organization-level
data where consented (e.g., a university career officeâ€™s list of partner
employers) without that data ever being visible to other tenants.

**Quality Assurance Agent.** A gate, not a generator â€”
it doesnâ€™t produce user-facing content itself, it reviews what other
agents are about to show or do (a proposed file rename, a drafted email,
an application about to be submitted) against basic correctness and
policy checks before it reaches the user or, for autonomous actions,
before it executes. This is the architectural answer to â€œwhat stops an
agent from doing something clearly wrongâ€ beyond just hoping the
underlying model gets it right.

---

## 10. Resume Intelligence

The Resume Agent maintains a single **master resume** â€”
the canonical, always-current record â€” and generates every variant from
it rather than maintaining parallel documents that drift out of
sync.

**Sources it draws from:** Education, Projects, Skills,
Achievements, Certificates, Research, Hackathons, Internships, Coding
profiles, Open-source contributions, Leadership roles, Competitions,
Publications.

**When data is missing:** the agent asks a specific,
narrow question (â€œWhat was your role on the HackX project â€” youâ€™re
listed as a contributor but no role is recordedâ€) rather than a generic
prompt or a silent gap.

**Generated variants:** Master Resume, ATS Resume,
Company-specific Resume, Role-specific Resume, One-page Resume, Research
Resume, Developer Resume, Student Resume, International Resume (format
conventions vary by region â€” e.g., photo/age conventions in some
markets, strict omission in others).

**Versioning:** every generated variant is linked back
to the master resume version it was generated from, so â€œwhy does my
Google-tailored resume say Xâ€ always has a traceable answer.

---

## 11. ATS Intelligence

A dedicated scoring and optimization layer, kept strictly separate
from the Resume Agent so that â€œwhat the resume saysâ€ and â€œhow a machine
will score itâ€ are independently auditable.

**Pipeline:** keyword extraction from the job
description â†’ gap analysis against the master resume â†’ skill matching â†’
resume scoring â†’ ATS pass-likelihood prediction â†’ specific, line-level
optimization suggestions â†’ missing-keyword detection â†’ a lightweight
â€œrecruiter simulationâ€ pass that flags issues a human skim would catch
that a keyword-matching ATS wouldnâ€™t (e.g., an unclear project
description, inconsistent date formatting).

**Critical design constraint carried over from the
MVP:** the ATS Agent never silently rewrites the resume. It
proposes specific changes, the Resume Agent (or the user directly)
applies them, and the change is versioned like any other edit.

---

## 12. Career Intelligence

Builds on the Job Search Agent (Â§9) to cover the full
career-management surface:

* Automated search across jobs, internships, fellowships, hackathons,
  scholarships, research opportunities, and competitions on every
  connected platform.
* After user approval: tailored resume and cover letter generation,
  form-filling and submission where a platformâ€™s API supports it,
  deep-linked tailored applications where it doesnâ€™t (Â§9, Job Search
  Agent).
* Application, status, interview, and offer tracking, all written to
  Career Memory.
* Success-probability estimation, based on the gap between the roleâ€™s
  requirements and the userâ€™s actual recorded skills â€” shown with its
  reasoning, never as an unexplained number.
* Generated learning roadmaps, interview-preparation roadmaps, and
  project roadmaps targeted at closing the specific gaps the system
  identified, not generic advice.
* Profile-update suggestions for connected platforms (e.g., â€œyour
  LinkedIn headline doesnâ€™t mention your strongest recent skillâ€) â€”
  suggested, never auto-published.

---

## 13. Gmail Intelligence

Extends the MVPâ€™s Gmail Agent (which already established the
scheduled-plus-push-hook pattern) with enterprise-scale classification
and action depth.

**Classification categories:** Interview, Placement,
Internship, Scholarship, Research, Hackathon, Exam, Assignment, Bills,
Important documents, Certificates, Government/University correspondence,
Spam.

**Per-category behavior:** task extraction, reminder
generation, automatic addition of relevant dates to the Schedule page,
calendar sync, thread summarization, suggested (never auto-sent)
replies, and a daily digest surfaced on the Dashboard.

**Deadline tracking:** every deadline extracted from
email is cross-referenced against the Scheduler for conflicts before
being added, so the user sees â€œthis overlaps with your exam on the 12thâ€
rather than two disconnected reminders.

---

## 14. Scheduler

A unified time-intelligence layer drawing from every other agent, not
a standalone calendar feature.

**Inputs it unifies:** calendar connector events,
Gmail-extracted deadlines, application deadlines from Career
Intelligence, exam and assignment dates, recurring personal items
(renewals, document expiries), and manually entered events.

**Capabilities:** conflict detection across all of the
above, priority-aware planning (an interview outranks a routine
reminder), AI-assisted scheduling suggestions, and recurring-reminder
management for anything periodic (passport/ID renewal, recurring
government filings).

---

## 15. Knowledge Workspace

The in-app environment for actually reading and working with content,
so the user never has to leave Vaeloom to open a source file.

**Rendering support:** PDF, DOCX, PPTX, XLSX, Markdown,
CSV, HTML, source code (syntax-highlighted), images, video, audio, Git
repository browsing, notebooks, and design files.

**Interaction layer:** inline annotation and
highlighting, AI chat scoped to the open document (â€œwhat does this paper
concludeâ€), cross-document linking (the system suggests related
documents based on the knowledge graph, not just folder proximity), and
direct navigation from any passage into the Memory Graph to see what
entities it connects to.

---

## 16. Dashboard

The single at-a-glance surface, composed entirely from other modules
rather than holding unique logic of its own:

Memory health (growth rate, consolidation status), knowledge growth
over time, career progress (applications, interviews, offers), active
projects, upcoming deadlines, goal progress, recent activity feed,
system-generated suggestions and insights, per-agent status (what each
agent has done recently, any that need attention), and overall workspace
health (unorganized files, stale connectors).

---

## 17. Application Pages

| Page | Purpose |
| --- | --- |
| Dashboard | At-a-glance summary across every module |
| Workspace | File/folder browser with in-app viewer |
| Knowledge | Cross-document knowledge exploration |
| Memory Graph | Visual, navigable knowledge graph |
| Timeline | Chronological view across episodic memory |
| Documents | Full document library |
| Folders | Structural file navigation |
| Projects | Project-centric view of work |
| Resume | Master resume + variants + version history |
| Career | Career trajectory, goals, skill growth |
| Applications | Application tracker |
| Jobs | Job/internship search and shortlist |
| Learning | Courses, skills in progress, learning roadmap |
| Certificates | Certificate/credential library |
| Chat | Conversational interface to the Orchestrator and any agent |
| AI Agents | Per-agent status, permissions, and autonomy settings |
| Calendar | Full calendar view |
| Schedule | Deadlines and time-sensitive items |
| History | Complete activity/audit log |
| Notifications | Alerts and reminders |
| Connectors | Connector management |
| Plugins | Installed plugin management |
| Providers | Model/provider configuration (enterprise/dev) |
| Settings | Account, privacy, autonomy, data controls |
| Analytics | Usage and pattern insights |
| Security | Access logs, permission review |
| Admin | Tenant-level controls (enterprise only) |
| Developer Mode | Plugin/SDK testing surface |

---

## 18. Global Search

A single search surface spanning the entire memory system: documents,
memory records, projects, chat history, connected email, files, notes,
calendar, and the knowledge graph itself, plus code search within
connected repositories.

**Retrieval approach:** the same agentic, hybrid
retrieval used internally by agents (Â§8.4) is exposed directly to the
user â€” semantic search, hybrid search, and natural-language query
support (â€œthings I did related to machine learning last semesterâ€)
rather than keyword-only search.

---

## 19. Security & Compliance

### 19.1 Authentication & access

Enterprise SSO (SAML/OIDC) alongside standard email auth; OAuth for
every connector with scoped, refreshable tokens; role-based access
control (RBAC) at the tenant level for enterprise accounts (e.g., a
university career office role that can see aggregated, consented data
but never individual memory contents).

### 19.2 The consent model

This is the piece that makes the enterprise (tenant-provisioned) case
work without compromising the core promise that a personâ€™s memory
belongs to them: an organization can provision an account and set policy
boundaries (which connectors are allowed, retention windows), but cannot
read an individualâ€™s memory contents without that individualâ€™s explicit,
granular consent â€” and consent is always revocable, with the
organizationâ€™s access reduced going forward (not retroactively granted
access to history beyond what was previously authorized).

### 19.3 Permission Engine

A single, central system every connector and agent action is checked
against â€” not per-feature ad hoc permission checks scattered through the
codebase. Permissions are scoped along three axes: connector (what
external system), action type (read / write / act), and agent (which
specific agent is requesting). This is what makes the Plugin sandboxing
(Â§5.2) and agent autonomy progression (Â§7.4, Â§9) enforceable rather than
aspirational.

### 19.4 Encryption & secrets

Encryption at rest and in transit across all stores; OAuth tokens and
API keys held in a dedicated secrets manager, never in application
database rows.

### 19.5 Zero trust & sandboxing

No implicit trust between services â€” every internal call is
authenticated and scoped, including agent-to-agent calls through the
Orchestrator. Plugins run in a sandboxed execution context with no
access beyond their declared manifest scopes (Â§5.2).

### 19.6 Privacy controls & data retention

Per-memory-type visibility settings, a single â€œexport everythingâ€
action producing a complete, portable archive, and a single â€œdelete
everythingâ€ action that is immediate and verifiable â€” both present from
the MVP and preserved at enterprise scale, plus configurable retention
windows for enterprise tenants where regulatory requirements demand
them.

### 19.7 Audit logging

Every read and write to memory, every agent action, and every
permission grant or revocation is logged in an append-only audit trail,
queryable from the History page (Â§17) and exportable for enterprise
compliance review.

### 19.8 Regional compliance

Data residency options for enterprise tenants (EU, US, India data
regions at minimum given the initial target markets), and a compliance
posture designed around the strictest applicable regime (effectively
GDPR-shaped controls â€” explicit consent, right to access, right to
erasure â€” applied universally) rather than a different privacy posture
per region.

---

## 20. AI Architecture

### 20.1 Model layer

Multi-model orchestration rather than a single hardcoded model:
different agents route to the model best suited to their task (a fast,
cheap model for classification-heavy work like the Gmail Agent; a
stronger reasoning model for the Job Search Agentâ€™s matching logic)
through a central model router, with fallback models configured per
agent so a provider outage degrades gracefully rather than failing the
whole platform.

### 20.2 Agent framework

Every agent shares a common runtime: tool-calling against its
declared tool list, structured prompt management (versioned, testable
prompts rather than inline strings), and a standard event format for
Orchestrator-mediated inter-agent communication.

### 20.3 Memory & retrieval infrastructure

Described in full in Â§8 â€” a graph database plus a vector store,
accessed through the agentic RAG retrieval layer, with embedding models
chosen for semantic fidelity over raw size given the cost/latency
tradeoffs at scale.

### 20.4 Data & job infrastructure

Object storage for raw documents (encrypted, Â§19.4), background
workers and queues for ingestion and the file pipeline (Â§6), and
streaming response delivery for chat and long-running agent tasks so the
user sees progress rather than waiting on a black box.

### 20.5 Observability & reliability

Per-agent evaluation suites (did this agentâ€™s last 100 categorization
proposals get approved or corrected?) feeding directly into the
Self-Improvement Agent (Â§9); full request tracing across the agent â†’
tool-call â†’ memory-write chain; self-healing retry logic for transient
connector failures; and cost/latency dashboards per agent so model
routing decisions are made on real data, not assumption.

### 20.6 Cost & latency optimization

Debounced re-processing (donâ€™t re-embed a file on every touch, only
on meaningful content change â€” carried over from the MVPâ€™s explicit
gap-fill), cached retrieval for repeated query patterns, and tiered
model routing (Â§20.1) as the primary cost lever, rather than degrading
memory quality to save compute.

---

## 21. Future Innovations

Looking five to ten years out, beyond whatâ€™s specified above:

* **Personal Digital Twin** â€” a queryable model of the
  personâ€™s capabilities and history accurate enough to answer questions on
  their behalf (with explicit permission, in narrow contexts like a
  recruiter screening question).
* **Continuous Learning AI** â€” agents that donâ€™t just
  store what happened but actively identify what the user should learn
  next, integrated directly with the Learning Agentâ€™s roadmap output.
* **Autonomous Career Manager** â€” at full earned trust, a
  mode where the Career Intelligence system manages an active job search
  end-to-end within boundaries the user set once, rather than requiring
  per-application approval.
* **Life Timeline Intelligence** â€” a fully connected view
  across Episodic and Timeline memory spanning years, surfacing â€œyouâ€™ve
  grown most in Xâ€ retrospectives no human would compile by hand.
* **Knowledge Evolution Engine** â€” tracking not just what
  the user knows now but how their understanding of a topic has changed
  over time.
* **AI Mentor** â€” a persona-consistent guidance layer
  drawing on the full memory graph, distinct from the task-focused agents,
  focused on longer-horizon advice.
* **AI Interviewer** â€” mock interview practice generated
  from the actual job descriptions the user is pursuing, scored against
  their actual resume gaps.
* **AI Portfolio Builder** â€” automatic portfolio site
  generation from Project and Document memory, kept current the same way
  the resume is.
* **Research Discovery Agent** â€” proactively surfaces new
  papers/resources relevant to the userâ€™s demonstrated research
  interests.
* **Opportunity Radar** â€” a standing background search
  (distinct from on-demand Job Search) that surfaces relevant
  opportunities the user didnâ€™t think to look for.
* **Personal Cognitive Graph** â€” an explicit model of how
  the user thinks and learns best, used to tailor how the system explains
  things to them.
* **Cross-Agent Collaboration Protocols** â€” richer,
  negotiated task handoffs between agents for compound requests (â€œhelp me
  decide between these two offersâ€ touching Career, Preference, and Goal
  memory simultaneously).
* **Natural-Language Operating Surface** â€” reducing the
  gap between â€œwhat page is this feature onâ€ and â€œjust ask for it,â€ with
  the chat interface able to trigger any page-level action.
* **Voice-first Workspace** â€” for in-the-moment capture
  (e.g., dictating a reflection right after an interview) without breaking
  flow to open the app.
* **Multimodal Memory** â€” first-class memory of images,
  audio, and video content at the same depth as text today.
* **Predictive Planning** â€” surfacing likely future
  conflicts or opportunities before theyâ€™re imminent, not just tracking
  known deadlines.
* **Context-Aware Automation** â€” autonomy that adapts to
  situational context (e.g., more conservative during exam season when the
  user has less attention to review proposals).
* **Personal AI APIs** â€” letting a user expose narrow,
  permissioned slices of their own memory to other tools they trust,
  turning Vaeloom into infrastructure other products can build on top
  of.

---

## 22. Gap Analysis & Missing Features

A structured pass over what this paper hasnâ€™t yet specified in depth,
and where it lives.

| Area | Current state in this paper | Whatâ€™s still needed |
| --- | --- | --- |
| Scalability | Multi-model routing, queue-based ingestion specified | Detailed capacity planning, multi-region failover design |
| UX refinement | Page-level IA specified (Â§17) | Full interaction design, accessibility audit |
| AI opportunities | Future Innovations (Â§21) | Prioritization against actual user research |
| Automation depth | Autonomy progression model specified (Â§7.4, Â§9) | Concrete thresholds and UI for trust-building flows |
| Monetization | Not yet specified | Pricing model (individual vs.Â seat-based enterprise), free-tier boundaries |
| Business model | Not yet specified | Go-to-market sequencing (student wedge â†’ professional â†’ enterprise, per Â§1.6) |
| SaaS architecture | Multi-tenant consent model specified (Â§19.2) | Full tenant isolation and provisioning architecture |
| Enterprise edition | Admin/RBAC sketched (Â§17, Â§19.1) | Full admin console spec, SSO provider matrix |
| Education edition | Persona identified (Â§2.1) | Institution-specific features (cohort analytics, career-office tooling) |
| API platform | SDK sketched (Â§5.4) | Public API documentation, rate-limit tiers, versioning policy |
| Marketplace | Plugin architecture specified (Â§5.2) | Discovery, review, revenue-share model for third-party plugins |
| Mobile | Listed as an access surface (Â§5.1) | Mobile-specific feature scoping (whatâ€™s full-parity vs.Â companion-only) |
| Desktop | Companion app specified for local folder access | Broader desktop feature set beyond the file-watcher role |
| Future research | Future Innovations (Â§21) | Formal research agenda and evaluation methodology |

This table is the honest state of the paper: deep on product, memory,
and agent architecture because thatâ€™s the core differentiator;
intentionally light on business model and infra capacity planning
because those depend on data this paper doesnâ€™t have yet â€” real usage
from the MVP.

---

## 23. From MVP to Enterprise â€” Migration Path

The MVP (companion spec) and this paper are designed to be the same
system at two points in time, not two different systems:

1. **Memory schema compatibility.** The MVPâ€™s six memory
   types are a strict subset of the enterprise taxonomy (Â§8.1) â€” no
   migration or re-ingestion required, only additive schema growth.
2. **Agent roster growth, not replacement.** The MVPâ€™s
   eight agents map directly onto eight of this paperâ€™s twenty-eight; the
   rest are net-new additions operating on the same memory, not
   replacements requiring re-architecture.
3. **Connector-shape consistency.** Every connector, from
   MVP through enterprise, is built MCP-shaped from the start (MVP Â§6, this
   paper Â§5.3) specifically so the connector catalog can grow without a
   transport-layer rewrite.
4. **Permission model continuity.** The MVPâ€™s
   â€œsuggest-mode by default, earned autonomyâ€ principle (MVP Â§3, Â§12) is
   the same model formalized into the Permission Engine (Â§19.3) here â€”
   enterprise doesnâ€™t introduce a new trust model, it makes the existing
   one tenant-aware.
5. **Whatâ€™s genuinely new at enterprise scale:**
   multi-tenancy and the consent model that makes organization-provisioned
   accounts safe (Â§19.2), the full plugin/MCP ecosystem and SDK (Â§5), RBAC
   and admin tooling (Â§17, Â§19.1), and the broader connector and agent
   catalogs (Â§5.1, Â§9.2). These are additive surfaces, not corrections to
   the MVPâ€™s foundation.

---

## 24. Appendix: Glossary

**Agentic RAG** â€” retrieval where the calling agent
selects the retrieval strategy (vector, keyword, graph, or a
combination) per query, rather than a single fixed pipeline.

**Consolidation** â€” the periodic process of merging
duplicate or near-duplicate memory records into one canonical
record.

**Knowledge graph** â€” the structured store of entities
and typed relationships between them, distinct from but complementary to
the vector store.

**MCP (Model Context Protocol)** â€” the tool-calling
shape Vaeloomâ€™s connectors and plugins are built around, enabling both
consumption of external MCP servers and exposure of Vaeloomâ€™s own
capabilities to other tools.

**Memory Agent** â€” the internal agent responsible for
extracting, merging, and writing all other agentsâ€™ outputs into the
knowledge graph and vector store.

**Permission Engine** â€” the central system enforcing
scoped access across every connector, agent, and plugin action.

**Provenance** â€” the traceable link from any stored fact
back to the source document or event that produced it.

**Suggest-mode** â€” the default operating mode for any
agent capable of taking a consequential action: propose, donâ€™t execute,
until the user grants standing autonomy for that specific action
type.

**Vector store** â€” the embedding-based store enabling
semantic similarity search over document and conversation content.

Vaeloom Â· ENTERPRISE PRODUCT VISION PAPER