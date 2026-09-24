/**
 * Vaeloom Deterministic Autonomous Tasks & Execution Fixtures
 * Tracks multi-agent workflow DAGs, subtasks, and execution logs.
 */

export interface ExecutionSubtask {
  id: string;
  title: string;
  agent: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'APPROVAL_REQUIRED';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  outputSummary?: string;
}

export interface AutonomousTask {
  id: string;
  workflowId: string;
  title: string;
  description: string;
  initiator: 'USER' | 'AGENT' | 'SCHEDULE';
  status: 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'PENDING_APPROVAL';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  progressPercentage: number;
  startedAt: string;
  completedAt?: string;
  assignedAgent: string;
  subtasks: ExecutionSubtask[];
}

export const DEMO_AUTONOMOUS_TASKS: AutonomousTask[] = [
  {
    id: 'task-101',
    workflowId: 'wf-career-sync-842',
    title: 'Daily Recruiter Correspondence & Memory Ingestion',
    description:
      'Autonomous scan of Gmail inbox for recruiter responses, interview invitations, and status changes.',
    initiator: 'SCHEDULE',
    status: 'COMPLETED',
    priority: 'HIGH',
    progressPercentage: 100,
    startedAt: '2026-09-24T06:00:00Z',
    completedAt: '2026-09-24T06:01:14Z',
    assignedAgent: 'GmailAgent',
    subtasks: [
      {
        id: 'st-1',
        title: 'Fetch latest inbox threads (past 24h)',
        agent: 'GmailAgent',
        status: 'COMPLETED',
        startedAt: '2026-09-24T06:00:01Z',
        completedAt: '2026-09-24T06:00:12Z',
        durationMs: 11000,
        outputSummary: 'Scanned 18 emails, flagged 3 career-relevant threads.',
      },
      {
        id: 'st-2',
        title: 'Extract interview deadline & recruiter entity',
        agent: 'MemoryAgent',
        status: 'COMPLETED',
        startedAt: '2026-09-24T06:00:13Z',
        completedAt: '2026-09-24T06:00:35Z',
        durationMs: 22000,
        outputSummary: 'Created memory trace: "Anthropic technical screening scheduled for Oct 2".',
      },
      {
        id: 'st-3',
        title: 'Publish proposed calendar event to Schedule Inbox',
        agent: 'SchedulerAgent',
        status: 'COMPLETED',
        startedAt: '2026-09-24T06:00:36Z',
        completedAt: '2026-09-24T06:01:14Z',
        durationMs: 38000,
        outputSummary: 'Calendar event proposed for user approval.',
      },
    ],
  },
  {
    id: 'task-102',
    workflowId: 'wf-ats-tailor-911',
    title: 'Precision ATS Tailoring for Staff Systems Engineer (Anthropic)',
    description:
      'Compute cosine embeddings similarity, extract missing keywords, and render Playwright PDF.',
    initiator: 'USER',
    status: 'RUNNING',
    priority: 'CRITICAL',
    progressPercentage: 68,
    startedAt: '2026-09-24T17:10:00Z',
    assignedAgent: 'ResumeAgent',
    subtasks: [
      {
        id: 'st-10',
        title: 'Semantic ATS Keyword Gap Analysis',
        agent: 'ATSAgent',
        status: 'COMPLETED',
        startedAt: '2026-09-24T17:10:02Z',
        completedAt: '2026-09-24T17:10:14Z',
        durationMs: 12000,
        outputSummary: 'Identified 3 missing skills: Triton, eBPF, PagedAttention.',
      },
      {
        id: 'st-11',
        title: 'Generate Grounded Bullet Points with Context Fencing',
        agent: 'ResumeAgent',
        status: 'COMPLETED',
        startedAt: '2026-09-24T17:10:15Z',
        completedAt: '2026-09-24T17:11:05Z',
        durationMs: 50000,
        outputSummary: 'Formulated 4 quantified XYZ bullet points using real project metrics.',
      },
      {
        id: 'st-12',
        title: 'Agent Council Verification & Quality Gate',
        agent: 'AgentCouncil',
        status: 'RUNNING',
        startedAt: '2026-09-24T17:11:06Z',
        outputSummary: 'Deliberating claim veracity and anti-hallucination bounds.',
      },
      {
        id: 'st-13',
        title: 'Playwright Chromium Headless PDF Compilation',
        agent: 'DocumentAgent',
        status: 'PENDING',
      },
    ],
  },
  {
    id: 'task-103',
    workflowId: 'wf-job-scrape-404',
    title: 'Target Company Job Board Sweep & Opportunity Scoring',
    description:
      'Verify active job application links and calculate match scores against living master resume.',
    initiator: 'SCHEDULE',
    status: 'PENDING_APPROVAL',
    priority: 'NORMAL',
    progressPercentage: 50,
    startedAt: '2026-09-24T16:00:00Z',
    assignedAgent: 'JobSearchAgent',
    subtasks: [
      {
        id: 'st-20',
        title: 'Scrape Careers Pages (Anthropic, OpenAI, Scale AI)',
        agent: 'JobSearchAgent',
        status: 'COMPLETED',
        startedAt: '2026-09-24T16:00:02Z',
        completedAt: '2026-09-24T16:01:20Z',
        durationMs: 78000,
        outputSummary: 'Discovered 4 new matching roles.',
      },
      {
        id: 'st-21',
        title: 'Automated Application Draft Creation',
        agent: 'ApplicationAgent',
        status: 'APPROVAL_REQUIRED',
        startedAt: '2026-09-24T16:01:21Z',
        outputSummary: 'Requires user approval to auto-submit draft application packet.',
      },
    ],
  },
];
