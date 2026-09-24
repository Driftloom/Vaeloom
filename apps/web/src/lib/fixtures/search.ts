/**
 * Vaeloom Deterministic Global Search Fixtures
 * Structured data across Documents, Memories, Resumes, Jobs, Tasks, and Graph Entities.
 */

export interface FacetedSearchResult {
  id: string;
  category: 'document' | 'memory' | 'resume' | 'job' | 'task' | 'entity';
  title: string;
  snippet: string;
  matchScore: number;
  uri?: string;
  date: string;
  tags: string[];
  metadata?: Record<string, string>;
}

export const DEMO_SEARCH_RESULTS: FacetedSearchResult[] = [
  {
    id: 'res-doc-1',
    category: 'document',
    title: 'Dual-Brain Cognitive Architecture Specification.pdf',
    snippet:
      'System 1 handles deterministic sub-50ms choice and triage, while System 2 runs grounded Gemma 4 generative synthesis.',
    matchScore: 0.98,
    uri: '/workspace/{ws}/files/doc-spec-01',
    date: '2026-09-21',
    tags: ['Architecture', 'System 1', 'Ollama', 'Jev'],
    metadata: { author: 'Lead Architect', size: '1.4 MB' },
  },
  {
    id: 'res-mem-1',
    category: 'memory',
    title: 'Assertion: Zero-Trust RLS Matrix validated on Supabase PG',
    snippet:
      'All 42 PostgreSQL tables enforce strict Row-Level Security with fail-closed GUC verification (test_rls_live_pg.py passing 5/5).',
    matchScore: 0.94,
    uri: '/workspace/{ws}/memory/mem-rls-42',
    date: '2026-09-22',
    tags: ['Security', 'PostgreSQL', 'RLS', 'Verified'],
    metadata: { source: 'SecurityAgent', confidence: '0.99' },
  },
  {
    id: 'res-resume-1',
    category: 'resume',
    title: 'Master Resume: Distributed Systems & Autonomous AI (v4.2)',
    snippet:
      'ATS parse score 96/100. High density quantified bullet points using XYZ formula covering sub-50ms agent runtimes.',
    matchScore: 0.92,
    uri: '/workspace/{ws}/resume',
    date: '2026-09-23',
    tags: ['Resume', 'ATS-96', 'Master', 'Tailored'],
    metadata: { format: 'PDF / DOCX', template: 'Minimalist Clean' },
  },
  {
    id: 'res-job-1',
    category: 'job',
    title: 'Staff Distributed Systems Engineer — Anthropic',
    snippet:
      'San Francisco, CA (Hybrid / Remote Option). Build scalable foundation model infrastructure with fault-tolerant agent execution.',
    matchScore: 0.95,
    uri: '/workspace/{ws}/jobs',
    date: '2026-09-20',
    tags: ['Anthropic', 'Staff', '$380k - $460k', 'Match: 95%'],
    metadata: { status: 'Shortlisted', deadline: '2026-10-15' },
  },
  {
    id: 'res-task-1',
    category: 'task',
    title: 'Autonomous Morning Cognition & Reality Gap Synthesis',
    snippet:
      'Temporal workflow executed in 4.2s across memory traces, generating daily briefing and updating skills gap roadmap.',
    matchScore: 0.89,
    uri: '/workspace/{ws}/tasks',
    date: '2026-09-24',
    tags: ['Workflow', 'Cognition', 'Temporal', 'Completed'],
    metadata: { workflowId: 'wf-cognition-20260924', duration: '4.2s' },
  },
  {
    id: 'res-ent-1',
    category: 'entity',
    title: 'Entity: Temporal.io Distributed Orchestration',
    snippet:
      'Core infrastructure dependency linked to 14 documents, 6 memory clusters, and 3 resume bullet achievements.',
    matchScore: 0.88,
    uri: '/workspace/{ws}/memory?view=graph&entity=temporal',
    date: '2026-09-18',
    tags: ['Knowledge Graph', 'Technology', 'Skill Node'],
    metadata: { connections: '23 edges', centrality: 'High' },
  },
];
