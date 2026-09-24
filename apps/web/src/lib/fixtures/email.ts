/**
 * Vaeloom Deterministic Email Intelligence & Recruiter Triage Fixtures
 * Strictly isolated demo fixtures — never claims live connection when disconnected.
 */

export interface ExtractedCareerEntity {
  type: 'INTERVIEW' | 'OFFER' | 'TASK' | 'DEADLINE';
  label: string;
  value: string;
  confidence: number;
  addedToMemory: boolean;
}

export interface EmailThreadItem {
  id: string;
  senderName: string;
  senderEmail: string;
  company: string;
  subject: string;
  preview: string;
  receivedAt: string;
  isRead: boolean;
  category: 'RECRUITER' | 'INTERVIEW_INVITE' | 'STATUS_UPDATE' | 'GENERAL';
  extractedEntities: ExtractedCareerEntity[];
  body: string;
}

export interface EmailSyncStatus {
  connected: boolean;
  provider: 'Google Workspace / Gmail' | 'Microsoft Outlook';
  accountEmail: string;
  lastSyncAt: string;
  syncHealth: 'HEALTHY' | 'NEEDS_REAUTH' | 'DISCONNECTED';
  totalThreadsTracked: number;
}

export const DEMO_EMAIL_SYNC_STATUS: EmailSyncStatus = {
  connected: true,
  provider: 'Google Workspace / Gmail',
  accountEmail: 'engineer@vaeloom.dev',
  lastSyncAt: '2026-09-24T17:00:00Z',
  syncHealth: 'HEALTHY',
  totalThreadsTracked: 42,
};

export const DEMO_EMAIL_THREADS: EmailThreadItem[] = [
  {
    id: 'em-1',
    senderName: 'Sarah Jenkins',
    senderEmail: 'sjenkins@anthropic.com',
    company: 'Anthropic',
    subject: 'Interview Invitation: Staff Systems Engineer (AI Infrastructure)',
    preview:
      'Hi Alex, the team was very impressed by your distributed runtime work. We would like to schedule a 60-minute technical session...',
    receivedAt: '2026-09-24T14:32:00Z',
    isRead: false,
    category: 'INTERVIEW_INVITE',
    extractedEntities: [
      {
        type: 'INTERVIEW',
        label: 'Interview Stage',
        value: 'System Architecture & Concurrency Deep Dive',
        confidence: 0.98,
        addedToMemory: true,
      },
      {
        type: 'DEADLINE',
        label: 'Scheduling Window',
        value: 'Next Tuesday or Wednesday (Oct 2 - Oct 3)',
        confidence: 0.95,
        addedToMemory: true,
      },
    ],
    body: `Hi Alex,

Thank you for your application for the Staff Systems Engineer position at Anthropic. The engineering leadership team reviewed your background and open-source contributions regarding sub-50ms multi-agent coordination.

We would love to invite you to a 60-minute technical architecture interview with our Foundation Infrastructure team.

Please let us know your availability between Tuesday, Oct 2 and Thursday, Oct 4.

Best regards,
Sarah Jenkins
Technical Talent Partner | Anthropic`,
  },
  {
    id: 'em-2',
    senderName: 'Marcus Vance',
    senderEmail: 'mvance@openai.com',
    company: 'OpenAI',
    subject: 'Update regarding your application for Distributed Systems Architect',
    preview:
      'Hello Alex, we have forwarded your portfolio and verifiable audit credential to the hiring committee...',
    receivedAt: '2026-09-23T19:15:00Z',
    isRead: true,
    category: 'STATUS_UPDATE',
    extractedEntities: [
      {
        type: 'TASK',
        label: 'Action Item',
        value: 'Hiring committee review in progress (response expected in 3 business days)',
        confidence: 0.92,
        addedToMemory: false,
      },
    ],
    body: `Hello Alex,

We wanted to share a quick update regarding your application for the Distributed Systems Architect role. Your application packet, including your recent benchmark reports, has been shared with the hiring committee.

You can expect to hear from our coordinator by Friday with next steps.

Warmly,
Marcus Vance
Talent Acquisition | OpenAI`,
  },
  {
    id: 'em-3',
    senderName: 'Elena Rostova',
    senderEmail: 'elena@scale.com',
    company: 'Scale AI',
    subject: 'Connecting regarding LLM Evaluation Infrastructure roles',
    preview:
      'Hey Alex, came across your work on deterministic verification harnesses. Would you be open to an informal conversation?',
    receivedAt: '2026-09-22T11:05:00Z',
    isRead: true,
    category: 'RECRUITER',
    extractedEntities: [
      {
        type: 'TASK',
        label: 'Recruiter Outreach',
        value: 'Informal 15-minute chat on evaluation architectures',
        confidence: 0.89,
        addedToMemory: false,
      },
    ],
    body: `Hey Alex,

I lead technical sourcing for our Core Generative AI teams at Scale. I saw your recent post analyzing zero-trust evaluation harnesses and deterministic action routing.

We're currently scaling our evaluation platform for frontier model customers and would love to chat if you're open to exploring new challenges.

Let me know if you have 15 minutes this week!

Best,
Elena Rostova
Scale AI`,
  },
];
