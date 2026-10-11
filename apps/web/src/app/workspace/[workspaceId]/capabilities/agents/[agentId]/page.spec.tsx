import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AgentSubpage from './page';

const mockPush = jest.fn();
let mockParams = { workspaceId: 'ws-test-123', agentId: 'resume_analyst' };

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    agentCatalogApi: {
      get: jest.fn().mockResolvedValue({
        agents: [
          {
            name: 'resume_analyst',
            title: 'Resume Analyst Agent',
            mission: 'Evaluates candidate resumes against ATS standards and parsing matrices.',
            isCanonical: true,
            defaultAutonomy: 'autonomous',
            requiredScopes: ['career:read', 'resumes:write'],
            toolNames: ['parse_pdf', 'score_ats'],
            tools: [
              { name: 'parse_pdf', requiredScope: 'resumes:read' },
              { name: 'score_ats', requiredScope: 'resumes:write' },
            ],
            memoryScopes: ['candidate_profile', 'job_description'],
          },
        ],
      }),
    },
    capabilitiesApi: {
      list: jest.fn().mockResolvedValue([
        {
          id: 'agent-resume_analyst',
          name: 'resume_analyst',
          category: 'agents',
          description: 'Evaluates candidate resumes',
          enabled: true,
          config: { autonomy: 'autonomous', max_react_rounds: 6 },
        },
      ]),
      update: jest.fn().mockResolvedValue({ id: 'agent-resume_analyst' }),
      test: jest.fn().mockResolvedValue({
        status: 'passed',
        executed: true,
        executionDurationMs: 42,
        validationErrors: [],
        result: { verdict: 'approved' },
      }),
    },
  };
});

describe('AgentSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { workspaceId: 'ws-test-123', agentId: 'resume_analyst' };
  });

  it('renders breadcrumbs and agent title for a known agent', async () => {
    render(<AgentSubpage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Resume analyst Agent/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to Agents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat with Agent/i })).toBeInTheDocument();
  });

  it('renders empty state when agent is not found', async () => {
    mockParams = { workspaceId: 'ws-test-123', agentId: 'non-existent-agent-xyz' };
    render(<AgentSubpage />);

    await waitFor(() => {
      expect(screen.getByText(/Agent "non-existent-agent-xyz" not found/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all Agents/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-test-123/capabilities?category=agents');
  });
});
