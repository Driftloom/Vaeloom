/**
 * Offline capability catalog + workspace-local capability storage.
 *
 * WHY the seed below exists at all: it is a FALLBACK. The server catalog
 * (`GET /capabilities/catalog`, landing with the 0062 migration) is
 * authoritative for the Skills tab. This array only keeps SSR and offline
 * renders from rendering an empty page, so it is deliberately small and every
 * value in it is either verified against the backend registry or explicitly
 * marked unknown.
 *
 * Every `usageCount` is 0 and every `lastUsedAt` is null because there is no
 * backend column and no write path for either. The previous build shipped
 * invented numbers (e.g. 1420) and invented recency phrases ("10m ago") that
 * the Skills tab then sorted on as if they were telemetry. A skill that has
 * never executed has never been used; stamping a count on it is a lie that the
 * UI renders as fact.
 *
 * `requiredScope` values below are taken from `apps/api/src/api/tools/definitions.py`
 * (static tools), `services/mcp_client_service.py` (bridged MCP tools) and
 * `routers/capabilities.py` (custom tools, which get `tool.<name>`). Do not add
 * a scope here that the backend does not emit — an unrecognised scope fails
 * closed at execution time with a permission error the user cannot act on.
 *
 * `trustClass` mirrors what the backend emits: `core_trusted` for static tools,
 * `mcp.read` / `mcp.workspace.write` for bridged MCP servers. `community` marks
 * third-party-sourced skills, which are never first-party regardless of how
 * they are bundled.
 */

export type CapabilityCategory = 'agents' | 'skills' | 'tools' | 'mcp' | 'plugins' | 'connectors';

export type CapabilityTrustClass =
  | 'core_trusted'
  | 'first_party'
  | 'community'
  | 'mcp.read'
  | 'mcp.workspace.write'
  | 'mcp.external.write'
  | 'untrusted';

export type CapabilityAutonomy = 'suggest' | 'autonomous' | 'approval_required';

export interface CapabilityItem {
  id: string;
  name: string;
  category: CapabilityCategory;
  tags: string[];
  description: string;
  enabled: boolean;
  source: 'built-in' | 'learned' | 'custom' | 'mcp' | 'community';
  /** Real executions of this capability in this workspace. 0 until a write path exists. */
  usageCount: number;
  /** ISO 8601 of the last execution, or null when the capability has never run. */
  lastUsedAt: string | null;
  /** Optional backward-compatible alias for lastUsedAt */
  lastUsed?: string | null;
  requiredScope?: string;
  trustClass?: CapabilityTrustClass;
  rateLimit?: string;
  triggers?: string[];
  autonomy?: CapabilityAutonomy;
  toolsUsed?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  markdownDoc: string;
  version?: string;
  author?: string;
}

export const SEED_CAPABILITIES: CapabilityItem[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // AGENTS (9 canonical & specialized agents)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'agent-organization',
    name: 'organization',
    category: 'agents',
    tags: ['Core', 'Autonomous', 'Filesystem'],
    description:
      'Autonomous workspace organizer that routes incoming files, performs semantic deduplication, and maintains taxonomy structures.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.write',
    trustClass: 'core_trusted',
    autonomy: 'autonomous',
    toolsUsed: ['search_documents', 'query_graph', 'create_entity', 'merge_entities'],
    version: '2.4.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Organization Agent

## Mission
Maintains order across workspace document hierarchies, detects duplicate files, normalizes metadata tags, and categorizes unstructured uploads into canonical collections.

## Autonomous Triggers
- \`file.uploaded\` event via S3 / local vault
- Daily midnight hygiene sweep (cron: \`0 0 * * *\`)
- Explicit command: "/organize workspace"

## Operating Rules
1. Never hard-delete original source documents; always archive or soft-link duplicate representations.
2. Group files according to taxonomy clusters derived from semantic cosine embeddings (>0.82 similarity).
3. Notify the user with a daily summary diff when more than 5 documents are relocated.
`,
  },
  {
    id: 'agent-memory',
    name: 'memory',
    category: 'agents',
    tags: ['Core', 'Graph', 'Semantic'],
    description:
      'Knowledge graph memory consolidation engine that extracts entities, resolves relationships, and manages episodic recall.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read,memory.write',
    trustClass: 'core_trusted',
    autonomy: 'autonomous',
    toolsUsed: ['query_graph', 'get_entity', 'create_entity', 'merge_entities', 'search_documents'],
    version: '3.1.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Memory Agent

## Mission
Extracts persistent entities, cross-document relations, and user preferences from ongoing conversations and documents into the sovereign knowledge graph.

## Capabilities
- **Entity Extraction**: Identifies people, projects, companies, skills, and tools.
- **Knowledge Graph Topology**: Creates typed edges with bidirectional weights and confidence scores.
- **Episodic Decay & Reinforcement**: Boosts entity saliency upon repeated mention; archives stale orphaned nodes.
`,
  },
  {
    id: 'agent-resume',
    name: 'resume',
    category: 'agents',
    tags: ['Career', 'Documents', 'Playwright'],
    description:
      'Generates tailored PDF/DOCX resumes from master career profiles matching target job descriptions.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read,system.document.compile',
    trustClass: 'first_party',
    autonomy: 'suggest',
    toolsUsed: [
      'calculate_semantic_ats_score',
      'extract_missing_hard_skills',
      'compile_resume_pdf',
    ],
    version: '2.0.0',
    author: 'Vaeloom Career Suite',
    markdownDoc: `# Resume Agent

## Mission
Compiles high-scoring, ATS-optimized single and two-page resumes tailored to specific job requisitions using Playwright Chromium headless rendering.

## Key Features
- **Dynamic Type Shrinking**: Auto-calculates font line-height and margin scale to strictly respect 1-page bounds.
- **Industry Templates**: Tech Modern, Executive Serif, Classic Corporate, Minimalist Mono, Creative Grid.
- **Artifact Pipeline**: Generates PDF, DOCX, and interactive Markdown live previews.
`,
  },
  {
    id: 'agent-ats',
    name: 'ats',
    category: 'agents',
    tags: ['Career', 'Audit', 'Analytics'],
    description:
      'Analyzes resume content against employer Applicant Tracking Systems (ATS) algorithms to maximize callback probabilities.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    trustClass: 'first_party',
    autonomy: 'suggest',
    toolsUsed: [
      'calculate_semantic_ats_score',
      'extract_missing_hard_skills',
      'audit_ats_formatting',
    ],
    version: '1.8.0',
    author: 'Vaeloom Career Suite',
    markdownDoc: `# ATS Audit Agent

## Mission
Audits formatting, parses section hierarchies, and performs cosine vector similarity matching between resume bullet points and job requirement keywords.

## Diagnostic Metrics
- Overall ATS Pass Score (0 - 100)
- Hard Skill Match vs Soft Skill Density
- Section Header Compliance (Work Experience, Education, Technical Skills)
- Disallowed Formatting Flags (Tables, multi-column text boxes, low-contrast text)
`,
  },
  {
    id: 'agent-job-search',
    name: 'job_search',
    category: 'agents',
    tags: ['Career', 'Scraping', 'Browser'],
    description:
      'Monitors career boards, aggregates postings, ranks opportunities by relevance, and flags compensation mismatches.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.browser.read,connector.jobs.read',
    trustClass: 'first_party',
    autonomy: 'autonomous',
    toolsUsed: ['browse_job_page', 'scrape_company_insights', 'verify_application_link'],
    version: '2.1.0',
    author: 'Vaeloom Career Suite',
    markdownDoc: `# Job Search Agent

## Mission
Continuously monitors hiring portals, Glassdoor/LinkedIn public links, and Greenhouse/Lever boards with rate-limited headless browser scraping.

## Safety & Limits
- Honors hourly quota limits (\`SCRAPE_QUOTA_PER_HOUR = 20\`).
- Enforces strict SSRF guards on external URLs.
- Flags expired job listings with \`expired_or_error\` status.
`,
  },
  {
    id: 'agent-application',
    name: 'application',
    category: 'agents',
    tags: ['Career', 'Approval-Gated'],
    description:
      'Drafts tailored cover letters and job application submissions with mandatory human-in-the-loop approval gates.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.jobs.read,connector.gmail.write',
    trustClass: 'first_party',
    autonomy: 'approval_required',
    toolsUsed: ['draft_email', 'verify_application_link'],
    version: '1.5.0',
    author: 'Vaeloom Career Suite',
    markdownDoc: `# Application Agent

## Mission
Prepares tailored application packages including cover letters, portfolio blurbs, and questionnaire answers.

## Human-in-the-Loop Safeguard
All submissions and external message drafts require an explicit approval token signed in the Sovereign Vault before execution.
`,
  },
  {
    id: 'agent-gmail',
    name: 'gmail',
    category: 'agents',
    tags: ['Communication', 'Email', 'Recruiter'],
    description:
      'Monitors communication channels for interview requests, recruiter correspondence, and job offer updates with approval gating.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.gmail.read,connector.gmail.write',
    trustClass: 'first_party',
    autonomy: 'approval_required',
    toolsUsed: ['search_gmail', 'draft_email'],
    version: '2.1.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Gmail & Communication Agent

## Mission
Scans connected mailboxes for recruiter outreaches, interview invitations, and status changes. Surfaces interview time slots and drafts responses for human confirmation.

## Guardrails
- Never dispatches emails autonomously.
- Generates outbound email drafts in holding state awaiting user sign-off in the Sovereign Vault.
`,
  },
  {
    id: 'agent-scheduler',
    name: 'scheduler',
    category: 'agents',
    tags: ['Operations', 'Calendar', 'Temporal'],
    description:
      'Orchestrates recurring jobs, resolves calendar conflicts, and schedules agent task execution timelines.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.calendar.read,connector.calendar.write',
    trustClass: 'core_trusted',
    autonomy: 'autonomous',
    toolsUsed: ['list_calendar_events', 'create_calendar_event'],
    version: '2.3.0',
    author: 'Vaeloom Operations',
    markdownDoc: `# Scheduler Agent

## Mission
Integrates Google Calendar and Temporal workflows to manage meeting prep agendas, recurring agent reminders, and conflict resolution.
`,
  },
  {
    id: 'agent-self-improvement',
    name: 'self_improvement',
    category: 'agents',
    tags: ['Meta', 'Evals', 'Reinforcement'],
    description:
      'Monitors agent trajectories, audits execution success rates, critiques errors, and proposes refined prompt instructions.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read,workspace.write',
    trustClass: 'core_trusted',
    autonomy: 'suggest',
    toolsUsed: ['search_documents', 'query_graph'],
    version: '1.2.0',
    author: 'Vaeloom Labs',
    markdownDoc: `# Self Improvement Agent

## Mission
Implements automated critique and RLAIF reflection loops over completed agent sessions to incrementally improve execution fidelity.
`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SKILLS (12 behavioral skills)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'skill-acceptance-criteria-review',
    name: 'acceptance-criteria-review',
    category: 'skills',
    tags: ['QA', 'Testing'],
    description:
      'Use this skill when you need to review acceptance criteria for ambiguity, missing rules, and verifiability; triggers include acceptance criteria review.',
    enabled: true,
    source: 'learned',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['acceptance criteria review', 'review criteria', 'audit requirements'],
    version: '1.2.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Acceptance Criteria Review

## When to Use
- Use this skill when you need to turn requirements and user stories into verifiable, unambiguous acceptance criteria that cover failure paths.
- Use it to review an existing plan, result, or evidence set and produce actionable improvements.
- Use it when context is incomplete but a bounded first pass is still valuable.

## Output Format Options
- Default to Markdown for review, execution, and incremental refinement.
- When the user requests tables, CSV, JSON, or ticket fields, preserve risk, evidence, priority, and boundary information.
- For machine-consumed output, confirm the schema, enums, and required fields first.

## How to Use
1. Read and follow input contract, execution rules, minimum coverage, and output order.
2. Add only context that changes the decision: scope, environment, version, constraints, evidence, and success criteria.
3. Audit the input, then separate confirmed facts, working assumptions, and open questions.
4. Rank by risk and evidence strength, and produce an artifact that can be executed or reviewed directly.
`,
  },
  {
    id: 'skill-accessibility-testing',
    name: 'accessibility-testing',
    category: 'skills',
    tags: ['A11y', 'WCAG'],
    description:
      'Conduct WCAG 2.1 AA audits across web UI surfaces, inspecting contrast ratios, screen reader semantics, and focus traps.',
    enabled: true,
    source: 'learned',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.browser.read',
    triggers: ['audit a11y', 'check accessibility', 'wcag review'],
    version: '1.0.4',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Accessibility Testing & WCAG Audit

## Key Verification Criteria
- **Contrast**: Minimum 4.5:1 for standard text; 3:1 for large display titles and active icons.
- **Focus Rings**: 2-4px visible focus indicators on all interactive elements.
- **Keyboard Navigation**: Complete tab traversal parity with visual layout; no keyboard traps.
- **Screen Reader Semantics**: aria-labels for icon buttons; landmark regions (\`nav\`, \`main\`, \`aside\`).
`,
  },
  {
    id: 'skill-agent-building',
    name: 'agent-building',
    category: 'skills',
    tags: ['Agent', 'Architecture'],
    description:
      'Comprehensive blueprint for designing, implementing, testing, and hardening autonomous AI agents from scratch.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'agent.spawn',
    triggers: ['build agent', 'design new agent', 'agent architecture'],
    version: '2.1.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Agent Building Architecture Blueprint

## Core Pillars
1. **BaseAgent Contract**: Strict lifecycle states (\`idle\`, \`running\`, \`waiting_for_approval\`, \`errored\`, \`completed\`).
2. **Typed Tools**: Explicit JSON schemas and scoped IAM tokens.
3. **ReAct Loop**: Structured Reasoning, Action Selection, Observation, Reflection.
4. **Approval Gate**: Human-in-the-loop intercepts before state-mutating or irreversible side-effects.
`,
  },
  {
    id: 'skill-agentic-workflows',
    name: 'agentic-workflows',
    category: 'skills',
    tags: ['Agent', 'Workflows'],
    description:
      'Architecture, design patterns, and operational standards for autonomous agentic workflows, sub-goal decomposition, and memory tiers.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'agent.spawn',
    triggers: ['agentic workflow', 'react loop', 'subgoal decomposition'],
    version: '1.8.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Agentic Workflows Standard

## Architectural Patterns
- **Supervisor-Worker**: Orchestrator delegates bounded subtasks to specialized subagents.
- **Consensus & Peer Review**: Critical outputs evaluated by independent verifier agents before finalizing.
- **Deterministic Fallbacks**: Graceful degradation when external models or APIs throttle.
`,
  },
  {
    id: 'skill-autoplan',
    name: 'autoplan',
    category: 'skills',
    tags: ['Review', 'GStack'],
    description:
      'Auto-review pipeline running CEO, design, eng, and DX reviews sequentially with auto-decisions using 6 principles.',
    enabled: true,
    source: 'learned',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read,workspace.write',
    triggers: ['autoplan', 'run all reviews', 'automatic review pipeline'],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Autoplan — Auto-Review Pipeline

## The 6 Decision Principles
1. **Choose completeness** — Ship the whole thing. Cover edge cases.
2. **Boil lakes** — Fix everything in the blast radius (<5 files, no new infra).
3. **Pragmatic** — If two options fix the same thing, pick the cleaner one.
4. **DRY** — Duplicates existing functionality? Reject.
5. **Explicit over clever** — 10-line obvious fix > 200-line abstraction.
6. **Bias toward action** — Merge > review cycles > stale deliberation.
`,
  },
  {
    id: 'skill-ats-resume-builder',
    name: 'ats-resume-builder',
    category: 'skills',
    tags: ['Career', 'Templates'],
    description:
      'Parses job descriptions, matches skill gaps, tailors achievement bullets, and compiles clean single-page PDF resumes.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read,system.document.compile',
    triggers: ['build resume', 'tailor resume', 'ats match'],
    version: '2.0.0',
    author: 'Vaeloom Career Suite',
    markdownDoc: `# ATS Resume Builder

## Workflow
1. Ingest Master Profile and Job Description.
2. Extract missing technical keywords and soft skills.
3. Rewrite achievement bullets using Google XYZ formula (*Accomplished [X] as measured by [Y] by doing [Z]*).
4. Render using Jinja2 + Chromium page-fit loop to ensure exact page constraint.
`,
  },
  {
    id: 'skill-check-work',
    name: 'check-work',
    category: 'skills',
    tags: ['QA', 'Verification'],
    description:
      'Verification subagent that reviews git diffs, executes test suites, checks linting, and validates functional correctness.',
    enabled: true,
    source: 'learned',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'workspace.write',
    triggers: ['check work', 'verify changes', 'self-verify'],
    version: '1.1.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Check Work Verification Protocol

## Verification Steps
1. Review git status and modified file boundaries.
2. Run test suites and record pass/fail counts.
3. Check TypeScript typecheck and ESLint diagnostics.
4. Ensure no uncommitted scratch files or debug statements remain.
`,
  },
  {
    id: 'skill-deep-learning-rag-evals',
    name: 'deep-learning-rag-evals',
    category: 'skills',
    tags: ['AI', 'RAG'],
    description:
      'Evaluates vector embeddings, hybrid dense-sparse retrieval, cross-encoder rerankers, and context recall metrics.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['eval rag', 'rag metrics', 'retrieval benchmark'],
    version: '1.4.0',
    author: 'Vaeloom Labs',
    markdownDoc: `# RAG Evaluation Framework

## Core Retrieval Metrics
- **Faithfulness**: Proportion of claims in generated answer directly groundable in retrieved contexts.
- **Answer Relevance**: Semantic similarity of response to user query intent.
- **Context Recall**: Ratio of relevant ground-truth facts successfully retrieved.
`,
  },
  {
    id: 'skill-frontend-design',
    name: 'frontend-design',
    category: 'skills',
    tags: ['Design', 'UI-UX'],
    description:
      'Guidance for distinctive, intentional visual design, typography, spacing hierarchies, and theme token alignment.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'workspace.write',
    triggers: ['frontend design', 'polish ui', 'design system'],
    version: '2.2.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Frontend Design Standard

## Core Directives
- **Ground it in the subject**: Never generic AI defaults; design specifically for the product domain.
- **Structure is Information**: Dividers, labels, badges, and counters encode meaning, not empty decoration.
- **Restraint & Self-Critique**: Spend your boldness in one place; keep surrounding elements disciplined.
- **Typography**: Intentional weight scales, tabular numbers for data, readable line measures.
`,
  },
  {
    id: 'skill-llm-engineering',
    name: 'llm-engineering',
    category: 'skills',
    tags: ['AI', 'Prompts'],
    description:
      'Production-grade LLM engineering, structured output enforcement (Pydantic/JSON schema), prompt caching, and token budgeting.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['prompt engineering', 'structured outputs', 'token budget'],
    version: '2.5.0',
    author: 'Vaeloom Labs',
    markdownDoc: `# LLM Engineering Best Practices

## Guidelines
- Strict Pydantic JSON schema constraints on all model tool calls.
- Multi-tiered fallback: Fast lightweight model -> High reasoning model on validation failure.
- Deterministic few-shot exemplar anchors for predictable schema synthesis.
`,
  },
  {
    id: 'skill-system-design',
    name: 'system-design',
    category: 'skills',
    tags: ['Infra', 'Distributed'],
    description:
      'Enterprise distributed systems engineering: high-availability, sharding, caching topologies, and disaster recovery.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read,workspace.write',
    triggers: ['system design', 'architecture review', 'dr drill'],
    version: '1.3.0',
    author: 'Vaeloom Infra',
    markdownDoc: `# Enterprise System Design

## Architecture Tenets
- Multi-tenant tenant isolation with Postgres Row-Level Security (RLS).
- Asynchronous durable workflows via Temporal.
- Zero-trust inter-service tokens and encrypted secrets.
`,
  },
  {
    id: 'skill-ui-ux-pro-max',
    name: 'ui-ux-pro-max',
    category: 'skills',
    tags: ['Design', 'Intelligence'],
    description:
      'UI/UX design intelligence containing 99 guidelines, WCAG AA standards, interaction rules, and responsive patterns.',
    enabled: true,
    source: 'learned',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'workspace.write',
    triggers: ['ui-ux-pro-max', 'audit ux', 'enterprise polish'],
    version: '3.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# UI/UX Pro Max Design Intelligence

## Priority Hierarchy
1. **Accessibility**: 4.5:1 contrast ratio, alt-text, visible focus rings, keyboard tab order.
2. **Touch & Interaction**: Minimum 44x44px target bounds, 150-300ms micro-interactions.
3. **Typography & Rhythm**: 4/8dp incremental spacing grid, tabular numbers for metrics.
4. **Error Recovery**: Immediate inline contextual feedback with actionable remedy links.
`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // TOOLS (6 typed execution tools)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'tool-search-documents',
    name: 'search_documents',
    category: 'tools',
    tags: ['Memory', 'First-Party', 'Search'],
    description:
      'Search across user documents using dense semantic vector search with keyword fallback.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    trustClass: 'core_trusted',
    rateLimit: '200/min',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query string' },
        limit: { type: 'integer', default: 10, description: 'Maximum items to retrieve' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'array',
      items: { $ref: 'Document' },
    },
    markdownDoc: `# search_documents

Executes hybrid semantic cosine vector search across all indexed workspace documents, PDF extractions, and notes.

### Permissions
Requires \`memory.read\` scope within the calling workspace.
`,
  },
  {
    id: 'tool-query-graph',
    name: 'query_graph',
    category: 'tools',
    tags: ['Memory', 'First-Party', 'Graph'],
    description: 'Query knowledge graph for entities, typed attributes, and relational edges.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    trustClass: 'core_trusted',
    rateLimit: '150/min',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Target entity label or relationship description' },
        entity_type: {
          type: 'string',
          default: 'any',
          description: 'Filter by entity type (person, skill, company, etc.)',
        },
        limit: { type: 'integer', default: 20, description: 'Maximum edges to traverse' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'array',
      items: { $ref: 'GraphNode' },
    },
    markdownDoc: `# query_graph

Performs relational subgraph traversal on the sovereign knowledge graph, returning node clusters and weighted connecting edges.
`,
  },
  {
    id: 'tool-calculate-semantic-ats-score',
    name: 'calculate_semantic_ats_score',
    category: 'tools',
    tags: ['Career', 'First-Party', 'ATS'],
    description:
      'Calculate cosine embedding similarity score between resume text and a job requisition.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    trustClass: 'core_trusted',
    rateLimit: '60/min',
    inputSchema: {
      type: 'object',
      properties: {
        resume_text: { type: 'string' },
        job_description: { type: 'string' },
        target_title: { type: 'string' },
      },
      required: ['resume_text', 'job_description'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        score: { type: 'number' },
        semantic_similarity: { type: 'number' },
        keyword_match_pct: { type: 'number' },
        matched_keywords: { type: 'array', items: { type: 'string' } },
        missing_keywords: { type: 'array', items: { type: 'string' } },
      },
    },
    markdownDoc: `# calculate_semantic_ats_score

Generates embedding representations of resume sections and requisition requirements, calculating sectional and overall similarity match scores.
`,
  },
  {
    id: 'tool-browse-job-page',
    name: 'browse_job_page',
    category: 'tools',
    tags: ['Browser', 'First-Party', 'SSRF-Guarded'],
    description:
      'Browse an external job posting URL and extract structured job requirements via headless Chromium.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.browser.read',
    trustClass: 'core_trusted',
    rateLimit: '20/hour',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public https URL of target job posting' },
      },
      required: ['url'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        company: { type: 'string' },
        description: { type: 'string' },
        requirements: { type: 'array', items: { type: 'string' } },
        skills_mentioned: { type: 'array', items: { type: 'string' } },
      },
    },
    markdownDoc: `# browse_job_page

Headless Chromium browser tool guarded by SSRF filters and workspace quotas. Parses title, company, requirements, and compensation fields.
`,
  },
  {
    id: 'tool-execute-code-sandbox',
    name: 'execute_code_sandbox',
    category: 'tools',
    tags: ['Code', 'Approval-Gated'],
    description:
      'Approval-gated Python/JavaScript execution in a same-host subprocess with a pattern filter and timeout.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.sandbox_exec',
    trustClass: 'core_trusted',
    rateLimit: '30/min',
    autonomy: 'approval_required',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        language: { type: 'string', enum: ['python', 'javascript'], default: 'python' },
        input_data: { type: 'string' },
        timeout: { type: 'integer', default: 5 },
      },
      required: ['code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        exit_code: { type: 'integer' },
      },
    },
    markdownDoc: `# execute_code_sandbox

### Security posture
This is **not** an OS sandbox. It runs a same-host subprocess guarded by a pattern
filter, a timeout and a temporary working directory. Treat its output as untrusted:
it must never be evaluated, rendered as instructions, or granted tool access.

Network access is **not** disabled by this tool. Do not describe it as offline or
isolated execution.

Approval is required before every call.
`,
  },
  {
    id: 'tool-draft-email',
    name: 'draft_email',
    category: 'tools',
    tags: ['Email', 'Approval-Gated', 'First-Party'],
    description: 'Prepare an outbound draft email for human approval before sending.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.gmail.write',
    trustClass: 'core_trusted',
    rateLimit: '40/min',
    autonomy: 'approval_required',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject header' },
        body: { type: 'string', description: 'Email body text or markdown' },
      },
      required: ['to', 'subject', 'body'],
    },
    markdownDoc: `# draft_email

Generates an email draft in the connected Gmail account and registers a pending approval ticket in the Approvals Center. It never sends.
`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MCP (4 Model Context Protocol servers)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'mcp-filesystem',
    name: 'mcp-filesystem',
    category: 'mcp',
    tags: ['MCP', 'Verified', 'Local'],
    description:
      'Official local filesystem MCP server providing scoped reading and editing within authorized workspace roots.',
    enabled: true,
    source: 'mcp',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.mcp.execute',
    trustClass: 'mcp.workspace.write',
    version: '1.0.2',
    author: 'Anthropic / ModelContextProtocol',
    markdownDoc: `# Filesystem MCP Server

## Configuration
- Transport: \`stdio\`
- Allowed Root: \`/workspace/data\`
- Tools Exposed: \`read_file\`, \`write_file\`, \`list_directory\`, \`search_files\`

Write tools are approval-gated.
`,
  },
  {
    id: 'mcp-github',
    name: 'mcp-github',
    category: 'mcp',
    tags: ['MCP', 'Verified', 'Remote'],
    description:
      'GitHub Model Context Protocol bridge for issues, pull requests, repository contents, and branch operations.',
    enabled: true,
    source: 'mcp',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.mcp.execute',
    trustClass: 'mcp.external.write',
    version: '2.1.0',
    author: 'GitHub MCP Community',
    markdownDoc: `# GitHub MCP Server

## Configuration
- Transport: \`streamable-http\`
- Scopes: \`repo:read\`, \`issues:write\`
- Gated Tools: \`create_pull_request\`, \`merge_pull_request\` require human confirmation.

This server can mutate repositories you do not own. Treat it as external-write trust.
`,
  },
  {
    id: 'mcp-postgres',
    name: 'mcp-postgres',
    category: 'mcp',
    tags: ['MCP', 'Database', 'Verified'],
    description:
      'PostgreSQL & Supabase direct database MCP connector with read-only query introspection and schema extraction.',
    enabled: true,
    source: 'mcp',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.mcp.execute',
    trustClass: 'mcp.read',
    version: '1.1.0',
    author: 'Supabase Community',
    markdownDoc: `# Postgres MCP Bridge

## Safeguards
- Non-mutating read-only transaction mode enforced at connection layer.
- Enforces statement timeout (max 5000ms).
`,
  },
  {
    id: 'mcp-google-workspace',
    name: 'mcp-google-workspace',
    category: 'mcp',
    tags: ['MCP', 'Productivity', 'OAuth'],
    description:
      'Google Drive, Docs, and Calendar MCP integration providing semantic search and document extraction.',
    enabled: true,
    source: 'mcp',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'connector.mcp.execute',
    trustClass: 'first_party',
    version: '2.0.1',
    author: 'Vaeloom Integrations',
    markdownDoc: `# Google Workspace MCP

Connects Google Drive and Docs to workspace memory agents with automatic token rotation and permission scoping.
`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PLUGINS (4 sandboxed plugins)
  // Custom capabilities get `tool.<name>` from routers/capabilities.py, so the
  // scope below follows that rule rather than an invented `plugin.*` namespace.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'plugin-tag-generator',
    name: 'tag-generator',
    category: 'plugins',
    tags: ['Plugin', 'Official', 'Metadata'],
    description:
      'Extracts topic taxonomy tags and entity labels from unstructured documents using lightweight NLP heuristics.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'tool.tag-generator',
    version: '1.0.0',
    author: 'Vaeloom Official Plugins',
    markdownDoc: `# Tag Generator Plugin

## Input
\`{"text": "string", "max_tags": 5}\`

## Output
\`{"tags": ["taxonomy", "resume", "engineering"]}\`
`,
  },
  {
    id: 'plugin-summarizer',
    name: 'summarizer',
    category: 'plugins',
    tags: ['Plugin', 'Official', 'NLP'],
    description:
      'Generates multi-bullet executive summaries and key decision digests from meeting transcripts and PDFs.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'tool.summarizer',
    version: '1.2.0',
    author: 'Vaeloom Official Plugins',
    markdownDoc: `# Summarizer Plugin

Generates concise 3-5 bullet point executive digests preserving decision records and assigned action items.
`,
  },
  {
    id: 'plugin-sentiment',
    name: 'sentiment',
    category: 'plugins',
    tags: ['Plugin', 'Community', 'Analytics'],
    description:
      'Analyzes tone, urgency, and stakeholder sentiment across email drafts and communication channels.',
    enabled: false,
    source: 'community',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'tool.sentiment',
    trustClass: 'community',
    version: '0.9.1',
    author: 'Community Contributor',
    markdownDoc: `# Sentiment Analysis Plugin

Evaluates communication urgency (high/medium/low) and tone polarity (constructive/neutral/escalated).

Third-party plugin, pre-1.0. Its output is a model judgement about people and
must not be used to rank, gate, or auto-escalate anything without a human decision.
`,
  },
  {
    id: 'plugin-translator',
    name: 'translator',
    category: 'plugins',
    tags: ['Plugin', 'Official', 'Localization'],
    description:
      'Multi-lingual translation plugin supporting 24 languages with technical glossary preservation.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'tool.translator',
    version: '1.1.0',
    author: 'Vaeloom Official Plugins',
    markdownDoc: `# Translator Plugin

Translates documents and messages between 24 supported languages while preserving code snippets and technical acronyms.
`,
  },
];

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Render an ISO timestamp for humans, without inventing one.
 *
 * A null timestamp means "never", and saying so is the whole point: the previous
 * implementation carried pre-rendered English phrases ("10m ago") which cannot be
 * sorted, cannot be localised, and were fabricated rather than measured.
 *
 * Unparseable input and clock skew are surfaced rather than smoothed over, because
 * a wrong-looking timestamp is a bug report and a plausible-looking one is not.
 */
export function formatRelativeTime(iso: string | null): string {
  if (iso === null) return 'Never';
  if (typeof iso !== 'string' || iso.trim() === '') return 'Unknown';

  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 'Unknown';

  const elapsed = Date.now() - parsed;
  if (elapsed < 0) return 'In the future';

  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;
  if (elapsed < MONTH) return `${Math.floor(elapsed / WEEK)}w ago`;
  if (elapsed < YEAR) return `${Math.floor(elapsed / MONTH)}mo ago`;
  return `${Math.floor(elapsed / YEAR)}y ago`;
}

// ─── Storage ────────────────────────────────────────────────────────────────
//
// Two keys per workspace plus a dismissed-id set. The envelope exists because a
// bare payload cannot be migrated: the reader cannot tell "written by an older
// build" from "written by a newer one", so a schema change either silently
// misreads the user's data or destroys it. Refusing on a higher version is the
// only option that does not throw work away.

const STATE_KEY_PREFIX = 'vaeloom.capabilities.';
const CUSTOM_KEY_PREFIX = 'vaeloom.capabilities.custom.';
const DISMISSED_KEY_PREFIX = 'vaeloom.capabilities.dismissed.';

export const STORAGE_VERSION = 1;

interface StorageEnvelope<T> {
  v: number;
  data: T;
}

export interface StorageHealth {
  ok: boolean;
  error?: string;
}

let lastStorageError: string | null = null;

function recordStorageError(message: string | null): void {
  lastStorageError = message;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * The outcome of the most recent storage operation.
 *
 * Every failure mode here used to be swallowed by an empty `catch`, so a corrupt
 * or over-quota store reverted the list to the seed and the user was never told
 * their custom capabilities had vanished. Callers render a banner from this.
 */
export function getStorageHealth(): StorageHealth {
  if (lastStorageError === null) return { ok: true };
  return { ok: false, error: lastStorageError };
}

class StorageFormatError extends Error {}

/**
 * Deep copy of the module constant.
 *
 * Returning the shared array let any caller that mutated the result corrupt the
 * seed for the entire app for the rest of the session.
 */
function cloneSeed(): CapabilityItem[] {
  return SEED_CAPABILITIES.map((item) => ({
    ...item,
    tags: [...item.tags],
    triggers: item.triggers ? [...item.triggers] : undefined,
    toolsUsed: item.toolsUsed ? [...item.toolsUsed] : undefined,
    inputSchema: item.inputSchema ? { ...item.inputSchema } : undefined,
    outputSchema: item.outputSchema ? { ...item.outputSchema } : undefined,
  }));
}

function isEnvelope(parsed: unknown): parsed is StorageEnvelope<unknown> {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    typeof (parsed as StorageEnvelope<unknown>).v === 'number' &&
    'data' in (parsed as Record<string, unknown>)
  );
}

function writeEnvelope<T>(key: string, data: T): void {
  const envelope: StorageEnvelope<T> = { v: STORAGE_VERSION, data };
  localStorage.setItem(key, JSON.stringify(envelope));
}

/**
 * Read one key, migrating forward and refusing to move backward.
 *
 * A bare payload is v0: the pre-envelope format, which is migrated on first read
 * so the user's custom capabilities survive the upgrade instead of being silently
 * replaced by the seed.
 */
function readEnvelope<T>(key: string, migrate: (data: unknown, fromVersion: number) => T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return migrate(undefined, STORAGE_VERSION);

  const parsed: unknown = JSON.parse(raw);

  if (!isEnvelope(parsed)) {
    const migrated = migrate(parsed, 0);
    writeEnvelope(key, migrated);
    return migrated;
  }

  if (parsed.v > STORAGE_VERSION) {
    throw new StorageFormatError(
      `Refusing to read "${key}": stored by a newer app version (v${parsed.v} > v${STORAGE_VERSION}). ` +
        'Your capabilities were left untouched.',
    );
  }

  if (parsed.v < STORAGE_VERSION) {
    const migrated = migrate(parsed.data, parsed.v);
    writeEnvelope(key, migrated);
    return migrated;
  }

  return migrate(parsed.data, parsed.v);
}

function coerceEnabledMap(raw: unknown): Record<string, boolean> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new StorageFormatError('Capability enable-state store is not an object.');
  }
  const out: Record<string, boolean> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') out[id] = value;
  }
  return out;
}

/**
 * Drop the telemetry the old build fabricated.
 *
 * `lastUsed` held phrases like "Just now" and `usageCount` held counts copied
 * from this file's seed literals — neither was ever measured, because no write
 * path existed. Migrating them forward would launder invented numbers into the
 * new schema and back into the UI as fact, so they reset to "never".
 */
function stripFabricatedTelemetry(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  delete out['lastUsed'];
  out['usageCount'] = 0;
  out['lastUsedAt'] = null;
  return out;
}

function coerceCustomItems(raw: unknown, fromVersion: number): CapabilityItem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new StorageFormatError('Custom capability store is not an array.');
  }

  return raw.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new StorageFormatError('Custom capability store contains a non-object entry.');
    }
    const record = entry as Record<string, unknown>;
    const id = record['id'];
    if (typeof id !== 'string' || id === '') {
      throw new StorageFormatError('Custom capability store contains an entry without an id.');
    }
    const base = fromVersion === 0 ? stripFabricatedTelemetry(record) : { ...record };
    const count = base['usageCount'];
    const lastUsedAt = base['lastUsedAt'];
    const tags = base['tags'];
    return {
      ...(base as unknown as CapabilityItem),
      id,
      usageCount: typeof count === 'number' && Number.isFinite(count) ? count : 0,
      lastUsedAt: typeof lastUsedAt === 'string' ? lastUsedAt : null,
      tags: Array.isArray(tags) ? (tags as string[]) : [],
    };
  });
}

function coerceDismissedIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new StorageFormatError('Dismissed capability store is not an array.');
  }
  return raw.filter((id): id is string => typeof id === 'string');
}

function stateKey(workspaceId: string): string {
  return `${STATE_KEY_PREFIX}${workspaceId}`;
}

function customKey(workspaceId: string): string {
  return `${CUSTOM_KEY_PREFIX}${workspaceId}`;
}

function dismissedKey(workspaceId: string): string {
  return `${DISMISSED_KEY_PREFIX}${workspaceId}`;
}

function readState(workspaceId: string): Record<string, boolean> {
  return readEnvelope(stateKey(workspaceId), coerceEnabledMap);
}

function readCustom(workspaceId: string): CapabilityItem[] {
  return readEnvelope(customKey(workspaceId), coerceCustomItems);
}

function readDismissed(workspaceId: string): string[] {
  return readEnvelope(dismissedKey(workspaceId), coerceDismissedIds);
}

/**
 * The merged capability list for a workspace: dismissed-filtered seed + custom,
 * with the enable-state overlay applied last.
 *
 * Falls back to the seed on any read failure but records why, so the caller can
 * tell the user their custom capabilities are missing instead of showing a
 * plausible-looking default list.
 */
export function getStoredCapabilities(workspaceId: string): CapabilityItem[] {
  recordStorageError(null);
  if (typeof window === 'undefined') return cloneSeed();

  try {
    const dismissed = new Set(readDismissed(workspaceId));
    const custom = readCustom(workspaceId);
    const state = readState(workspaceId);

    const customIds = new Set(custom.map((c) => c.id));
    const seedRemaining = cloneSeed().filter(
      (seed) => !dismissed.has(seed.id) && !customIds.has(seed.id),
    );
    const merged = [...custom, ...seedRemaining];

    return merged.map((item) => {
      const override = state[item.id];
      return {
        ...item,
        enabled: typeof override === 'boolean' ? override : Boolean(item.enabled),
      };
    });
  } catch (err) {
    recordStorageError(describeError(err));
    return cloneSeed();
  }
}

export function saveCustomCapability(workspaceId: string, item: CapabilityItem): void {
  if (typeof window === 'undefined') return;
  try {
    const custom = readCustom(workspaceId);
    const without = custom.filter((c) => c.id !== item.id);
    writeEnvelope(customKey(workspaceId), [item, ...without]);

    // Saving is a deliberate install, so it cancels a previous dismissal.
    const dismissed = readDismissed(workspaceId).filter((id) => id !== item.id);
    if (dismissed.length > 0) writeEnvelope(dismissedKey(workspaceId), dismissed);

    recordStorageError(null);
  } catch (err) {
    recordStorageError(describeError(err));
  }
}

/**
 * Patch a single custom capability.
 *
 * Exists so an edit does not have to read the whole list, mutate one field, and
 * write the whole list back — which is how one save ended up touching two
 * storage locations with a partially-stale snapshot.
 */
export function updateCustomCapability(
  workspaceId: string,
  id: string,
  patch: Partial<Omit<CapabilityItem, 'id'>>,
): CapabilityItem[] {
  let writeError: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const custom = readCustom(workspaceId);
      const index = custom.findIndex((c) => c.id === id);
      if (index !== -1) {
        writeEnvelope(customKey(workspaceId), [
          ...custom.slice(0, index),
          { ...custom[index], ...patch, id },
          ...custom.slice(index + 1),
        ]);
      }
      recordStorageError(null);
    } catch (err) {
      writeError = describeError(err);
    }
  }

  const merged = getStoredCapabilities(workspaceId);
  if (writeError !== null) recordStorageError(writeError);
  return merged;
}

/**
 * Flip one capability's enabled flag.
 *
 * Reads and writes only the enable-state key. The previous version rebuilt the
 * whole list first, so two rapid toggles could each write back a snapshot taken
 * before the other landed and lose one of the two changes — and any concurrent
 * save to the custom-capability key was clobbered along the way.
 */
export function setStoredCapabilityEnabled(
  workspaceId: string,
  capabilityId: string,
  enabled: boolean,
): CapabilityItem[] {
  let writeError: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const state = readState(workspaceId);
      state[capabilityId] = enabled;
      writeEnvelope(stateKey(workspaceId), state);
      recordStorageError(null);
    } catch (err) {
      writeError = describeError(err);
    }
  }

  const merged = getStoredCapabilities(workspaceId);
  // A failed write is the more urgent signal than a successful re-read, so it wins.
  if (writeError !== null) recordStorageError(writeError);
  return merged;
}

/**
 * Remove a capability for good.
 *
 * A seed item also has to be recorded in the dismissed set. Deleting it from the
 * custom key alone does nothing to it, so the next read re-injected it from
 * `SEED_CAPABILITIES` and the delete appeared to silently fail.
 */
export function deleteCustomCapability(
  workspaceId: string,
  capabilityId: string,
): CapabilityItem[] {
  let writeError: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const custom = readCustom(workspaceId);
      const remaining = custom.filter((c) => c.id !== capabilityId);
      if (remaining.length !== custom.length) {
        writeEnvelope(customKey(workspaceId), remaining);
      }

      // Only seed ids need the dismissed set. A deleted custom item is already
      // gone from its own key, and logging it here would grow the set forever.
      const isSeedId = SEED_CAPABILITIES.some((s) => s.id === capabilityId);
      if (isSeedId) {
        const dismissed = readDismissed(workspaceId);
        if (!dismissed.includes(capabilityId)) {
          writeEnvelope(dismissedKey(workspaceId), [...dismissed, capabilityId]);
        }
      }

      const state = readState(workspaceId);
      if (Object.prototype.hasOwnProperty.call(state, capabilityId)) {
        delete state[capabilityId];
        writeEnvelope(stateKey(workspaceId), state);
      }

      recordStorageError(null);
    } catch (err) {
      writeError = describeError(err);
    }
  }

  const merged = getStoredCapabilities(workspaceId);
  if (writeError !== null) recordStorageError(writeError);
  return merged;
}
