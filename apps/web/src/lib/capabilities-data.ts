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

export function getStoredCapabilities(workspaceId: string): CapabilityItem[] {
  if (typeof window === 'undefined') return SEED_CAPABILITIES;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workspaceId}`);
    if (raw) {
      const storedMap = JSON.parse(raw) as Record<string, boolean>;
      return SEED_CAPABILITIES.map((item) => ({
        ...item,
        enabled: storedMap[item.id] !== undefined ? Boolean(storedMap[item.id]) : item.enabled,
      }));
    }
  } catch {
    // fallback
  }
  return SEED_CAPABILITIES;
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
