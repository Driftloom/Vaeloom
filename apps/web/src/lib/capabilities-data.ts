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
    tags: ['Career', 'Resume', 'Builder', 'Compilation'],
    description:
      'High-fidelity ATS-optimized resume formatting, single-column architecture, typography standards, and parser-safe compilation.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.document.compile',
    triggers: [
      'ats resume builder',
      'build resume',
      'build ats resume',
      'format resume',
      'compile resume',
      'single column resume',
    ],
    version: '2.0.0',
    author: 'Driftloom / Vaeloom Core',
    markdownDoc: `# ATS Resume Builder & Single-Column Architecture Playbook

## Mission
Compile clean, elegant, parser-bulletproof resumes that guarantee 100% extraction fidelity across enterprise Applicant Tracking Systems (Workday, Taleo, Greenhouse, Lever, iCIMS, Ashby). Enforce single-column visual hierarchy, typographic best practices, and deterministic section ordering that eliminates layout corruption while presenting an executive aesthetic to human reviewers.

## Operating Rules
1. **Single-Column Architectural Invariant**: Never emit multi-column layouts, sidebars, floating text boxes, graphic dividers, or embedded HTML/Word tables. The visual flow must strictly follow top-to-bottom linear streaming.
2. **Deterministic Section Ordering**: Organize document sections in standard industry hierarchy: Header (Name, Contact Data), Professional Experience, Technical Skills, Education, and Certifications.
3. **Typography & Metric Margins**: Maintain 0.5 to 0.75-inch margins; use universal system fonts (Calibri, Arial, Georgia); strictly ban custom web fonts and vector icon glyphs.
4. **Clean Plaintext Extraction Verification**: The resulting document must yield 100% intelligible, correctly ordered plaintext when processed through pdftotext or clipboard copy-paste.
5. **Standardized Header Tokenizer Labels**: Use universal, unambiguous section titles (PROFESSIONAL EXPERIENCE, TECHNICAL SKILLS, EDUCATION).
6. **Chronological Syntax Normalization**: Enforce uniform date styling across all employment entries: Month YYYY – Month YYYY (e.g., Jan 2022 – Present or 03/2021 – 11/2023).
7. **Bullet Point Density & Punctuation**: Every bullet point must begin with an active power verb, contain 25 to 45 words, and end with consistent period punctuation.
8. **Page-Fit Budgeting**: Calibrate total content volume to exact page targets: Under 7 years of experience is strictly 1 page; 8+ years is strictly 2 full pages.

## Output Contract
Produce a compiled, verified ATS document package with single-column markdown, extraction fidelity verification, and page-budget adherence. Scope for this skill is \`system.document.compile\`.
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
  {
    id: 'skill-career-coaching',
    name: 'career-coaching',
    category: 'skills',
    tags: ['Career', 'Coaching', 'Strategy'],
    description:
      'Strategic career pathing, promotion readiness evaluation, skill gap identification, and executive interview preparation for engineering professionals.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['career coaching', 'career strategy', 'promotion readiness', 'career path'],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Career Coaching & Strategy

## Mission
Guide candidates through strategic career trajectory modeling, milestone planning, promotion readiness assessments, and interview behavioral preparation anchored on objective market standards.

## Operating Rules
1. Ingest verified candidate career history, project artifacts, and target role level (e.g., L4 to L6, IC to Staff) from workspace memory.
2. Benchmark career competencies against industry engineering ladders, identifying critical technical, execution, and leadership gaps.
3. Formulate structured 30-60-90 day milestone roadmaps with measurable deliverables to substantiate readiness for target promotions or transitions.
4. Convert candidate experience highlights into high-impact STAR (Situation, Task, Action, Result) narratives suitable for senior behavioral screens.
5. Provide actionable executive presence guidance, communication framing, and cross-functional influence strategies.
6. Anchor all compensation expectations and level recommendations on empirical market percentiles (Levels.fyi, Blind) rather than arbitrary estimations.

## Triggers
Use when the request contains career coaching, career strategy, promotion readiness, or career path.

## Output Contract
Markdown analysis detailing candidate current-vs-target leveling matrix, identified skill gaps with priority rankings, 90-day execution milestones, and behavioral talking points. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-ats-audit',
    name: 'ats-audit',
    category: 'skills',
    tags: ['Career', 'ATS', 'Audit'],
    description:
      'Comprehensive ATS parseability and format audit across Workday, Greenhouse, Lever, Taleo, and Ashby parsers, identifying layout traps and keyword density anomalies.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.document.compile',
    triggers: ['ats audit', 'audit resume', 'ats format check', 'parseability audit'],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# ATS Format & Parseability Audit

## Mission
Audit candidate resume documents against the parsing specifications of major Applicant Tracking Systems to eliminate layout failures, multi-column corruption, and missing section headers before submission.

## Operating Rules
1. Verify document layout adheres strictly to single-column top-down linear streams; flag multi-column tables, text boxes, and sidebar graphics as critical parser traps.
2. Audit section heading nomenclature against universal ATS standard dictionaries (\`EXPERIENCE\`, \`EDUCATION\`, \`SKILLS\`), flagging non-standard creative headers.
3. Validate date intervals for consistency across \`MM/YYYY - MM/YYYY\` or \`Month YYYY - Present\` conventions, highlighting unaddressed employment gaps exceeding 6 months.
4. Verify typography and glyphs use standard UTF-8 characters and universal fonts (Georgia, Garamond, Inter, Arial), flagging unparseable custom icon fonts.
5. Inspect document margins, header/footer text placements, and page breaks to ensure no contact info or critical skills are concealed in ignored footer bands.
6. Generate an ATS parseability confidence score (0-100) with specific, actionable remediation steps categorized by target ATS engine (Workday, Greenhouse, Lever, Taleo, Ashby).

## Triggers
Use when the request contains ats audit, audit resume, ats format check, or parseability audit.

## Output Contract
Markdown audit report containing composite parseability score, engine-specific compatibility flags, detected formatting violations with line locations, and remediation checklist. Scope for this skill is \`system.document.compile\`.
`,
  },
  {
    id: 'skill-resume-optimization',
    name: 'resume-optimization',
    category: 'skills',
    tags: ['Career', 'Resume', 'Optimization'],
    description:
      'Precision resume bullet rewriting, action verb hardening, metric quantification, and recruiter readability scoring using the Google XYZ formula.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['optimize resume', 'tailor bullets', 'xyz formula', 'rewrite bullet'],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Resume Bullet Optimization

## Mission
Transform passive job task descriptions into quantified, high-impact accomplishment bullets that highlight candidate engineering ownership and business outcomes without exaggerating achievements.

## Operating Rules
1. Ingest raw experience bullets and evaluate each against the Google XYZ formula: Accomplished [X], as measured by [Y], by doing [Z].
2. Replace passive verbs and duty descriptions ("responsible for", "helped with") with decisive leadership and engineering power verbs (Architected, Spearheaded, Refactored, Streamlined).
3. Extract and amplify verifiable quantitative metrics (throughput, latency, error reduction, revenue, cost savings, user scale) for every project bullet.
4. Align rewritten bullets directly with target job description competencies while preserving 100% factual accuracy from the candidate's actual work history.
5. Prevent keyword stuffing by integrating technical competencies naturally into execution context rather than appending isolated keyword lists.
6. Provide side-by-side Before vs. After comparisons with an Impact Delta rating explaining why the revision elevates candidate competitiveness.

## Triggers
Use when the request contains optimize resume, tailor bullets, xyz formula, or rewrite bullet.

## Output Contract
Markdown table contrasting original bullets with optimized XYZ revisions, accompanied by metric explanations, power verb improvements, and estimated impact gain. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-job-discovery-radar',
    name: 'job-discovery-radar',
    category: 'skills',
    tags: ['Career', 'JobSearch', 'Radar'],
    description:
      'Autonomous job discovery, verified career portal monitoring, company hiring intelligence extraction, and live posting validation with SSRF protection.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.browser.read',
    triggers: ['job radar', 'search jobs', 'discover jobs', 'find vacancies'],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Job Discovery & Market Radar

## Mission
Autonomously discover and verify relevant job opportunities across verified company career portals, extract core requirements, and score role fit while enforcing strict URL security and quota budgets.

## Operating Rules
1. Ingest candidate career targets (role titles, seniority, tech stack, location preferences, remote status) from workspace profile memory.
2. Search and discover open requisitions across verified platforms and direct ATS domains (Greenhouse, Lever, Ashby, Workday), discarding stale listings older than 30 days.
3. Validate every outbound target URL through Vaeloom URL guard to prevent SSRF vulnerabilities, enforcing HTTPS-only and rejecting internal IP spaces.
4. Extract structured job metadata: exact title, hiring team, core technical requirements, nice-to-have qualifications, compensation bands, and visa sponsorship status.
5. Compute multi-factor match score combining semantic vector relevance, required tech stack overlap, and candidate years of experience.
6. Rate-limit external browser requests to honor workspace hourly scrape quotas, logging audit trails for every investigated career opportunity.

## Triggers
Use when the request contains job radar, search jobs, discover jobs, or find vacancies.

## Output Contract
Markdown table of discovered positions including job title, company name, match score, key requirements summary, verified application link, and discovery timestamp. Scope for this skill is \`system.browser.read\`.
`,
  },
  {
    id: 'skill-cover-letter-architect',
    name: 'cover-letter-architect',
    category: 'skills',
    tags: ['Career', 'CoverLetter', 'Applications'],
    description:
      'Value-first, personalized cover letter drafting connecting candidate achievements to company pain points, mission objectives, and engineering culture.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['cover letter', 'draft cover letter', 'application letter', 'write cover letter'],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Cover Letter Architect

## Mission
Draft concise, compelling, and authentic cover letters that establish candidate value within the opening 10 seconds, connecting concrete project achievements directly to the employer's stated challenges.

## Operating Rules
1. Ingest candidate portfolio highlights, target job description, and employer company research from workspace memory before composing copy.
2. Open with an attention-grabbing hook referencing specific company products, technical initiatives, or mutual problem spaces; never begin with generic "I am writing to apply" boilerplate.
3. Structure the narrative into 3 to 4 focused paragraphs (250–400 words total) balancing technical competency, measurable outcomes, and cultural enthusiasm.
4. Dedicate the primary body paragraph to a specific problem-solution-impact narrative proving the candidate has successfully resolved problems identical to the team's roadmap needs.
5. Address potential background transitions or non-traditional experience proactively by framing transferable engineering strengths as unique advantages.
6. Conclude with an assertive yet courteous forward-looking statement inviting strategic technical conversation rather than passive closing platitudes.

## Triggers
Use when the request contains cover letter, draft cover letter, application letter, or write cover letter.

## Output Contract
Markdown document containing the complete tailored cover letter, key company hooks cited, talking points for follow-up interviews, and word count verification. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-star-interview-prep',
    name: 'star-interview-prep',
    category: 'skills',
    tags: ['Career', 'Interview', 'STAR'],
    description:
      'Behavioral interview preparation engine transforming candidate experiences into structured, concise Situation-Task-Action-Result (STAR) stories with quantified outcomes.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['interview prep', 'star story', 'behavioral interview', 'mock interview'],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# STAR Interview Story Prep

## Mission
Prepare candidates for rigorous behavioral interviews by distilling verified project work into structured, compelling Situation-Task-Action-Result (STAR) stories calibrated for 90-second delivery.

## Operating Rules
1. Ingest candidate project artifacts and verified work history, mapping key milestones across core behavioral competencies (Leadership, Complexity, Conflict, Failure & Growth).
2. Structure every story using the strict STAR framework: Situation (15s context), Task (15s ownership), Action (45s specific personal actions), and Result (15s quantified outcome).
3. Ensure the Action component focuses unambiguously on candidate individual contributions rather than diffuse team actions, highlighting technical decision tradeoffs.
4. Conclude every narrative with measurable business impact (latency cut, dollars saved, users onboarded) and a reflective learning synthesis.
5. Provide a 60-second condensed elevator version and high-yield follow-up talking points for each banked story.
6. Prepare strategic, high-signal reverse questions tailored for engineering hiring managers, technical peers, and executive leaders.

## Triggers
Use when the request contains interview prep, star story, behavioral interview, or mock interview.

## Output Contract
Markdown story bank detailing question prompt, 90-second STAR narrative script, key metrics emphasized, and tailored reverse questions for the interviewer. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-salary-negotiation-playbook',
    name: 'salary-negotiation-playbook',
    category: 'skills',
    tags: ['Career', 'Salary', 'Negotiation'],
    description:
      'Total compensation negotiation guide, market percentile benchmarking, equity valuation models, and respectful counter-offer scripts for offers and promotions.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: ['salary negotiation', 'negotiate offer', 'counter offer', 'compensation benchmark'],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Salary & Offer Negotiation

## Mission
Equip candidates with data-driven compensation benchmarks, total remuneration models, and respectful negotiation scripts to secure competitive compensation packages without endangering offers.

## Operating Rules
1. Calculate full Total Compensation (TC) across all components: Base Salary, Annual Performance Bonus, Equity Grants (RSUs/Options with vesting schedules), and Benefits value.
2. Establish market percentiles (25th, 50th, 75th, and 90th percentile) using verified compensation data sources (Levels.fyi, Blind) adjusted for geographic tier and role seniority.
3. Formulate polite, persuasive counter-offer emails and live call scripts that lead with genuine role enthusiasm before presenting data-backed asks.
4. Prepare contingency fallback levers when base salary is rigid, including signing bonuses, equity refreshers, accelerated review cycles, remote flexibility, and learning stipends.
5. Provide structured responses for early salary deflection questions, preserving negotiation leverage until written offers are presented.
6. Verify all agreed adjustments are documented in updated written offer letters prior to final candidate signature.

## Triggers
Use when the request contains salary negotiation, negotiate offer, counter offer, or compensation benchmark.

## Output Contract
Markdown negotiation strategy report featuring total compensation breakdown table, market benchmark range, written counter-offer email script, and scenario pushback talking points. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-linkedin-profile-optimizer',
    name: 'linkedin-profile-optimizer',
    category: 'skills',
    tags: ['Career', 'LinkedIn', 'Profile', 'Recruiter', 'SEO'],
    description:
      'Transform candidate LinkedIn profiles into high-ranking, recruiter-optimized landing pages with search-indexed headlines, engaging About sections, and metric-dense Experience entries.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'linkedin profile optimizer',
      'optimize linkedin',
      'linkedin headline',
      'linkedin about section',
      'recruiter search optimization',
    ],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# LinkedIn Profile Optimizer & Recruiter Discovery Playbook

## Mission
Transform candidate LinkedIn profiles into high-ranking, recruiter-optimized landing pages. Synthesizes search-indexed headlines, engaging 3-hook About sections, and metric-dense Experience entries grounded in the candidate's verified workspace memory vault, achieving maximum discovery across LinkedIn Recruiter searches while maintaining 100% truthful metrics.

## Operating Rules
1. Three-Part Searchable Headline Architecture: Format headlines using \`[Target Title] | [2-3 Core High-Signal Keywords] | [Quantified Proof or Value Proposition]\` within the 220-character limit.
2. The 3-Line Mobile Fold Hook: Craft the first 3 lines (210 desktop characters / 140 mobile characters) of the About section to provoke curiosity and compel readers to tap 'see more'.
3. Google XYZ & Metric Grounding: Format all Experience bullets using the XYZ framework (\`Accomplished [X] as measured by [Y] by doing [Z]\`), sourcing numbers directly from workspace memory (\`memory.read\`). Never fabricate metrics.
4. Strategic Recruiter Keyword Traversal: Map top recruiter search competencies into Skills and Experience sections naturally without keyword stuffing or deceptive spam.
5. First-Person Conversational Professional Voice: Write About sections in a polished, first-person narrative ('I build...', 'My focus is...') rather than third-person formality or AI tropes.
6. Zero AI Tells & Clean Typography: Ban generic AI buzzwords (\`delve\`, \`leverage\`, \`testament to\`, \`in today's fast-paced world\`), straighten curly quotes, and eliminate zero-width spaces.
7. Featured Section High-Impact Sequencing: Recommend portfolio order: 1) Flagship open-source or product build, 2) Technical deep dive or article, 3) High-signal award or credential.
8. Strict Scope Discipline: Operates under authorized tool scope \`memory.read\` to read candidate profile and career receipts without unapproved writes.

## Triggers
Use when requests contain: linkedin profile optimizer, optimize linkedin, linkedin headline, linkedin about section, or recruiter search optimization.

## Output Contract
Produces an end-to-end LinkedIn profile optimization blueprint containing: 1) 3 Headline Options (with character count and keyword density check), 2) Complete 3-Part About Section, 3) Experience Section Bullet Refinements, 4) Top 5 Recruiter Skills to Pin, 5) Profile Completeness & Rubric Scorecard (0-100). Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-linkedin-interviewer',
    name: 'linkedin-interviewer',
    category: 'skills',
    tags: ['Career', 'LinkedIn', 'Interview', 'Story Bank', 'Branding'],
    description:
      'Interview candidate to capture verified career receipts, turning points, failure scars, and defended contrarian positions into a permanent Story Bank.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.write',
    triggers: [
      'linkedin interviewer',
      'interview me',
      'career interview',
      'story bank',
      'extract stories',
    ],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# LinkedIn Interviewer & Career Story Banker

## Mission
Conduct structured, empathetic diagnostic interviews with the candidate to extract concrete career evidence—scopes, verified metrics, turning points, failure scars, and defended contrarian convictions. Compiles the interview findings into a persistent, un-hallucinated Story Bank that powers all downstream resume bullets, LinkedIn posts, and cover letters.

## Operating Rules
1. Press Once, Never Interrogate: When the candidate provides a soft answer ('we improved performance'), press once for exact metrics, measurement duration, and tools used. Accept their answer and move on.
2. Zero Fabrication & No Plausible Inventions: Never invent figures or guess team sizes. If a candidate cannot recall an exact metric, leave the field empty or marked as approximate.
3. Chase the Turning Points & Scars: Specifically ask what the candidate believed 12-24 months ago that they no longer believe, and what failure or mistake taught them that lesson. Real scars provide 10x more trust than unearned wins.
4. Capture Defended Positions: Elicit convictions and architectural choices the candidate advocates for that peers or conventional wisdom disagree with.
5. Verbatim Phrasing Retention: Record the candidate's exact words and lively phrasing rather than flattening them into generic corporate jargon.
6. Honor Off-Limits Boundaries: Explicitly establish what metrics, client names, or proprietary technologies stay confidential and off-limits.
7. Strict Scope Discipline: Operates under authorized tool scope \`memory.write\` to persist verified stories into the candidate's workspace memory vault.

## Triggers
Use when requests contain: linkedin interviewer, interview me, career interview, story bank, or extract stories.

## Output Contract
Outputs a structured, markdown-formatted Story Bank adhering to the schema: 1) Roles & Scopes, 2) Receipts & Concrete Figures, 3) Turning Points & Scars, 4) Defended Positions, 5) Off-Limits Boundaries. Scope for this skill is \`memory.write\`.
`,
  },
  {
    id: 'skill-linkedin-humanizer',
    name: 'linkedin-humanizer',
    category: 'skills',
    tags: ['Career', 'LinkedIn', 'Writing', 'Quality', 'Humanizer'],
    description:
      'Strip machine tells, invisible unicode smuggling characters, and AI tropes from drafts while strictly preserving authentic facts and numbers.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'linkedin humanizer',
      'humanize post',
      'strip ai tells',
      'remove slop',
      'humanize content',
    ],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# LinkedIn Content Humanizer & AI Tell Stripper

## Mission
Sanitize AI-generated drafts (resume bullets, LinkedIn posts, About sections, and cover letters) by eliminating machine tells: zero-width unicode format characters, typographic AI fingerprints (excessive em dashes, curly quotes), and overused AI buzzwords (\`delve\`, \`leverage\`, \`seamless\`, \`testament to\`). Replaces cliches with concrete, natural phrasing while strictly preserving the candidate's authentic numbers, metrics, and dates.

## Operating Rules
1. Never Drop Concrete Numbers: The humanizer must preserve 100% of the candidate's authentic metrics, percentages, dollar figures, and dates. Any edit that drops or alters a number is strictly rejected.
2. Invisible Character Elimination: Automatically detect and strip zero-width spaces (\`U+200B\`), zero-width joiners, byte-order marks (\`U+FEFF\`), and Unicode tag smuggling characters that survive copy-paste.
3. Typographic Normalization: Replace machine-generated em dashes with commas or hyphens, straighten curly quotes, and replace ellipses with standard periods.
4. Lexical Slop Replacement: Replace canonical AI buzzwords (\`delve into\` -> \`look at\`, \`leverage\` -> \`use\`, \`seamless\` -> \`clean\`, \`in today's fast-paced world\` -> \`right now\`) while maintaining grammatical integrity.
5. Preserve URLs & Code Verbatim: Protect all URLs, email addresses, and technical code identifiers from regex modifications.
6. Flag Structural Tells: Flag rhetorical reveals ('The kicker?', 'Let that sink in'), rule-of-three triads, and hashtag walls for human revision rather than mangling sentence structure.
7. Strict Scope Discipline: Operates under authorized tool scope \`memory.read\` without fabricating new facts or claims.

## Triggers
Use when requests contain: linkedin humanizer, humanize post, strip ai tells, remove slop, or humanize content.

## Output Contract
Outputs: 1) Cleaned Draft with all invisible chars and slop removed, 2) Audit Report detailing changes made, 3) 5-Check Score across Burstiness, Specificity, Slop Density, Fingerprint, and Voice (0-100 scale). Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-linkedin-post-writer',
    name: 'linkedin-post-writer',
    category: 'skills',
    tags: ['Career', 'LinkedIn', 'Content', 'Thought Leadership', 'Writing'],
    description:
      'Draft high-agency career and technical LinkedIn posts using 21 proven hook formulas with zero AI cliches, zero link leakage, and authentic engineering voice.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'linkedin post writer',
      'write linkedin post',
      'draft post',
      'linkedin thought leadership',
      'share technical win',
    ],
    version: '2.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# LinkedIn Post Writer & Career Thought Leadership

## Mission
Draft authentic, high-dwell-time LinkedIn posts showcasing career milestones, technical systems, architecture decisions, and contrarian engineering convictions. Employs 21 battle-tested hook formulas to capture reader attention before the 210-character mobile fold while maintaining zero AI slop, zero fabricated numbers, and a human conversational voice.

## Operating Rules
1. The Fold is Everything: Line 1 and 2 must capture the reader's interest before LinkedIn's fold (210 chars on desktop, 140 chars on mobile). Never waste line 1 on pleasantries, setups, or greetings.
2. Numbers Beat Adjectives: Specific figures ($14,200, 31%, 47 minutes) must always replace vague qualifiers ('significant cost', 'massive growth', 'fast deployment').
3. One Idea Per Post: Focus strictly on one clear insight or lesson. If an idea requires multiple disparate pivots, split it into separate posts.
4. Zero AI Cliches: Never include prohibited tropes (\`delve\`, \`leverage\`, \`testament to\`, \`in today's fast-paced world\`, \`game-changer\`, rocket or fire emoji chains).
5. No External Links in Body: Keep external URLs out of the post body to protect algorithmic distribution; instruct links to be placed in the first comment or profile featured section.
6. Ground in Verified Experience: Pull real facts, roles, and lessons directly from the candidate's Story Bank or workspace memory vault (\`memory.read\`). Never fabricate metrics.
7. Strict Scope Discipline: Operates under authorized tool scope \`memory.read\` and generates candidate-approved copy ready for publication.

## Triggers
Use when requests contain: linkedin post writer, write linkedin post, draft post, linkedin thought leadership, or share technical win.

## Output Contract
Outputs: 1) Selected Hook Formula with ID and rationale, 2) Full Post Draft formatted with whitespace for mobile readability (900-1,300 chars), 3) First-Comment Call to Action with optional link or follow-up question. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-academic-cv-builder',
    name: 'academic-cv-builder',
    category: 'skills',
    tags: ['Career', 'Resume', 'Academic', 'CV', 'Writing'],
    description: 'Format CVs for academic positions with publications, grants, and teaching.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'academic cv builder',
      'academic cv',
      'curriculum vitae',
      'faculty application',
      'research cv',
      'postdoc cv',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Academic CV Builder & Scholarly Dossier Architecture

## Mission
Structure, format, and curate comprehensive Curriculum Vitae (CV) documents for academic faculty, postdoc, and research fellow applications across research-intensive and teaching-focused institutions.

## Operating Rules
1. Comprehensive Chronological Record: Maintain an unabridged, exhaustive record of scholarship, teaching, grants, and academic service; do not artificially constrain CVs to industry 1-page limits.
2. Standardized Disciplinary Citation Format: Enforce consistent citation style (APA, IEEE, Chicago, or MLA) across all publications, separating peer-reviewed articles, books, chapters, and conference proceedings.
3. Author Order & Contribution Transparency: Bold candidate name across citations and explicitly denote corresponding author or equal contribution marks.
4. Grant & Award Precision: Include funding agency, award title, grant number, total monetary amount, funding period, and candidate investigator role (PI/co-PI).
5. Pedagogical & Course Scope Specificity: Detail course codes, titles, level (undergraduate/graduate), candidate role (instructor of record vs TA), and enrollment sizes.
6. Strict Grounding in Candidate Vault: Never invent citations, grants, or awards; ground all entries in verified workspace records (\`memory.read\`).

## Triggers
Use when requests contain: academic cv builder, academic cv, curriculum vitae, faculty application, research cv, postdoc cv.

## Output Contract
Markdown dossier containing: 1) Education, 2) Academic & Research Appointments, 3) Publications by Category, 4) Grants & Awards, 5) Teaching Experience, 6) Service & Professional Activities. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-application-form-filler',
    name: 'application-form-filler',
    category: 'skills',
    tags: ['Career', 'Job Search', 'Applications', 'Automation'],
    description:
      "Fill out job application form fields with context-aware, tailored answers drawn from the candidate's CV and the job description.",
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'application form filler',
      'fill application',
      'job application form',
      'apply to job',
      'form answers',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Application Form Filler & Smart Questionnaire Response Engine

## Mission
Generate tailored, high-signal, and policy-compliant answers for job application form fields, custom screening questions, and ATS portal questionnaires by extracting verified facts from candidate workspace memory.

## Operating Rules
1. Exact Truthfulness & Zero Fabrication: Answer factual fields (work authorization, notice period, location preference, clearance) strictly from verified vault memory (\`memory.read\`). Never guess legal or immigration status.
2. Question-Specific Decomposition: Identify the exact core question being asked (behavioral, technical, motivation, situational) and address every sub-prompt directly.
3. Character & Word Count Enforcement: Adhere strictly to portal character limits (e.g., 150 words, 500 characters) with crisp, impactful prose without trailing ellipses.
4. Concrete Evidence in Screening Answers: Ground behavioral answers in STAR-method metrics rather than general platitudes.
5. Diversity & Demographic Sensitivity: For optional EEO/demographic disclosures, provide honest guidance or advise decline options per user preference.
6. Scope Discipline: Reads verified candidate history and profile details under authorized scope \`memory.read\`.

## Triggers
Use when requests contain: application form filler, fill application, job application form, apply to job, form answers.

## Output Contract
Structured mapping of form questions to candidate-tailored responses with character count, source memory citations, and explicit verification flags. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-career-changer-translator',
    name: 'career-changer-translator',
    category: 'skills',
    tags: ['Career', 'Coaching', 'Transition', 'Strategy'],
    description:
      'Translate skills from one industry to another and identify transferable strengths without buzzwords.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'career changer translator',
      'career pivot',
      'career transition',
      'transferable skills',
      'industry change',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Career Changer Translator & Transferable Competency Mapper

## Mission
Deconstruct candidate experience across non-traditional or previous industries and map foundational competencies into the target industry's nomenclature, demonstrating immediate domain relevance and problem-solving capability.

## Operating Rules
1. Functional Abstraction Over Jargon: Strip source-industry specific jargon and restate accomplishments in terms of universal business drivers: revenue, latency, scale, compliance, risk, and team leadership.
2. Bridge Framing: Establish explicit bridges between prior discipline methods (e.g., clinical trials, military logistics, academic research) and target tech/business workflows (e.g., A/B testing, supply chain ops, data science).
3. Value-First Narrative: Position career change as a distinct competitive advantage (cross-functional insight, resilience, lateral thinking) rather than a deficit to excuse.
4. Preserved Historical Integrity: Never misrepresent past job titles or falsify duties; translate the impact and methodology while keeping verified titles (\`memory.read\`).
5. Target Skill Gap Transparency: Openly identify gaps requiring upskilling or certification rather than papering over missing hard requirements.
6. Scope Discipline: Operates under authorized tool scope \`memory.read\` without side effects.

## Triggers
Use when requests contain: career changer translator, career pivot, career transition, transferable skills, industry change.

## Output Contract
Markdown report featuring: 1) Competency Translation Matrix, 2) Reframed Professional Summary, 3) 4-6 Translated High-Impact Bullets, 4) Gap Analysis & Mitigation Recommendations. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-cold-email-writer',
    name: 'cold-email-writer',
    category: 'skills',
    tags: ['Career', 'Outreach', 'Networking', 'Email', 'Job Search'],
    description:
      'Write personalized cold outreach emails to hiring managers and founders — specific, human, not a pitch deck.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'cold email writer',
      'cold email',
      'hiring manager outreach',
      'founder outreach',
      'networking email',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Cold Email Writer & High-Conversion Outreach Architect

## Mission
Draft hyper-personalized, concise, and credible cold outreach emails to engineering leaders, hiring managers, and founders that generate high response rates without sounding like generic sales copy or desperate pitches.

## Operating Rules
1. Extreme Brevity: Keep the total email body strictly between 75 and 150 words. Respect the recipient's finite attention span.
2. Specific Observation Hook: Open with a hyper-specific observation regarding the recipient's recent engineering blog post, product launch, GitHub commit, or talk. No generic flattery.
3. Single High-Relevance Proof Point: Include exactly one verified metric or architectural outcome from candidate vault history (\`memory.read\`) directly addressing the team's public pain point.
4. Low-Friction Single Call-to-Action: Conclude with an effortless, low-commitment ask (e.g., 'Open to a 10-minute chat next Tuesday, or should I speak with someone else on your infra team?').
5. Clean Human Tone: Zero marketing buzzwords, zero formal Victorian correspondence cliches, zero automated template tells.
6. Scope Discipline: Operates under authorized scope \`memory.read\` for candidate achievements retrieval.

## Triggers
Use when requests contain: cold email writer, cold email, hiring manager outreach, founder outreach, networking email.

## Output Contract
Markdown email package containing: 1) 3 Subject Line Options (< 45 chars), 2) Email Body (< 150 words), 3) Follow-up Snippet (for Day 5 check-in). Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-creative-portfolio-resume',
    name: 'creative-portfolio-resume',
    category: 'skills',
    tags: ['Career', 'Resume', 'Portfolio', 'Design', 'Creative'],
    description:
      'Balance visual design with ATS compatibility for creative, UI/UX, and design roles.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'system.document.compile',
    triggers: [
      'creative portfolio resume',
      'creative resume',
      'design resume',
      'ux resume',
      'portfolio resume',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Creative Portfolio Resume & Dual-Format Design Architecture

## Mission
Create resumes for UI/UX designers, design engineers, creative directors, and product designers that strike the perfect balance between high-craft typographic elegance and strict machine-readable ATS compliance.

## Operating Rules
1. Dual-Track Parsing Compliance: Ensure all primary textual content exists in single-column semantic flow that ATS engines parse cleanly while maintaining refined typographic hierarchy.
2. Design Artifact & Case Study Linking: Integrate prominent, scannable links to live prototypes, design systems, Figma files, and case studies.
3. Design Systems & Tooling Granularity: Explicitly enumerate design tools, design systems (tokens, components), and prototyping frameworks alongside front-end engineering competencies.
4. Outcome-Driven Design Metrics: Pair visual and interaction design deliverables with measurable user/business metrics (conversion lift, usability score improvement, design debt reduction).
5. Strict Layout Safety: Avoid complex floating layers, non-standard glyph fonts, or image-only text that break ATS parsers.
6. Scope Discipline: Compiles production-ready documents under authorized scope \`system.document.compile\`.

## Triggers
Use when requests contain: creative portfolio resume, creative resume, design resume, ux resume, portfolio resume.

## Output Contract
Compiled resume specification ready for PDF rendering with complete typography tokens, portfolio links, and verified case studies. Scope for this skill is \`system.document.compile\`.
`,
  },
  {
    id: 'skill-executive-resume-writer',
    name: 'executive-resume-writer',
    category: 'skills',
    tags: ['Career', 'Resume', 'Executive', 'Leadership', 'Strategy'],
    description:
      'Create C-suite and VP level resumes emphasizing strategic leadership, P&L ownership, and board communication.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'executive resume writer',
      'executive resume',
      'vp resume',
      'c-suite resume',
      'director resume',
      'leadership resume',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Executive Resume Writer & Strategic Leadership Dossier

## Mission
Synthesize executive careers (VP, SVP, C-Suite, GM, Managing Director) into authoritative executive resumes that communicate board-level governance, P&L ownership, organizational transformation, and enterprise shareholder value.

## Operating Rules
1. Enterprise Scale Primacy: Lead every role with the operating scale: P&L size ($M/$B), organizational headcount, global footprint, and reporting line to Board/CEO.
2. Strategic Transformation Narrative: Frame achievements in terms of enterprise value creation: market entry, turnaround, M&A integration, EBITDA growth, and digital transformation.
3. Executive Summary as Business Case: Open with an executive value proposition highlighting the candidate's core operating philosophy and strategic impact.
4. Board & Advisory Presence: Dedicate distinct positioning for board governance, committee leadership, and external industry advisory appointments.
5. High-Impact Scannable Typography: Enforce crisp executive formatting with strategic callout blocks for milestone acquisitions or exits.
6. Scope Discipline: Reads verified executive career history out of workspace memory under scope \`memory.read\`.

## Triggers
Use when requests contain: executive resume writer, executive resume, vp resume, c-suite resume, director resume, leadership resume.

## Output Contract
Comprehensive executive resume markdown containing Executive Summary, Board & Governance, Core Operating Competencies, Professional Experience with P&L scope, and Education/Credentials. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-job-description-analyzer',
    name: 'job-description-analyzer',
    category: 'skills',
    tags: ['Career', 'Job Search', 'Analysis', 'Strategy', 'ATS'],
    description:
      'Analyze job postings, calculate match scores, identify requirements gaps, and formulate application strategy.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'job description analyzer',
      'analyze job description',
      'job posting analysis',
      'jd breakdown',
      'job requirements',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Job Description Analyzer & Hiring Intelligence Engine

## Mission
Dissect complex job descriptions to extract implicit and explicit requirements, map candidate qualifications against role demands, calculate authentic match scores, and produce actionable application positioning strategies.

## Operating Rules
1. Four-Tier Qualification Extraction: Separate requirements into 1) Must-have hard skills, 2) Nice-to-have bonus skills, 3) Hidden team/cultural signals, and 4) Core business objectives.
2. Authentic Match Scoring: Calculate transparent match score percentage based on hard qualification overlap; never artificially inflate scores.
3. Gap Identification with Mitigation: Highlight every candidate gap alongside a concrete mitigation tactic (parallel experience, demonstrated fast learning, portfolio project).
4. Hidden Pain Point Detection: Decode boilerplate requirements to identify the real organizational problem the hiring manager is desperate to solve.
5. Keyword Density Guidance: Extract top 10 ATS search keywords in descending order of frequency and strategic importance.
6. Scope Discipline: Operates under authorized tool scope \`memory.read\` for candidate profile comparison.

## Triggers
Use when requests contain: job description analyzer, analyze job description, job posting analysis, jd breakdown, job requirements.

## Output Contract
Markdown analysis containing: 1) Role Overview & Pain Points, 2) Four-Tier Skills Taxonomy, 3) Candidate Match Score %, 4) Identified Gaps & Mitigation Strategy, 5) ATS Keyword Bank. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-offer-comparison-analyzer',
    name: 'offer-comparison-analyzer',
    category: 'skills',
    tags: ['Career', 'Compensation', 'Offers', 'Finance', 'Strategy'],
    description:
      'Compare multiple job offers side-by-side with total compensation, equity valuation, and cost of living analysis.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'offer comparison analyzer',
      'compare job offers',
      'offer comparison',
      'total compensation compare',
      'multiple offers',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Offer Comparison Analyzer & Multi-Offer Decision Framework

## Mission
Deliver rigorous, multi-dimensional comparative analysis of concurrent job offers, balancing total direct compensation (Base, Bonus, Equity, Sign-on) against benefits, cost of living, career trajectory, and qualitative culture fit.

## Operating Rules
1. Normalized Total Compensation: Model 4-year annualized total compensation (Year 1 vs Years 2-4) taking vesting cliffs, signing bonuses, and expected performance bonuses into account.
2. Equity Realism & Risk Modeling: Distinguish public liquid RSUs from private options/illiquid shares; model conservative, base, and upside exit scenarios for private equity.
3. Cost of Living & Tax Adjustment: Normalize offers across different geographic locations using state/local tax models and real cost of living indexes.
4. Benefits & Hidden Perks Valuation: Quantify monetary value of 401(k) matches, healthcare premiums, PTO policies, learning budgets, and remote work stipends.
5. Qualitative Career Trajectory Scoring: Score company brand prestige, promotion velocity, mentorship quality, and market resilience.
6. Scope Discipline: Operates under authorized tool scope \`memory.read\` without persisting sensitive compensation data externally.

## Triggers
Use when requests contain: offer comparison analyzer, compare job offers, offer comparison, total compensation compare, multiple offers.

## Output Contract
Markdown decision dossier containing: 1) Side-by-Side Compensation Matrix, 2) 4-Year Cash Flow Projection, 3) Benefits & Equity Risk Analysis, 4) Qualitative Dimension Scorecard, 5) Recommendation & Decision Rationale. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-portfolio-case-study-writer',
    name: 'portfolio-case-study-writer',
    category: 'skills',
    tags: ['Career', 'Portfolio', 'Case Study', 'Engineering', 'Writing'],
    description:
      'Transform resume bullets and system architecture into detailed portfolio case studies and project deep-dives.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'portfolio case study writer',
      'portfolio case study',
      'project case study',
      'write case study',
      'engineering case study',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Portfolio Case Study Writer & Architecture Narrative Builder

## Mission
Transform isolated engineering projects, system implementations, and product milestones into compelling, publication-grade technical case studies that demonstrate architectural depth, trade-off analysis, and measurable business impact.

## Operating Rules
1. Problem-First Narrative Arc: Structure case studies around the authentic business challenge, latency bottleneck, or scaling constraint before discussing technical solutions.
2. Explicit Trade-off Documentation: Detail alternatives considered, why specific tools/patterns were chosen, and what trade-offs were accepted.
3. Architecture & Data Flow Clarity: Provide clear architectural breakdowns (microservices, caching layers, data schemas, async queues) suitable for senior/staff engineering reviewers.
4. Quantified Business Impact: Anchor case study conclusion in verifiable business outcomes (revenue preserved, infrastructure cost reduced, p99 latency dropped).
5. Candidate Ownership Attribution: Clearly distinguish the candidate's individual design contributions from general team activities (\`memory.read\`).
6. Scope Discipline: Operates under authorized tool scope \`memory.read\` without side effects.

## Triggers
Use when requests contain: portfolio case study writer, portfolio case study, project case study, write case study, engineering case study.

## Output Contract
Markdown case study containing: 1) Executive Summary, 2) Problem Statement & Constraints, 3) Architecture & Implementation, 4) Trade-offs & Decisions, 5) Measurable Impact & Lessons Learned. Scope for this skill is \`memory.read\`.
`,
  },
  {
    id: 'skill-reference-list-builder',
    name: 'reference-list-builder',
    category: 'skills',
    tags: ['Career', 'References', 'Job Search', 'Dossier'],
    description:
      'Format professional references properly, prepare reference dossiers, and prep references with context.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    requiredScope: 'memory.read',
    triggers: [
      'reference list builder',
      'professional references',
      'reference list',
      'reference dossier',
      'reference preparation',
    ],
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    markdownDoc: `# Reference List Builder & Candidate Advocacy Dossier

## Mission
Curate professional reference lists and candidate briefing dossiers that equip advocates with the exact project contexts, key competencies, and shared accomplishments needed to deliver glowing, credible reference checks.

## Operating Rules
1. Categorized Advocate Roster: Organize references by professional relationship: former managers, peer engineers, cross-functional partners, and direct reports.
2. Contextual Role Alignment: For each reference, document the shared company, project timeframe, and specific high-impact initiatives worked on together.
3. Reference Briefing Packet: Generate tailored talking points and refresher notes for each advocate highlighting the specific target role requirements.
4. Privacy & Consent Safeguards: Advise candidate to obtain explicit permission before sharing contact numbers and private emails; never disclose references prematurely.
5. Reverse Chronological Experience Grounding: Ensure dates and company names match verified workspace memory (\`memory.read\`).
6. Scope Discipline: Operates under authorized tool scope \`memory.read\` without external side effects.

## Triggers
Use when requests contain: reference list builder, professional references, reference list, reference dossier, reference preparation.

## Output Contract
Markdown dossier containing: 1) Formatted Professional Reference Sheet, 2) Reference Alignment Matrix (who covers which competencies), 3) Advocate Outreach & Briefing Email Templates. Scope for this skill is \`memory.read\`.
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
