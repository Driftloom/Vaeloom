export type CapabilityCategory = 'agents' | 'skills' | 'tools' | 'mcp' | 'plugins';

export interface CapabilityItem {
  id: string;
  name: string;
  category: CapabilityCategory;
  tags: string[];
  description: string;
  enabled: boolean;
  source: 'built-in' | 'learned' | 'custom' | 'mcp' | 'community';
  usageCount: number;
  lastUsed?: string;
  requiredScope?: string;
  trustClass?:
    | 'core_trusted'
    | 'first_party'
    | 'mcp.read'
    | 'mcp.workspace.write'
    | 'mcp.external.write'
    | 'untrusted';
  rateLimit?: string;
  triggers?: string[];
  autonomy?: 'suggest' | 'autonomous' | 'approval_required';
  toolsUsed?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  markdownDoc: string;
  version?: string;
  author?: string;
}

export const SEED_CAPABILITIES: CapabilityItem[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // AGENTS (12 canonical & specialized agents)
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
    usageCount: 1420,
    lastUsed: '10m ago',
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
    usageCount: 3890,
    lastUsed: 'Just now',
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
    usageCount: 940,
    lastUsed: '1h ago',
    requiredScope: 'resumes.write,document.compile',
    trustClass: 'first_party',
    autonomy: 'suggest',
    toolsUsed: ['calculate_semantic_ats_score', 'extract_missing_hard_skills', 'render_pdf'],
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
    usageCount: 1120,
    lastUsed: '45m ago',
    requiredScope: 'resumes.read',
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
    usageCount: 830,
    lastUsed: '3h ago',
    requiredScope: 'browser.scrape,jobs.read',
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
    usageCount: 420,
    lastUsed: 'Yesterday',
    requiredScope: 'application.draft,approval.create',
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
    id: 'agent-scheduler',
    name: 'scheduler',
    category: 'agents',
    tags: ['Operations', 'Calendar', 'Temporal'],
    description:
      'Orchestrates recurring jobs, resolves calendar conflicts, and schedules agent task execution timelines.',
    enabled: true,
    source: 'built-in',
    usageCount: 2150,
    lastUsed: '5m ago',
    requiredScope: 'calendar.read,temporal.schedule',
    trustClass: 'core_trusted',
    autonomy: 'autonomous',
    toolsUsed: ['query_calendar_events', 'create_schedule_job'],
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
    usageCount: 610,
    lastUsed: '4h ago',
    requiredScope: 'telemetry.read,prompts.write',
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
  // SKILLS (36+ rich behavioral skills)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'skill-acceptance-criteria-review',
    name: 'acceptance-criteria-review',
    category: 'skills',
    tags: ['General', 'Learned', 'QA'],
    description:
      'Use this skill when you need to review acceptance criteria for ambiguity, missing rules, and verifiability; triggers include acceptance criteria review.',
    enabled: true,
    source: 'learned',
    usageCount: 890,
    lastUsed: '2h ago',
    triggers: ['acceptance criteria review', 'review criteria', 'audit requirements'],
    version: '1.2.0',
    author: 'Antigravity Knowledge Base',
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
    tags: ['General', 'Learned', 'A11y'],
    description:
      'Conduct WCAG 2.1 AA audits across web UI surfaces, inspecting contrast ratios, screen reader semantics, and focus traps.',
    enabled: true,
    source: 'learned',
    usageCount: 650,
    lastUsed: '1d ago',
    triggers: ['audit a11y', 'check accessibility', 'wcag review'],
    version: '1.0.4',
    author: 'Antigravity Knowledge Base',
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
    tags: ['Agent', 'Built-in', 'Architecture'],
    description:
      'Comprehensive blueprint for designing, implementing, testing, and hardening autonomous AI agents from scratch.',
    enabled: true,
    source: 'built-in',
    usageCount: 1540,
    lastUsed: '30m ago',
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
    tags: ['Agent', 'Built-in', 'Workflows'],
    description:
      'Architecture, design patterns, and operational standards for autonomous agentic workflows, sub-goal decomposition, and memory tiers.',
    enabled: true,
    source: 'built-in',
    usageCount: 1290,
    lastUsed: '3h ago',
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
    tags: ['Review', 'Learned', 'GStack'],
    description:
      'Auto-review pipeline running CEO, design, eng, and DX reviews sequentially with auto-decisions using 6 principles.',
    enabled: true,
    source: 'learned',
    usageCount: 970,
    lastUsed: '10m ago',
    triggers: ['autoplan', 'run all reviews', 'automatic review pipeline'],
    version: '1.0.0',
    author: 'GStack Engine',
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
    tags: ['Career', 'Built-in', 'Templates'],
    description:
      'Parses job descriptions, matches skill gaps, tailors achievement bullets, and compiles clean single-page PDF resumes.',
    enabled: true,
    source: 'built-in',
    usageCount: 1420,
    lastUsed: '1h ago',
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
    tags: ['QA', 'Learned', 'Verification'],
    description:
      'Verification subagent that reviews git diffs, executes test suites, checks linting, and validates functional correctness.',
    enabled: true,
    source: 'learned',
    usageCount: 880,
    lastUsed: '4h ago',
    triggers: ['check work', 'verify changes', 'self-verify'],
    version: '1.1.0',
    author: 'Antigravity Knowledge Base',
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
    tags: ['AI', 'Built-in', 'RAG'],
    description:
      'Evaluates vector embeddings, hybrid dense-sparse retrieval, cross-encoder rerankers, and context recall metrics.',
    enabled: true,
    source: 'built-in',
    usageCount: 740,
    lastUsed: '2d ago',
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
    tags: ['Design', 'Built-in', 'UI-UX'],
    description:
      'Guidance for distinctive, intentional visual design, typography, spacing hierarchies, and theme token alignment.',
    enabled: true,
    source: 'built-in',
    usageCount: 1680,
    lastUsed: 'Just now',
    triggers: ['frontend design', 'polish ui', 'design system'],
    version: '2.2.0',
    author: 'Design Lead Studio',
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
    tags: ['AI', 'Built-in', 'Prompts'],
    description:
      'Production-grade LLM engineering, structured output enforcement (Pydantic/JSON schema), prompt caching, and token budgeting.',
    enabled: true,
    source: 'built-in',
    usageCount: 1840,
    lastUsed: '15m ago',
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
    tags: ['Engineering', 'Built-in', 'Distributed'],
    description:
      'Enterprise distributed systems engineering: high-availability, sharding, caching topologies, and disaster recovery.',
    enabled: true,
    source: 'built-in',
    usageCount: 620,
    lastUsed: '3d ago',
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
    tags: ['Design', 'Learned', 'Intelligence'],
    description:
      'UI/UX design intelligence containing 99 guidelines, WCAG AA standards, interaction rules, and responsive patterns.',
    enabled: true,
    source: 'learned',
    usageCount: 2100,
    lastUsed: 'Just now',
    triggers: ['ui-ux-pro-max', 'audit ux', 'enterprise polish'],
    version: '3.0.0',
    author: 'Design Intelligence Engine',
    markdownDoc: `# UI/UX Pro Max Design Intelligence

## Priority Hierarchy
1. **Accessibility**: 4.5:1 contrast ratio, alt-text, visible focus rings, keyboard tab order.
2. **Touch & Interaction**: Minimum 44x44px target bounds, 150-300ms micro-interactions.
3. **Typography & Rhythm**: 4/8dp incremental spacing grid, tabular numbers for metrics.
4. **Error Recovery**: Immediate inline contextual feedback with actionable remedy links.
`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // TOOLS (28+ typed execution tools)
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
    usageCount: 4210,
    lastUsed: '2m ago',
    requiredScope: 'memory.read',
    trustClass: 'first_party',
    rateLimit: '200/min',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query string' },
        limit: { type: 'integer', default: 10, description: 'Maximum items to retrieve' },
        folder_id: { type: 'string', description: 'Optional directory filter ID' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          score: { type: 'number' },
          snippet: { type: 'string' },
        },
      },
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
    usageCount: 3100,
    lastUsed: '5m ago',
    requiredScope: 'memory.read',
    trustClass: 'first_party',
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
        depth: {
          type: 'integer',
          default: 2,
          description: 'Hop depth for relational graph traversal',
        },
      },
      required: ['query'],
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
    usageCount: 1250,
    lastUsed: '1h ago',
    requiredScope: 'ats.analyze',
    trustClass: 'first_party',
    rateLimit: '60/min',
    inputSchema: {
      type: 'object',
      properties: {
        resume_text: { type: 'string', description: 'Full parsed resume text' },
        job_description: { type: 'string', description: 'Target job posting description' },
      },
      required: ['resume_text', 'job_description'],
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
    usageCount: 890,
    lastUsed: '2h ago',
    requiredScope: 'browser.scrape',
    trustClass: 'first_party',
    rateLimit: '20/hour',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public HTTPS URL of target job posting' },
        extract_salary: { type: 'boolean', default: true },
      },
      required: ['url'],
    },
    markdownDoc: `# browse_job_page

Headless Chromium browser tool guarded by SSRF filters and workspace quotas. Parses title, company, requirements, and compensation fields.
`,
  },
  {
    id: 'tool-execute-code',
    name: 'execute_code',
    category: 'tools',
    tags: ['Code', 'Sandbox', 'Core'],
    description:
      'Execute Python snippets in an isolated sandboxed subprocess with strict resource constraints.',
    enabled: true,
    source: 'built-in',
    usageCount: 1650,
    lastUsed: '12m ago',
    requiredScope: 'system.execute',
    trustClass: 'core_trusted',
    rateLimit: '30/min',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Python code block to execute' },
        timeout_seconds: { type: 'integer', default: 10 },
      },
      required: ['code'],
    },
    markdownDoc: `# execute_code

Runs sandboxed Python code with disabled network access and memory caps. Used for mathematical modeling, data extraction, and formatting.
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
    usageCount: 410,
    lastUsed: 'Yesterday',
    requiredScope: 'email.draft',
    trustClass: 'first_party',
    rateLimit: '40/min',
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

Generates an email draft in the connected Gmail account and registers a pending approval ticket in the Approvals Center.
`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MCP (Model Context Protocol Servers)
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
    usageCount: 2450,
    lastUsed: '1m ago',
    requiredScope: 'mcp.workspace.write',
    trustClass: 'mcp.workspace.write',
    version: '1.0.2',
    author: 'Anthropic / ModelContextProtocol',
    markdownDoc: `# Filesystem MCP Server

## Configuration
- Transport: \`stdio\`
- Allowed Root: \`/workspace/data\`
- Tools Exposed: \`read_file\`, \`write_file\`, \`list_directory\`, \`search_files\`
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
    usageCount: 1890,
    lastUsed: '25m ago',
    requiredScope: 'connector.mcp.execute',
    trustClass: 'mcp.external.write',
    version: '2.1.0',
    author: 'GitHub MCP Community',
    markdownDoc: `# GitHub MCP Server

## Configuration
- Transport: \`streamable-http\`
- Scopes: \`repo:read\`, \`issues:write\`
- Gated Tools: \`create_pull_request\`, \`merge_pull_request\` require human confirmation.
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
    usageCount: 910,
    lastUsed: '5h ago',
    requiredScope: 'mcp.read',
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
    usageCount: 1340,
    lastUsed: '40m ago',
    requiredScope: 'connector.mcp.execute',
    trustClass: 'first_party',
    version: '2.0.1',
    author: 'Vaeloom Integrations',
    markdownDoc: `# Google Workspace MCP

Connects Google Drive and Docs to workspace memory agents with automatic token rotation and permission scoping.
`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PLUGINS (Official & Community Sandboxed Plugins)
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
    usageCount: 820,
    lastUsed: '1h ago',
    requiredScope: 'plugin.execute',
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
    usageCount: 1290,
    lastUsed: '15m ago',
    requiredScope: 'plugin.execute',
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
    usageCount: 310,
    lastUsed: '3d ago',
    requiredScope: 'plugin.execute',
    version: '0.9.1',
    author: 'Community Contributor',
    markdownDoc: `# Sentiment Analysis Plugin

Evaluates communication urgency (high/medium/low) and tone polarity (constructive/neutral/escalated).
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
    usageCount: 520,
    lastUsed: '2d ago',
    requiredScope: 'plugin.execute',
    version: '1.1.0',
    author: 'Vaeloom Official Plugins',
    markdownDoc: `# Translator Plugin

Translates documents and messages between 24 supported languages while preserving code snippets and technical acronyms.
`,
  },
];

const STORAGE_KEY_PREFIX = 'vaeloom.capabilities.';
const CUSTOM_STORAGE_KEY_PREFIX = 'vaeloom.capabilities.custom.';

export function getStoredCapabilities(workspaceId: string): CapabilityItem[] {
  if (typeof window === 'undefined') return SEED_CAPABILITIES;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workspaceId}`);
    const customRaw = localStorage.getItem(`${CUSTOM_STORAGE_KEY_PREFIX}${workspaceId}`);
    let customItems: CapabilityItem[] = [];
    if (customRaw) {
      customItems = JSON.parse(customRaw) as CapabilityItem[];
    }

    const allBase = [...customItems, ...SEED_CAPABILITIES];
    if (raw) {
      const storedMap = JSON.parse(raw) as Record<string, boolean>;
      return allBase.map((item) => ({
        ...item,
        enabled: storedMap[item.id] !== undefined ? Boolean(storedMap[item.id]) : item.enabled,
      }));
    }
    return allBase;
  } catch {
    // fallback
  }
  return SEED_CAPABILITIES;
}

export function saveCustomCapability(workspaceId: string, item: CapabilityItem): void {
  if (typeof window === 'undefined') return;
  try {
    const customRaw = localStorage.getItem(`${CUSTOM_STORAGE_KEY_PREFIX}${workspaceId}`);
    const customItems: CapabilityItem[] = customRaw ? JSON.parse(customRaw) : [];
    const filtered = customItems.filter((c) => c.id !== item.id);
    filtered.unshift(item);
    localStorage.setItem(`${CUSTOM_STORAGE_KEY_PREFIX}${workspaceId}`, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

export function setStoredCapabilityEnabled(
  workspaceId: string,
  capabilityId: string,
  enabled: boolean,
): CapabilityItem[] {
  const current = getStoredCapabilities(workspaceId);
  const updated = current.map((c) => (c.id === capabilityId ? { ...c, enabled } : c));
  if (typeof window !== 'undefined') {
    try {
      const stateMap: Record<string, boolean> = {};
      updated.forEach((c) => {
        stateMap[c.id] = c.enabled;
      });
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${workspaceId}`, JSON.stringify(stateMap));
    } catch {
      // ignore
    }
  }
  return updated;
}

// ─── Hub Discovery Catalog (Marketplace & Community Browser) ───────────────

export type HubCategory =
  | 'all'
  | 'desktop'
  | 'memory'
  | 'platforms'
  | 'web-browser'
  | 'tools'
  | 'voice'
  | 'automation'
  | 'models'
  | 'general';

export interface HubCapabilityItem {
  id: string;
  name: string;
  hubCategory: HubCategory;
  category: CapabilityCategory;
  description: string;
  isOfficial: boolean;
  stars: number;
  version: string;
  tags: string[];
  toolsCount?: number;
  author: string;
  capabilityItem: CapabilityItem;
}

export const SEED_HUB_ITEMS: HubCapabilityItem[] = [
  {
    id: 'hub-mnemosyne-dashboard',
    name: 'mnemosyne-dashboard',
    hubCategory: 'desktop',
    category: 'plugins',
    description:
      'Local-only web dashboard for browsing and visualising sovereign memories, triples, stats, and consolidation.',
    isOfficial: false,
    stars: 215,
    version: '1.4.2',
    tags: ['Desktop', 'Memory', 'Dashboard'],
    toolsCount: 4,
    author: 'Vaeloom Community',
    capabilityItem: {
      id: 'plugin-mnemosyne-dashboard',
      name: 'mnemosyne-dashboard',
      category: 'plugins',
      tags: ['Desktop', 'Memory', 'Dashboard'],
      description:
        'Local web dashboard for browsing knowledge graph triples, stats, and episodic memory recall.',
      enabled: true,
      source: 'community',
      usageCount: 215,
      lastUsed: 'Just now',
      requiredScope: 'memory.read,plugin.execute',
      trustClass: 'first_party',
      version: '1.4.2',
      author: 'Vaeloom Community',
      markdownDoc: `# Mnemosyne Dashboard\n\nInteractive desktop memory visualization dashboard for inspecting entity nodes, edge saliency weights, and active agent memory footprints.\n`,
    },
  },
  {
    id: 'hub-vaeloom-resetwatch',
    name: 'hermes-resetwatch',
    hubCategory: 'desktop',
    category: 'skills',
    description:
      'Track subscription quotas, rate limits, and reset times in agent sessions. Auto-notifies before exhaustion.',
    isOfficial: false,
    stars: 69,
    version: '0.2.19',
    tags: ['Desktop', 'Quota', 'Observability'],
    author: 'Community Contributor',
    capabilityItem: {
      id: 'skill-hermes-resetwatch',
      name: 'hermes-resetwatch',
      category: 'skills',
      tags: ['Desktop', 'Quota', 'Observability'],
      description: 'Track subscription quotas, rate limits, and reset times in agent sessions.',
      enabled: true,
      source: 'community',
      usageCount: 69,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '0.2.19',
      author: 'Community Contributor',
      markdownDoc: `# ResetWatch Skill\n\nContinuously tracks LLM quota ceilings, active token consumption, and scheduled quota reset windows across all configured providers.\n`,
    },
  },
  {
    id: 'hub-hermes-memory-ui',
    name: 'hermes-memory-ui',
    hubCategory: 'memory',
    category: 'plugins',
    description:
      'Real-only memory dashboard and desktop plugin for inspecting episodic recall, Mem0, and Honcho state.',
    isOfficial: false,
    stars: 55,
    version: '1.1.0',
    tags: ['Memory', 'Desktop', 'Inspection'],
    author: 'Community',
    capabilityItem: {
      id: 'plugin-hermes-memory-ui',
      name: 'hermes-memory-ui',
      category: 'plugins',
      tags: ['Memory', 'Desktop', 'Inspection'],
      description: 'Desktop plugin for inspecting episodic recall, Mem0, and Honcho state.',
      enabled: true,
      source: 'community',
      usageCount: 55,
      requiredScope: 'memory.read',
      trustClass: 'first_party',
      version: '1.1.0',
      author: 'Community',
      markdownDoc: `# Hermes Memory UI\n\nLive episodic memory inspector with graph visualizer and recall audit timeline.\n`,
    },
  },
  {
    id: 'hub-hermes-rss',
    name: 'hermes-rss',
    hubCategory: 'web-browser',
    category: 'skills',
    description:
      'Read RSS and Atom feeds and discuss articles with agents directly within workspace sessions.',
    isOfficial: false,
    stars: 51,
    version: '1.0.4',
    tags: ['Web & Browser', 'RSS', 'Feeds'],
    author: 'Community',
    capabilityItem: {
      id: 'skill-hermes-rss',
      name: 'hermes-rss',
      category: 'skills',
      tags: ['Web & Browser', 'RSS', 'Feeds'],
      description:
        'Read RSS and Atom feeds and discuss articles with agents directly within workspace sessions.',
      enabled: true,
      source: 'community',
      usageCount: 51,
      requiredScope: 'connector.read',
      trustClass: 'first_party',
      version: '1.0.4',
      author: 'Community',
      markdownDoc: `# RSS Feeds Skill\n\nFetches and extracts full-text articles from curated RSS feeds and injects summaries into agent contexts.\n`,
    },
  },
  {
    id: 'hub-hermes-tailscale',
    name: 'hermes-tailscale',
    hubCategory: 'platforms',
    category: 'mcp',
    description:
      'Browse Tailscale devices and connect to remote agent nodes across encrypted private mesh networks.',
    isOfficial: false,
    stars: 41,
    version: '2.1.0',
    tags: ['Platforms', 'Networking', 'Mesh'],
    author: 'Tailscale Community',
    capabilityItem: {
      id: 'mcp-hermes-tailscale',
      name: 'hermes-tailscale',
      category: 'mcp',
      tags: ['Platforms', 'Networking', 'Mesh'],
      description: 'Connect to remote agent nodes across encrypted Tailscale mesh networks.',
      enabled: true,
      source: 'mcp',
      usageCount: 41,
      requiredScope: 'connector.mcp.execute',
      trustClass: 'mcp.workspace.write',
      version: '2.1.0',
      author: 'Tailscale Community',
      markdownDoc: `# Tailscale Mesh Connector\n\nEnables agent-to-agent peer communication across private Tailscale overlay networks without exposing public ports.\n`,
    },
  },
  {
    id: 'hub-hermes-newswire',
    name: 'hermes-newswire',
    hubCategory: 'desktop',
    category: 'plugins',
    description:
      'Breaking-news ticker for workspace desktop: scrolling RSS/Atom feed strip above the status bar.',
    isOfficial: false,
    stars: 12,
    version: '0.9.1',
    tags: ['Desktop', 'News', 'Ticker'],
    author: 'Community',
    capabilityItem: {
      id: 'plugin-hermes-newswire',
      name: 'hermes-newswire',
      category: 'plugins',
      tags: ['Desktop', 'News', 'Ticker'],
      description: 'Breaking news ticker for workspace desktop: scrolling RSS/Atom feed strip.',
      enabled: true,
      source: 'community',
      usageCount: 12,
      requiredScope: 'plugin.execute',
      trustClass: 'first_party',
      version: '0.9.1',
      author: 'Community',
      markdownDoc: `# Newswire Plugin\n\nDisplays continuous real-time market and developer news headlines directly in the workspace status line.\n`,
    },
  },
  {
    id: 'hub-agent-analytics',
    name: 'agent-analytics',
    hubCategory: 'tools',
    category: 'tools',
    description:
      'Telemetry and dashboard-only read plugin for agent analytics, cost tracking, and execution metrics.',
    isOfficial: false,
    stars: 27,
    version: '1.3.0',
    tags: ['Tools', 'Analytics', 'Metrics'],
    author: 'Community',
    capabilityItem: {
      id: 'tool-agent-analytics',
      name: 'agent-analytics',
      category: 'tools',
      tags: ['Tools', 'Analytics', 'Metrics'],
      description:
        'Dashboard-only read tool for agent analytics, cost tracking, and execution metrics.',
      enabled: true,
      source: 'community',
      usageCount: 27,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '1.3.0',
      author: 'Community',
      markdownDoc: `# Agent Analytics Tool\n\nAggregates per-agent execution times, tool failure rates, token expenditures, and trajectory quality scores.\n`,
    },
  },
  {
    id: 'hub-home-dashboard',
    name: 'home-dashboard',
    hubCategory: 'desktop',
    category: 'plugins',
    description:
      'Personalizable home page with draggable, resizable widgets for workspace documents and active sessions.',
    isOfficial: false,
    stars: 13,
    version: '1.0.0',
    tags: ['Desktop', 'Widgets', 'Customization'],
    author: 'Community',
    capabilityItem: {
      id: 'plugin-home-dashboard',
      name: 'home-dashboard',
      category: 'plugins',
      tags: ['Desktop', 'Widgets', 'Customization'],
      description: 'Personalizable home page with draggable, resizable widgets.',
      enabled: true,
      source: 'community',
      usageCount: 13,
      requiredScope: 'plugin.execute',
      trustClass: 'first_party',
      version: '1.0.0',
      author: 'Community',
      markdownDoc: `# Home Dashboard Plugin\n\nModular dashboard framework allowing users to arrange live status widgets, document recents, and agent feeds.\n`,
    },
  },
  {
    id: 'hub-hermes-ledgerline',
    name: 'hermes-ledgerline',
    hubCategory: 'tools',
    category: 'tools',
    description:
      'Inspect session costs and token usage in workspace desktop with fine-grained per-model cost ledger.',
    isOfficial: false,
    stars: 11,
    version: '1.0.2',
    tags: ['Tools', 'Ledger', 'Costs'],
    author: 'Community',
    capabilityItem: {
      id: 'tool-hermes-ledgerline',
      name: 'hermes-ledgerline',
      category: 'tools',
      tags: ['Tools', 'Ledger', 'Costs'],
      description:
        'Inspect session costs and token usage in workspace with fine-grained per-model cost ledger.',
      enabled: true,
      source: 'community',
      usageCount: 11,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '1.0.2',
      author: 'Community',
      markdownDoc: `# LedgerLine Cost Audit\n\nDetailed breakdown of input, output, and cache token costs per model, workspace, and autonomous agent run.\n`,
    },
  },
  {
    id: 'hub-playwright-automator',
    name: 'playwright-browser-scraper',
    hubCategory: 'web-browser',
    category: 'tools',
    description:
      'Headless Chromium browser automation tool for job boards, company pages, and portal navigation with SSRF guards.',
    isOfficial: true,
    stars: 142,
    version: '2.4.0',
    tags: ['Web & Browser', 'Chromium', 'Official'],
    toolsCount: 6,
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'tool-playwright-browser-scraper',
      name: 'playwright-browser-scraper',
      category: 'tools',
      tags: ['Web & Browser', 'Chromium', 'Official'],
      description:
        'Headless Chromium browser automation tool with SSRF guards and anti-bot evasions.',
      enabled: true,
      source: 'built-in',
      usageCount: 142,
      requiredScope: 'connector.read',
      trustClass: 'first_party',
      version: '2.4.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Playwright Browser Scraper\n\nOfficial headless browser tool enabling agents to navigate external web applications and extract live HTML.\n`,
    },
  },
  {
    id: 'hub-whisper-transcriber',
    name: 'whisper-voice-transcriber',
    hubCategory: 'voice',
    category: 'plugins',
    description:
      'Local speech-to-text audio transcriber with Whisper engine, timestamping, and multi-lingual voice notes.',
    isOfficial: true,
    stars: 88,
    version: '1.2.0',
    tags: ['Voice', 'Whisper', 'Audio'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'plugin-whisper-voice-transcriber',
      name: 'whisper-voice-transcriber',
      category: 'plugins',
      tags: ['Voice', 'Whisper', 'Audio'],
      description:
        'Local speech-to-text audio transcriber with Whisper engine and speaker diarization.',
      enabled: true,
      source: 'built-in',
      usageCount: 88,
      requiredScope: 'plugin.execute',
      trustClass: 'first_party',
      version: '1.2.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Whisper Voice Transcriber\n\nTranscribes voice recordings and audio attachments directly into workspace document markdown.\n`,
    },
  },
  {
    id: 'hub-github-copilot-bridge',
    name: 'github-copilot-bridge',
    hubCategory: 'platforms',
    category: 'mcp',
    description:
      'Bidirectional GitHub platform bridge for managing pull requests, review comments, and repo code search.',
    isOfficial: true,
    stars: 176,
    version: '3.0.1',
    tags: ['Platforms', 'GitHub', 'Official'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'mcp-github-copilot-bridge',
      name: 'github-copilot-bridge',
      category: 'mcp',
      tags: ['Platforms', 'GitHub', 'Official'],
      description: 'Bidirectional GitHub platform bridge for managing PRs and repositories.',
      enabled: true,
      source: 'mcp',
      usageCount: 176,
      requiredScope: 'connector.mcp.execute',
      trustClass: 'mcp.workspace.write',
      version: '3.0.1',
      author: 'Vaeloom Official',
      markdownDoc: `# GitHub Copilot Bridge\n\nModel Context Protocol connector to GitHub APIs, pull requests, and commit verification workflows.\n`,
    },
  },
  {
    id: 'hub-chroma-vector-vault',
    name: 'chroma-vector-vault',
    hubCategory: 'memory',
    category: 'plugins',
    description:
      'Local embedded vector vault for semantic embedding storage, document chunk indexing, and similarity lookups.',
    isOfficial: true,
    stars: 310,
    version: '2.1.0',
    tags: ['Memory', 'Vector', 'Chroma'],
    toolsCount: 5,
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'plugin-chroma-vector-vault',
      name: 'chroma-vector-vault',
      category: 'plugins',
      tags: ['Memory', 'Vector', 'Chroma'],
      description:
        'Local embedded vector vault for semantic embedding storage and similarity lookups.',
      enabled: true,
      source: 'built-in',
      usageCount: 310,
      requiredScope: 'memory.write',
      trustClass: 'first_party',
      version: '2.1.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Chroma Vector Vault\n\nEmbedded vector store enabling semantic search and similarity retrieval across workspace documents.\n`,
    },
  },
  {
    id: 'hub-episodic-decay-monitor',
    name: 'episodic-decay-monitor',
    hubCategory: 'memory',
    category: 'skills',
    description:
      'Monitors memory node saliency and automatically decays unreferenced episodic memories over time.',
    isOfficial: false,
    stars: 94,
    version: '1.2.1',
    tags: ['Memory', 'Decay', 'Graph'],
    author: 'Community',
    capabilityItem: {
      id: 'skill-episodic-decay-monitor',
      name: 'episodic-decay-monitor',
      category: 'skills',
      tags: ['Memory', 'Decay', 'Graph'],
      description:
        'Monitors memory node saliency and decays unreferenced episodic memories over time.',
      enabled: true,
      source: 'community',
      usageCount: 94,
      requiredScope: 'memory.write',
      trustClass: 'first_party',
      version: '1.2.1',
      author: 'Community',
      markdownDoc: `# Episodic Decay Monitor\n\nManages knowledge graph lifecycle by dynamically adjusting entity saliency weights based on recall frequency.\n`,
    },
  },
  {
    id: 'hub-mem0-sovereign-bridge',
    name: 'mem0-sovereign-bridge',
    hubCategory: 'memory',
    category: 'mcp',
    description:
      'Model Context Protocol connector synchronizing sovereign workspace memories with Mem0 semantic storage.',
    isOfficial: true,
    stars: 245,
    version: '1.5.0',
    tags: ['Memory', 'MCP', 'Mem0'],
    toolsCount: 3,
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'mcp-mem0-sovereign-bridge',
      name: 'mem0-sovereign-bridge',
      category: 'mcp',
      tags: ['Memory', 'MCP', 'Mem0'],
      description:
        'MCP connector synchronizing sovereign workspace memories with Mem0 semantic storage.',
      enabled: true,
      source: 'mcp',
      usageCount: 245,
      requiredScope: 'connector.mcp.execute',
      trustClass: 'mcp.workspace.write',
      version: '1.5.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Mem0 Sovereign Bridge\n\nProvides bidirectional synchronization between Vaeloom knowledge graph nodes and external Mem0 persistence.\n`,
    },
  },
  {
    id: 'hub-cron-workflow-scheduler',
    name: 'cron-workflow-scheduler',
    hubCategory: 'automation',
    category: 'plugins',
    description:
      'Enterprise cron scheduler for recurring background agent executions, automated rollups, and hygiene sweeps.',
    isOfficial: true,
    stars: 188,
    version: '2.0.1',
    tags: ['Automation', 'Cron', 'Scheduler'],
    toolsCount: 4,
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'plugin-cron-workflow-scheduler',
      name: 'cron-workflow-scheduler',
      category: 'plugins',
      tags: ['Automation', 'Cron', 'Scheduler'],
      description: 'Enterprise cron scheduler for recurring background agent executions.',
      enabled: true,
      source: 'built-in',
      usageCount: 188,
      requiredScope: 'plugin.execute',
      trustClass: 'core_trusted',
      version: '2.0.1',
      author: 'Vaeloom Official',
      markdownDoc: `# Cron Workflow Scheduler\n\nRuns recurring scheduled tasks and autonomous agent sweeps with configurable cron expressions and logging.\n`,
    },
  },
  {
    id: 'hub-webhook-action-dispatcher',
    name: 'webhook-action-dispatcher',
    hubCategory: 'automation',
    category: 'tools',
    description:
      'Inbound and outbound webhook router delivering event payloads to external APIs with automatic retries and HMAC verification.',
    isOfficial: false,
    stars: 76,
    version: '1.1.4',
    tags: ['Automation', 'Webhooks', 'HTTP'],
    author: 'Community',
    capabilityItem: {
      id: 'tool-webhook-action-dispatcher',
      name: 'webhook-action-dispatcher',
      category: 'tools',
      tags: ['Automation', 'Webhooks', 'HTTP'],
      description:
        'Webhook router delivering event payloads to external APIs with HMAC signatures.',
      enabled: true,
      source: 'community',
      usageCount: 76,
      requiredScope: 'connector.write',
      trustClass: 'first_party',
      version: '1.1.4',
      author: 'Community',
      markdownDoc: `# Webhook Action Dispatcher\n\nDispatches webhook notifications and triggers agent loops upon receipt of signed webhooks.\n`,
    },
  },
  {
    id: 'hub-event-stream-relay',
    name: 'event-stream-relay',
    hubCategory: 'automation',
    category: 'mcp',
    description:
      'Model Context Protocol bridge streaming Server-Sent Events (SSE) and Kafka pub/sub events into agent contexts.',
    isOfficial: false,
    stars: 112,
    version: '1.3.0',
    tags: ['Automation', 'Kafka', 'SSE'],
    author: 'Community',
    capabilityItem: {
      id: 'mcp-event-stream-relay',
      name: 'event-stream-relay',
      category: 'mcp',
      tags: ['Automation', 'Kafka', 'SSE'],
      description: 'MCP bridge streaming SSE and Kafka pub/sub events into agent contexts.',
      enabled: true,
      source: 'mcp',
      usageCount: 112,
      requiredScope: 'connector.mcp.execute',
      trustClass: 'mcp.workspace.write',
      version: '1.3.0',
      author: 'Community',
      markdownDoc: `# Event Stream Relay\n\nSubscribes to enterprise event topics and streams relevant messages to autonomous listening agents.\n`,
    },
  },
  {
    id: 'hub-elevenlabs-voice-synthesis',
    name: 'elevenlabs-voice-synthesis',
    hubCategory: 'voice',
    category: 'plugins',
    description:
      'Ultra-low latency streaming voice synthesis transforming agent responses into natural, human-like voice audio.',
    isOfficial: false,
    stars: 164,
    version: '2.2.0',
    tags: ['Voice', 'ElevenLabs', 'Audio'],
    author: 'Community',
    capabilityItem: {
      id: 'plugin-elevenlabs-voice-synthesis',
      name: 'elevenlabs-voice-synthesis',
      category: 'plugins',
      tags: ['Voice', 'ElevenLabs', 'Audio'],
      description: 'Ultra-low latency streaming voice synthesis generating natural audio output.',
      enabled: true,
      source: 'community',
      usageCount: 164,
      requiredScope: 'plugin.execute',
      trustClass: 'first_party',
      version: '2.2.0',
      author: 'Community',
      markdownDoc: `# ElevenLabs Voice Synthesis\n\nHigh fidelity neural voice generator providing lifelike audio responses for agent conversations.\n`,
    },
  },
  {
    id: 'hub-voice-command-trigger',
    name: 'voice-command-trigger',
    hubCategory: 'voice',
    category: 'skills',
    description:
      'Hands-free voice recognition trigger that activates agent workflows upon detecting spoken hotwords.',
    isOfficial: true,
    stars: 82,
    version: '1.0.3',
    tags: ['Voice', 'Hotwords', 'HandsFree'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'skill-voice-command-trigger',
      name: 'voice-command-trigger',
      category: 'skills',
      tags: ['Voice', 'Hotwords', 'HandsFree'],
      description:
        'Hands-free voice recognition trigger activating workflows upon spoken hotwords.',
      enabled: true,
      source: 'built-in',
      usageCount: 82,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '1.0.3',
      author: 'Vaeloom Official',
      markdownDoc: `# Voice Command Trigger\n\nListens for customizable audio wake phrases to initiate hands-free agent dialogs.\n`,
    },
  },
  {
    id: 'hub-ollama-local-gateway',
    name: 'ollama-local-gateway',
    hubCategory: 'models',
    category: 'plugins',
    description:
      'Connects local Ollama instances running Llama 3, Mistral, and DeepSeek for offline, zero-data-leakage inference.',
    isOfficial: true,
    stars: 390,
    version: '3.1.0',
    tags: ['Models', 'Ollama', 'LocalLLM'],
    toolsCount: 6,
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'plugin-ollama-local-gateway',
      name: 'ollama-local-gateway',
      category: 'plugins',
      tags: ['Models', 'Ollama', 'LocalLLM'],
      description:
        'Connects local Ollama instances running open-weight models for private inference.',
      enabled: true,
      source: 'built-in',
      usageCount: 390,
      requiredScope: 'plugin.execute',
      trustClass: 'core_trusted',
      version: '3.1.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Ollama Local Gateway\n\nRoutes LLM prompts to localhost or LAN Ollama instances without routing data over the public internet.\n`,
    },
  },
  {
    id: 'hub-anthropic-claude-routing',
    name: 'anthropic-claude-routing',
    hubCategory: 'models',
    category: 'tools',
    description:
      'Dynamic tiered model router that selects Claude 3.5 Sonnet, Haiku, or Opus based on prompt difficulty and token budget.',
    isOfficial: true,
    stars: 278,
    version: '2.0.0',
    tags: ['Models', 'Anthropic', 'Router'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'tool-anthropic-claude-routing',
      name: 'anthropic-claude-routing',
      category: 'tools',
      tags: ['Models', 'Anthropic', 'Router'],
      description: 'Tiered model router selecting optimal Claude model based on prompt complexity.',
      enabled: true,
      source: 'built-in',
      usageCount: 278,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '2.0.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Anthropic Claude Routing\n\nIntelligent prompt complexity evaluator that minimizes cost by routing simple queries to Haiku and complex reasoning to Sonnet.\n`,
    },
  },
  {
    id: 'hub-groq-speed-gateway',
    name: 'groq-speed-gateway',
    hubCategory: 'models',
    category: 'tools',
    description:
      'Ultra-high-speed inference gateway leveraging Groq LPU hardware for sub-second agent reasoning loops.',
    isOfficial: false,
    stars: 153,
    version: '1.4.0',
    tags: ['Models', 'Groq', 'LPU'],
    author: 'Community',
    capabilityItem: {
      id: 'tool-groq-speed-gateway',
      name: 'groq-speed-gateway',
      category: 'tools',
      tags: ['Models', 'Groq', 'LPU'],
      description: 'Ultra-high-speed inference gateway leveraging Groq LPU hardware.',
      enabled: true,
      source: 'community',
      usageCount: 153,
      requiredScope: 'connector.read',
      trustClass: 'first_party',
      version: '1.4.0',
      author: 'Community',
      markdownDoc: `# Groq Speed Gateway\n\nAccesses ultra-fast LPU inference endpoints for real-time interactive voice agents and instant search indexing.\n`,
    },
  },
  {
    id: 'hub-slack-agent-relay',
    name: 'slack-agent-relay',
    hubCategory: 'platforms',
    category: 'mcp',
    description:
      'Bidirectional Slack workspace bot relay for querying agents, triggering tasks, and posting status updates directly in channels.',
    isOfficial: true,
    stars: 220,
    version: '2.3.0',
    tags: ['Platforms', 'Slack', 'Official'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'mcp-slack-agent-relay',
      name: 'slack-agent-relay',
      category: 'mcp',
      tags: ['Platforms', 'Slack', 'Official'],
      description:
        'Bidirectional Slack workspace bot relay for querying agents and receiving alerts.',
      enabled: true,
      source: 'mcp',
      usageCount: 220,
      requiredScope: 'connector.mcp.execute',
      trustClass: 'mcp.workspace.write',
      version: '2.3.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Slack Agent Relay\n\nLinks team Slack channels to sovereign agent workflows with thread continuity and action buttons.\n`,
    },
  },
  {
    id: 'hub-linear-sync-bridge',
    name: 'linear-sync-bridge',
    hubCategory: 'platforms',
    category: 'mcp',
    description:
      'Syncs workspace tasks and project roadmaps with Linear issues, cycles, and team backlogs.',
    isOfficial: false,
    stars: 145,
    version: '1.2.2',
    tags: ['Platforms', 'Linear', 'Project'],
    author: 'Community',
    capabilityItem: {
      id: 'mcp-linear-sync-bridge',
      name: 'linear-sync-bridge',
      category: 'mcp',
      tags: ['Platforms', 'Linear', 'Project'],
      description: 'Syncs workspace tasks and roadmaps with Linear issues and cycles.',
      enabled: true,
      source: 'mcp',
      usageCount: 145,
      requiredScope: 'connector.mcp.execute',
      trustClass: 'mcp.workspace.write',
      version: '1.2.2',
      author: 'Community',
      markdownDoc: `# Linear Sync Bridge\n\nAutomatically manages Linear tickets, updates issue states upon code completion, and generates release notes.\n`,
    },
  },
  {
    id: 'hub-firecrawl-deep-extractor',
    name: 'firecrawl-deep-extractor',
    hubCategory: 'web-browser',
    category: 'tools',
    description:
      'Recursively crawls web documentation and dynamic single-page applications, extracting clean markdown for LLM ingestion.',
    isOfficial: false,
    stars: 260,
    version: '1.8.0',
    tags: ['Web & Browser', 'Crawler', 'Markdown'],
    author: 'Community',
    capabilityItem: {
      id: 'tool-firecrawl-deep-extractor',
      name: 'firecrawl-deep-extractor',
      category: 'tools',
      tags: ['Web & Browser', 'Crawler', 'Markdown'],
      description: 'Recursively crawls web documentation, producing LLM-ready markdown.',
      enabled: true,
      source: 'community',
      usageCount: 260,
      requiredScope: 'connector.read',
      trustClass: 'first_party',
      version: '1.8.0',
      author: 'Community',
      markdownDoc: `# Firecrawl Deep Extractor\n\nPerforms multi-page web document scraping with JavaScript execution, cookie handling, and noise filtering.\n`,
    },
  },
  {
    id: 'hub-code-complexity-analyzer',
    name: 'code-complexity-analyzer',
    hubCategory: 'tools',
    category: 'tools',
    description:
      'AST static code analysis utility computing cyclomatic complexity, Halstead metrics, and maintainability index.',
    isOfficial: true,
    stars: 118,
    version: '1.1.0',
    tags: ['Tools', 'AST', 'Metrics'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'tool-code-complexity-analyzer',
      name: 'code-complexity-analyzer',
      category: 'tools',
      tags: ['Tools', 'AST', 'Metrics'],
      description: 'AST static code analysis computing complexity and maintainability index.',
      enabled: true,
      source: 'built-in',
      usageCount: 118,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '1.1.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Code Complexity Analyzer\n\nEvaluates cyclomatic complexity and nesting depth across Python, TypeScript, and Go source files.\n`,
    },
  },
  {
    id: 'hub-json-schema-guard',
    name: 'json-schema-guard',
    hubCategory: 'tools',
    category: 'tools',
    description:
      'High-speed JSON schema validation tool verifying agent tool inputs and structured model outputs against OpenAPI schemas.',
    isOfficial: true,
    stars: 92,
    version: '1.0.5',
    tags: ['Tools', 'Schema', 'Validation'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'tool-json-schema-guard',
      name: 'json-schema-guard',
      category: 'tools',
      tags: ['Tools', 'Schema', 'Validation'],
      description: 'High-speed JSON schema validation verifying structured agent outputs.',
      enabled: true,
      source: 'built-in',
      usageCount: 92,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '1.0.5',
      author: 'Vaeloom Official',
      markdownDoc: `# JSON Schema Guard\n\nValidates incoming and outgoing payloads against strict Draft-07 JSON schemas before tool dispatch.\n`,
    },
  },
  {
    id: 'hub-markdown-pdf-compiler',
    name: 'markdown-pdf-compiler',
    hubCategory: 'general',
    category: 'plugins',
    description:
      'Headless document compiler generating professional, publication-ready PDFs from Markdown specifications.',
    isOfficial: true,
    stars: 175,
    version: '2.1.0',
    tags: ['General', 'PDF', 'Markdown'],
    author: 'Vaeloom Official',
    capabilityItem: {
      id: 'plugin-markdown-pdf-compiler',
      name: 'markdown-pdf-compiler',
      category: 'plugins',
      tags: ['General', 'PDF', 'Markdown'],
      description: 'Headless document compiler generating publication-ready PDFs from Markdown.',
      enabled: true,
      source: 'built-in',
      usageCount: 175,
      requiredScope: 'plugin.execute',
      trustClass: 'first_party',
      version: '2.1.0',
      author: 'Vaeloom Official',
      markdownDoc: `# Markdown PDF Compiler\n\nConverts Markdown documents into paginated, typography-optimized PDFs with syntax-highlighted code blocks.\n`,
    },
  },
  {
    id: 'hub-document-diff-engine',
    name: 'document-diff-engine',
    hubCategory: 'general',
    category: 'tools',
    description:
      'High-precision Myers diffing and semantic patch generator for comparing document versions and workspace artifacts.',
    isOfficial: false,
    stars: 84,
    version: '1.2.0',
    tags: ['General', 'Diff', 'Patch'],
    author: 'Community',
    capabilityItem: {
      id: 'tool-document-diff-engine',
      name: 'document-diff-engine',
      category: 'tools',
      tags: ['General', 'Diff', 'Patch'],
      description: 'Myers diffing and semantic patch generator for comparing document revisions.',
      enabled: true,
      source: 'community',
      usageCount: 84,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '1.2.0',
      author: 'Community',
      markdownDoc: `# Document Diff Engine\n\nGenerates side-by-side visual diffs and unified patch representations for file version auditing.\n`,
    },
  },
  {
    id: 'hub-regex-pattern-extractor',
    name: 'regex-pattern-extractor',
    hubCategory: 'general',
    category: 'skills',
    description:
      'Synthesizes and audits complex regular expression patterns for unstructured text parsing and log analysis.',
    isOfficial: false,
    stars: 62,
    version: '1.0.1',
    tags: ['General', 'Regex', 'Parser'],
    author: 'Community',
    capabilityItem: {
      id: 'skill-regex-pattern-extractor',
      name: 'regex-pattern-extractor',
      category: 'skills',
      tags: ['General', 'Regex', 'Parser'],
      description: 'Synthesizes and audits regex patterns for unstructured text parsing.',
      enabled: true,
      source: 'community',
      usageCount: 62,
      requiredScope: 'system.observe',
      trustClass: 'first_party',
      version: '1.0.1',
      author: 'Community',
      markdownDoc: `# Regex Pattern Extractor\n\nBuilds, validates, and benchmarks Re2-compatible regular expressions for high-throughput pattern matching.\n`,
    },
  },
];

export function installHubCapability(
  workspaceId: string,
  hubItem: HubCapabilityItem,
): CapabilityItem[] {
  const current = getStoredCapabilities(workspaceId);
  const exists = current.find(
    (c) => c.id === hubItem.capabilityItem.id || c.name === hubItem.capabilityItem.name,
  );
  if (exists) {
    return setStoredCapabilityEnabled(workspaceId, exists.id, true);
  }

  saveCustomCapability(workspaceId, { ...hubItem.capabilityItem, enabled: true });
  return setStoredCapabilityEnabled(workspaceId, hubItem.capabilityItem.id, true);
}
