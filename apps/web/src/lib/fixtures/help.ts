/**
 * Vaeloom Deterministic Help Center & Documentation Fixtures
 */

export interface HelpArticle {
  id: string;
  category: 'GETTING_STARTED' | 'AGENTS_AUTONOMY' | 'CONNECTORS' | 'SECURITY_PRIVACY' | 'SHORTCUTS';
  title: string;
  summary: string;
  content: string;
  readTime: string;
}

export interface KeyboardShortcutItem {
  key: string;
  description: string;
  scope: string;
}

export const DEMO_SHORTCUTS: KeyboardShortcutItem[] = [
  {
    key: '⌘ + K / Ctrl + K',
    description: 'Open Global Command Center & Navigation',
    scope: 'Global',
  },
  { key: '⌘ + B / Ctrl + B', description: 'Toggle Left Sidebar Navigation', scope: 'Global' },
  { key: '⌘ + / / Ctrl + /', description: 'Show Keyboard Shortcuts Modal', scope: 'Global' },
  {
    key: 'A',
    description: 'Approve selected pending proposal or event',
    scope: 'Approvals / Schedule',
  },
  {
    key: 'R',
    description: 'Reject selected pending proposal or event',
    scope: 'Approvals / Schedule',
  },
  {
    key: 'Esc',
    description: 'Close any open drawer, modal, or command palette',
    scope: 'Overlays',
  },
  { key: 'Enter', description: 'Send chat prompt (Shift+Enter for newline)', scope: 'Chat' },
  { key: '/', description: 'Trigger slash command agent selector in chat composer', scope: 'Chat' },
];

export const DEMO_HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'art-1',
    category: 'GETTING_STARTED',
    title: 'Vaeloom Core Concept: Memory-First Autonomous Intelligence',
    summary:
      'Understand how Vaeloom differs from generic chatbots by building a living memory graph of your achievements, files, and career goals.',
    readTime: '3 min read',
    content: `Vaeloom is an enterprise personal intelligence system designed around three core tenets:
1. **Memory First**: Every interaction, document ingested, and interview completed generates cryptographically traceable memory entries.
2. **Dual-Brain Architecture**: Fast deterministic sub-50ms routing (System 1) combined with grounded generative synthesis (System 2).
3. **Agent Suggests — You Approve**: Autonomous agents operate under strict autonomy policies (read-only, approval-gated, full autonomy) with human-in-the-loop oversight.`,
  },
  {
    id: 'art-2',
    category: 'AGENTS_AUTONOMY',
    title: 'Understanding Agent Autonomy Modes & Permission Scopes',
    summary:
      'Configure least-privilege policies for JobSearchAgent, ResumeAgent, MemoryAgent, and GmailAgent.',
    readTime: '4 min read',
    content: `Vaeloom provides three distinct autonomy tiers configured in Workspace Settings:
- **Read Only**: The agent can query memory and analyze files but cannot formulate proposals, send emails, or draft applications.
- **Approval Gated (Default)**: The agent executes research autonomously, but any mutating action (submitting applications, writing calendar events, modifying master resume) triggers an approval card in your Inbox.
- **Full Autonomy**: Used for trusted background crons and non-destructive tasks.`,
  },
  {
    id: 'art-3',
    category: 'CONNECTORS',
    title: 'Connecting Google Workspace, GitHub, and Composio MCP',
    summary:
      'Learn how to securely link your work files, repositories, and SaaS integrations with per-key encryption.',
    readTime: '5 min read',
    content: `Connectors bridge your external tools into Vaeloom:
- **Google Drive & Docs**: Auto-syncs PDF, DOCX, and text files into the document pipeline.
- **GitHub**: Ingests commits, pull requests, and README files to substantiate technical claims in your resume.
- **Composio / MCP**: Extends agent capabilities with dynamic tool execution following official MCP v2 standards.`,
  },
  {
    id: 'art-4',
    category: 'SECURITY_PRIVACY',
    title: 'Zero-Trust Security, Row-Level Security (RLS), and GDPR Rights',
    summary:
      'How Vaeloom safeguards your private career data with cryptographic tenant isolation and signed deletion receipts.',
    readTime: '4 min read',
    content: `Every piece of data stored in Vaeloom is scoped to your workspace via PostgreSQL Row-Level Security (RLS) enforced at the database layer.
You have absolute sovereignty:
- Export your full memory graph and documents at any time in standard JSON/ZIP formats.
- Request cryptographic deletion with an immutable SHA-256 deletion receipt proving eradication across database and vector stores.`,
  },
];
