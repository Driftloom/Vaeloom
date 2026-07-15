Meridian · System Architecture

# Six layers, one spine of memory

Every layer exists to feed the one in the middle. Interfaces and connectors bring data in; agents act on it; everything that happens gets written back to memory — which is what every feature above ultimately reads from.

01

## Interface Layer

Where the person actually touches the product.

Web AppPrimary surface — all pages live here

Desktop CompanionScoped local-folder access, file watcher

VS Code ExtensionWorkspace + git activity, on-demand summaries

Mobile (future)Push notifications, quick capture

02

## Connectors & Plugin Layer

Scoped, OAuth-based access — read-only until the user grants more.

GmailOAuth, read + draft scope only

GitHubRepos, commits, README content

Google DriveDocs, Sheets, Slides

Local FolderOne scoped directory, not full disk

Plugin SDKMCP-shaped tool schema for new connectors

03

## Ingestion Engine

Turns raw files into something agents can reason about.

Document ParserPDF, DOCX, PPT, XLSX, CSV

OCRScanned certificates, transcripts

Code UnderstandingRepo structure, README, language detection

Semantic ExtractorEntities, relationships, summaries

Dedup & Version DetectorMerges duplicate / versioned files

04

## Agent Orchestration

Specialized agents, each scoped to one job and one tool list.

OrchestratorRoutes chat & requests to the right agent

Organization AgentNaming, foldering, dedup proposals

Resume AgentBuilds & maintains the master resume

ATS AgentScores resume against a job description

Job Search AgentFinds, ranks, and shortlists roles

Gmail AgentClassifies mail, extracts deadlines

Scheduler AgentDeadlines, reminders, conflict checks

05

## Memory & Knowledge Layer — CORE

Everything above reads from and writes to this layer. This is the actual product.

Knowledge GraphEntities + typed relationships

Vector StoreSemantic embeddings for search

Structured MemoryProfile / Career / Episodic / Preference

Agentic RAGHybrid retrieval + relevance re-ranking

ConsolidationCompresses & archives stale memory over time

06

## Storage & Security

The floor every other layer stands on.

Encrypted StorageDocuments & memory at rest

Secrets ManagerOAuth tokens, never in plaintext

Permission EnginePer-connector, per-agent scopes

Audit LogEvery agent action, reversible

● Core layer — the knowledge graph + memory store everything else depends on

Read access is default · Write access is always a separate, explicit grant