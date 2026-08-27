/**
 * Landing copy — single source of truth for all marketing strings.
 * Every claim is grounded in Vaeloom documentation:
 *   docs/01-vaeloom-mvp-spec.md · docs/04-memory-knowledge-graph.md
 *   docs/03-agent-workflow.md · docs/vaeloom-how-it-works-visual.md
 *   docs/06-vaeloom-enterprise-paper.md · docs/product/Feature-Specs/*
 * MVP capabilities are stated as current; enterprise items are labeled vision.
 */

export const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Memory', href: '#memory' },
  { label: 'Agents', href: '#agents' },
  { label: 'Career', href: '#career' },
  { label: 'Enterprise', href: '#enterprise' },
] as const;

export const HERO = {
  eyebrow: 'A memory system, not a chatbot',
  titleA: 'Your second brain for',
  titleB: 'education and career.',
  subtitle: '',
  primaryCta: { label: 'Start building — free', href: '/signup' },
  secondaryCta: { label: 'See how it works', href: '#how-it-works' },
  credibility: 'Memory-first by design · Private by default · Nothing acts without your approval',
} as const;

/** Streams shown entering the hero memory core — real MVP connectors only. */
export const HERO_SOURCES = [
  { id: 'gmail', label: 'Gmail' },
  { id: 'github', label: 'GitHub' },
  { id: 'drive', label: 'Google Drive' },
  { id: 'files', label: 'Documents' },
  { id: 'vscode', label: 'VS Code' },
] as const;

export const PRINCIPLES = [
  {
    title: 'Persistent memory',
    body: 'Everything you connect becomes structured memory that compounds — not a conversation that resets to zero.',
    icon: 'memory',
  },
  {
    title: 'Private by default',
    body: 'Connectors start read-only. Access is scoped per source, per action, and revocable at any time.',
    icon: 'lock',
  },
  {
    title: 'Approval before action',
    body: 'Agents suggest; you decide. Consequential actions wait for explicit confirmation — always.',
    icon: 'check-shield',
  },
  {
    title: 'Explainable by design',
    body: 'Every resume line, match, and suggestion links back to its source in your memory graph.',
    icon: 'route',
  },
  {
    title: 'Reversible, never destructive',
    body: 'Vaeloom archives instead of deleting. Every organization action is logged with enough detail to undo it.',
    icon: 'undo',
  },
] as const;

export const DIFFERENCE = {
  eyebrow: "Why it's different",
  title: 'Not another AI chatbot.',
  chatbot: {
    label: 'Chatbots',
    steps: ['You ask', 'It answers', 'Context forgotten'],
    verdict: 'Every conversation starts from zero. Your history lives nowhere.',
  },
  vaeloom: {
    label: 'Vaeloom',
    steps: [
      'Connect sources once',
      'Memory forms & links',
      'Intelligence accumulates',
      'Actions improve memory',
      'Next answer starts smarter',
    ],
    verdict: 'One memory under everything you do. It never forgets, so you never re-explain.',
  },
} as const;

export const HOW_IT_WORKS = {
  eyebrow: 'The loop',
  title: 'How Vaeloom works',
  intro:
    'One continuous loop. Every stage writes into the same memory — so each pass through makes the next one smarter.',
  stages: [
    {
      n: '01',
      name: 'Connect',
      body: 'Link Gmail, GitHub, Google Drive, a local folder, or VS Code. Each grant is scoped and read-only until you say otherwise.',
    },
    {
      n: '02',
      name: 'Ingest',
      body: 'Files sync, upload, or stream in from watched folders. Parsing and OCR run automatically — no filing rules to write.',
    },
    {
      n: '03',
      name: 'Understand',
      body: 'Semantic extraction pulls out entities, facts, and dates. A PDF stops being a PDF and becomes evidence.',
    },
    {
      n: '04',
      name: 'Remember',
      body: 'Entities are deduplicated and linked into your knowledge graph. This is the moment a file stops being “a file.”',
    },
    {
      n: '05',
      name: 'Reason',
      body: 'Agents query memory with hybrid retrieval — vector similarity, keyword, and graph traversal together.',
    },
    {
      n: '06',
      name: 'Suggest',
      body: 'Resume updates, job matches, deadline reminders arrive as proposals with reasons attached.',
    },
    {
      n: '07',
      name: 'Approve',
      body: 'Nothing leaves the system until you approve it. Batch-review proposals on your schedule.',
    },
    {
      n: '08',
      name: 'Act',
      body: 'Approved actions execute — files organized, resumes tailored, applications submitted via API or deep-link handoff.',
    },
    {
      n: '09',
      name: 'Learn',
      body: 'Outcomes and corrections write back to memory. The next ranking, summary, or draft starts from better context.',
    },
  ],
} as const;

export const MEMORY = {
  eyebrow: 'The core',
  title: 'Six kinds of memory. One knowledge graph.',
  intro:
    'Vaeloom stores what it learns as typed structured memory, links it in a knowledge graph, indexes it for vector search, and retrieves it with agentic RAG. You never link anything manually — the Memory Agent builds and maintains it.',
  types: [
    {
      name: 'Profile Memory',
      body: 'Stable facts about you — name, education, roles, preferences that rarely change.',
    },
    {
      name: 'Document Memory',
      body: 'Per-file summaries, embeddings, and source paths so any document can be found and cited.',
    },
    {
      name: 'Career Memory',
      body: 'Applications, outcomes, and interview patterns that recalibrate future matches.',
    },
    {
      name: 'Episodic Memory',
      body: 'Timestamped events — submissions, deadlines, milestones — forming your timeline.',
    },
    {
      name: 'Preference Memory',
      body: 'Inferred and stated patterns: which roles you pursue, which suggestions you accept.',
    },
    {
      name: 'Working Memory',
      body: 'Session context. The only memory type that clears — everything else persists and compounds.',
    },
  ],
  pillars: [
    {
      name: 'Knowledge Graph',
      body: 'People, skills, projects, organizations, certificates, jobs, and events connected by typed relationships — built automatically.',
    },
    {
      name: 'Vector Search',
      body: 'Semantic embeddings over everything you own, so meaning matters more than keywords.',
    },
    {
      name: 'Structured Memory',
      body: 'Typed records with confidence scores, ready for agents to reason over.',
    },
    {
      name: 'Agentic RAG',
      body: 'Hybrid retrieval: vector + keyword + graph traversal, re-ranked by relevance, recency, and confidence.',
    },
  ],
  /** Node taxonomy mirrors the in-app Memory Graph viewer colors. */
  legend: [
    { type: 'person', color: 'var(--landing-node-person)', label: 'Person' },
    { type: 'skill', color: 'var(--landing-node-skill)', label: 'Skill' },
    { type: 'project', color: 'var(--landing-node-project)', label: 'Project' },
    { type: 'org', color: 'var(--landing-node-org)', label: 'Organization' },
    { type: 'document', color: 'var(--landing-node-document)', label: 'Certificate' },
    { type: 'event', color: 'var(--landing-node-event)', label: 'Job / Event' },
  ] as ReadonlyArray<{ type: string; color: string; label: string }>,
  interactions: [
    {
      node: 'React (skill)',
      relation: 'worked_on → Campus Placement Portal',
      source: 'GitHub · commit history',
      confidence: 'High · 0.94',
      output: 'Master resume lists React with linked evidence.',
    },
    {
      node: 'Campus Placement Portal (project)',
      relation: 'awarded_to → Smart India Hackathon 2025',
      source: 'certificate.pdf · uploaded',
      confidence: 'Verified · 0.98',
      output: 'Achievement surfaced for matching roles.',
    },
    {
      node: 'Infosys (organization)',
      relation: 'requires_skill → React, Node.js, SQL',
      source: 'Job posting · scraped & saved',
      confidence: 'Medium · 0.71',
      output: 'ATS gap analysis flags missing SQL keyword.',
    },
  ] as ReadonlyArray<{
    node: string;
    relation: string;
    source: string;
    confidence: string;
    output: string;
  }>,
} as const;

export type AgentInfo = {
  id: string;
  name: string;
  role: string;
  body: string;
  autonomy: string;
  tools: string[];
};

export const AGENTS = {
  eyebrow: 'The ecosystem',
  title: 'Eight specialists. One shared memory.',
  intro:
    'Vaeloom agents are not isolated bots. Each is a specialist operating on the same knowledge graph — proposing actions through suggest-mode, earning autonomy only from your approval history.',
  footnote:
    'An Application Agent executes tailored submissions — but only after explicit per-application consent. An extensible agent architecture grows with the platform.',
  list: [
    {
      id: 'orchestrator',
      name: 'Orchestrator',
      role: 'Router',
      body: 'Routes every request to the right specialist and holds short-term conversation context.',
      autonomy: 'Full — routing only',
      tools: ['Request routing', 'Session context'],
    },
    {
      id: 'organization',
      name: 'Organization Agent',
      role: 'Librarian',
      body: 'Names, categorizes, and files documents; detects duplicates and version chains; proposes every move as a reviewable diff.',
      autonomy: 'Suggest-only',
      tools: ['Rename / file', 'Dedup detection', 'Undo log'],
    },
    {
      id: 'memory',
      name: 'Memory Agent',
      role: 'Cartographer',
      body: 'Extracts entities and relationships from everything agents touch; maintains the knowledge graph and consolidates stale memories.',
      autonomy: 'Internal — no external effect',
      tools: ['Entity extraction', 'Graph merge', 'Consolidation'],
    },
    {
      id: 'resume',
      name: 'Resume Agent',
      role: 'Biographer',
      body: 'Keeps a master resume assembled from memory with provenance links, and asks specific questions when evidence is below confidence threshold.',
      autonomy: 'Suggest-only',
      tools: ['Master resume', 'Variants', 'Gap-fill questions'],
    },
    {
      id: 'ats',
      name: 'ATS Agent',
      role: 'Critic',
      body: 'Scores a resume against any job description, separates known-but-missing skills from genuinely absent ones, suggests rewrites — never edits.',
      autonomy: 'Read-only',
      tools: ['Match scoring', 'Keyword gaps', 'Format audit'],
    },
    {
      id: 'jobsearch',
      name: 'Job Search Agent',
      role: 'Radar',
      body: 'Runs scheduled background searches, ranks roles against memory, and delivers shortlists with a fit reason for every match.',
      autonomy: 'Suggest-only',
      tools: ['Background radar', 'Ranked shortlists', 'Rejected never resurface'],
    },
    {
      id: 'gmail',
      name: 'Gmail Agent',
      role: 'Gatekeeper',
      body: 'Classifies your inbox daily, extracts deadlines into your schedule, and drafts replies. Drafts only — it never sends.',
      autonomy: 'Drafts-only · auto-reply never granted',
      tools: ['Daily digest', 'Deadline extraction', 'Reply drafts'],
    },
    {
      id: 'scheduler',
      name: 'Scheduler Agent',
      role: 'Timekeeper',
      body: 'Maintains one unified schedule from mail, calendar, and documents; detects conflicts at least 48 hours ahead and proposes resolutions.',
      autonomy: 'Reminders full · new events suggest-only',
      tools: ['Conflict detection', 'Hard vs soft events', 'Reminders'],
    },
  ] as AgentInfo[],
} as const;

export const CONNECTORS = {
  eyebrow: 'Sources',
  title: 'Connect only what you choose.',
  intro:
    'Each connector is an explicit, scoped grant — read-only by default, revocable anytime. No unrestricted access, ever.',
  items: [
    { name: 'Gmail', scope: 'Read & classify · drafts only, never sends', icon: 'mail' },
    { name: 'GitHub', scope: 'Repositories & commit metadata', icon: 'github' },
    { name: 'Google Drive', scope: 'Docs & files you grant', icon: 'drive' },
    { name: 'Local folder', scope: 'One folder you pick — via desktop companion', icon: 'folder' },
    { name: 'VS Code', scope: 'Workspace activity & diffs, not whole repos', icon: 'code' },
    { name: 'MCP servers', scope: 'Bring external tools in under approval gates', icon: 'plug' },
  ],
  note: 'Tokens live encrypted in a secrets manager — never plaintext.',
} as const;

export const ORGANIZATION = {
  eyebrow: 'Workspace',
  title: 'A workspace that organizes itself.',
  intro:
    'Drop the mess in. The Organization Agent reads each document, proposes names, categories, and merges for duplicates — then waits for your approval. Every action is reversible.',
  flow: [
    { step: 'Messy uploads', detail: 'screenshot_2024_final_v2.pdf, resume-old.docx…' },
    { step: 'AI understanding', detail: 'Parsed, classified, duplicate & version chains detected' },
    { step: 'Proposed diff', detail: '“Rename to SIH-2025-Certificate.pdf → Certificates/”' },
    { step: 'Your approval', detail: 'Accept, modify, or dismiss — batch supported' },
    { step: 'Clean workspace', detail: 'Filed, searchable, archived — never deleted' },
    { step: 'Memory update', detail: 'Learnings written back for smarter filing next time' },
  ],
} as const;

export const RESUME = {
  eyebrow: 'Resume intelligence',
  title: 'A master resume that writes itself — from evidence.',
  intro:
    'Every line traces back to something real in your memory: a commit, a certificate, a submitted application. When confidence drops below threshold, the Resume Agent asks you a specific question instead of inventing an answer.',
  points: [
    {
      title: 'Provenance-linked',
      body: 'Click any bullet to see the exact source that produced it.',
    },
    {
      title: 'ATS scoring with honesty',
      body: 'Separates “known but missing from your resume” from “genuinely absent” — using your graph, not guesses.',
    },
    {
      title: 'Role-specific variants',
      body: 'Tailored versions generated on demand; rewriting tightens existing bullets, never fabricates new ones.',
    },
    { title: 'Real exports', body: 'Five industry templates compiled to polished PDF and DOCX.' },
  ],
  templates: [
    'Classic Harvard',
    'Tech Modern',
    'Executive Leadership',
    'Minimalist Clean',
    'Creative Portfolio',
  ],
} as const;

export const CAREER = {
  eyebrow: 'Career intelligence',
  title: 'From memory to offer — a pipeline, not a lottery.',
  stages: [
    {
      name: 'Radar',
      body: 'Scheduled searches rank opportunities against your skills, preferences, and history.',
    },
    {
      name: 'Shortlist',
      body: 'Matches arrive with a fit reason. Reject a role once — it never resurfaces.',
    },
    { name: 'Triage', body: 'Approve, reject, or defer. You control what enters the pipeline.' },
    {
      name: 'Tailor',
      body: 'Resume variant and cover letter generated within a minute of approval.',
    },
    {
      name: 'Apply',
      body: 'Submitted via platform API where possible, or handed off with a deep-link package.',
    },
    {
      name: 'Recalibrate',
      body: 'Outcomes write back to Career memory, sharpening every future ranking.',
    },
  ],
  note: 'Nothing is ever submitted without explicit per-application consent.',
} as const;

export const SCHEDULER = {
  eyebrow: 'Proactive intelligence',
  title: 'Your inbox shouldn’t be where deadlines go to disappear.',
  email: {
    from: 'careers@company.com',
    subject: 'Interview invitation — Frontend Engineer',
    snippet: '…please confirm availability for next Tuesday, 2:00 PM…',
    extracted: [
      { label: 'Deadline detected', value: 'Response due · tomorrow' },
      { label: 'Event proposed', value: 'Interview · Tue 2:00 PM' },
      { label: 'Conflict check', value: 'Clashes with exam → resolution suggested' },
    ],
  },
  points: [
    {
      title: 'Daily digest',
      body: 'A classified inbox pass every morning — actionable, deadlines, career opportunities, receipts, noise.',
    },
    {
      title: 'Push when it matters',
      body: 'Interview invites and deadline-today mail surface within minutes, not at tomorrow’s digest.',
    },
    {
      title: 'Hard vs soft conflicts',
      body: 'Application deadlines outrank suggested study blocks — flagged at least 48 hours ahead with a proposed fix.',
    },
    {
      title: 'Drafts, not sends',
      body: 'Gmail intelligence drafts replies for your review. Auto-send was never granted and never will be by default.',
    },
  ],
} as const;

export const TRUST = {
  eyebrow: 'Control',
  title: 'Intelligence without giving up control.',
  intro:
    'Every connector, agent, and action passes through one permission model along three axes — who acts, what kind of action, on which source.',
  rows: [
    {
      axis: 'Read access',
      mvp: 'Default for every connector. Scoped per source.',
      state: 'always',
    },
    {
      axis: 'Write access',
      mvp: 'Separate explicit grant — organizing, tailoring, scheduling.',
      state: 'grant',
    },
    {
      axis: 'Act access',
      mvp: 'Submitting, sending, moving — gated behind per-action approval.',
      state: 'approval',
    },
    {
      axis: 'Earned autonomy',
      mvp: 'Autonomy unlocks per agent, per action type, from your approval history — revocable anytime.',
      state: 'earned',
    },
    {
      axis: 'Audit trail',
      mvp: 'Append-only log of proposals, approvals, grants, and revocations — queryable on the History page.',
      state: 'log',
    },
  ],
  quote: 'Passive by default. Active on request.',
} as const;

export const COMPOUNDING = {
  eyebrow: 'The compounding advantage',
  title: 'Day one it helps. A year later, it knows.',
  intro:
    'Every connection, correction, and outcome deepens the same memory. The value curve bends because context compounds — the moat isn’t the model, it’s your graph.',
  milestones: [
    { when: 'Day 1', state: 'Connected sources, first documents parsed', density: 18 },
    { when: 'Week 1', state: 'Knowledge graph taking shape, workspace filed', density: 34 },
    { when: 'Month 1', state: 'Accurate master resume, ranked matches arriving', density: 56 },
    { when: 'Month 6', state: 'Outcome-calibrated rankings, proactive digests', density: 78 },
    { when: 'Year 1', state: 'Deep personal intelligence across your career', density: 96 },
  ],
} as const;

export const PREVIEW = {
  eyebrow: 'Product experience',
  title: 'This is the actual product surface.',
  intro:
    'No mockup theater — the marketing site ends and the app begins with the same memory graph, the same agents, the same controls.',
  tabs: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'graph', label: 'Memory Graph' },
    { id: 'resume', label: 'Resume' },
    { id: 'jobs', label: 'Jobs' },
  ],
} as const;

export const ENTERPRISE = {
  eyebrow: 'Platform direction',
  badge: 'Vision — beyond today’s MVP',
  title: 'Built to grow from personal intelligence to organizational intelligence.',
  intro:
    'The architecture you just saw — typed memory, permission model, agent roster — is designed for additive growth. Here is where the platform is heading, clearly labeled as direction, not shipping features.',
  shipped: [
    {
      name: 'Workspace-scoped isolation',
      note: 'Row-level security enforced across the entire schema today.',
    },
    {
      name: 'Approval & audit infrastructure',
      note: 'Append-only action log with undo references already in place.',
    },
    {
      name: 'MCP connectors',
      note: 'External tool servers bridge into the agent registry under approval gates — available now.',
    },
  ],
  vision: [
    {
      name: 'Organizations & multi-tenancy',
      body: 'Team workspaces with institutional policy — provisioned accounts whose individual memory stays private by consent.',
    },
    {
      name: 'RBAC & permission engine',
      body: 'Formalized role-based access across connectors, agents, and plugins.',
    },
    {
      name: 'Plugin ecosystem',
      body: 'A public SDK and marketplace extending the agent roster — growth by addition, never replacement.',
    },
    {
      name: 'Compliance posture',
      body: 'Configurable retention, data residency, and compliance exports for institutional deployment.',
    },
  ],
} as const;

export const FINAL_CTA = {
  title: 'Stop managing your digital life manually.',
  subtitle: 'Connect once. Let memory compound. Start building your second brain today.',
  primary: { label: 'Get started — free', href: '/signup' },
  secondary: { label: 'Explore how it works', href: '#how-it-works' },
} as const;

export const FOOTER = {
  blurb:
    'Vaeloom turns scattered work into persistent memory — a second brain for education and career.',
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'How it works', href: '#how-it-works' },
        { label: 'Memory', href: '#memory' },
        { label: 'Agents', href: '#agents' },
        { label: 'Career', href: '#career' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'Enterprise', href: '#enterprise' },
        { label: 'Sign in', href: '/login' },
        { label: 'Create account', href: '/signup' },
        { label: 'System status', href: '/status' },
      ],
    },
    {
      title: 'Trust',
      links: [
        { label: 'Permissions & control', href: '#trust' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
      ],
    },
  ],
} as const;

export const SEO = {
  title: 'Vaeloom — Your second brain for education and career',
  description:
    'Vaeloom is a memory-first personal intelligence system. Connect Gmail, GitHub, Drive, and more — it builds a knowledge graph of your work, keeps a living master resume, surfaces matched roles, and organizes your workspace. Agents suggest, you approve.',
  siteName: 'Vaeloom',
  url: 'https://vaeloom.app',
} as const;
