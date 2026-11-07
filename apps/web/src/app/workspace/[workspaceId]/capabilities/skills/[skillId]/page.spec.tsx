import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { capabilitiesApi } from '@/lib/api-client';
import SkillSubpage from './page';

const mockPush = jest.fn();
let mockParams = { workspaceId: 'ws-test-123', skillId: 'ats-audit' };

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    capabilitiesApi: {
      listSkills: jest.fn().mockResolvedValue([
        {
          id: 'cap-ats-audit',
          name: 'ats-audit',
          category: 'skill',
          description: 'Server description for ATS audit',
          enabled: true,
          version: '1.0.0',
          author: 'Vaeloom Core Team',
          type: 'core',
          config: {
            // The server returns `markdown_doc`; `api.request` camelCases it.
            markdownDoc: '# ATS Audit instructions',
            tags: ['ATS', 'Career'],
            autonomy: 'autonomous',
          },
          usageCount: 5,
          lastUsedAt: '2026-03-01T12:00:00Z',
        },
      ]),
      create: jest.fn().mockResolvedValue({ id: 'new-skill-id' }),
      update: jest.fn().mockResolvedValue({ id: 'cap-ats-audit', enabled: false }),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
});

describe('SkillSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { workspaceId: 'ws-test-123', skillId: 'ats-audit' };
  });

  it('renders breadcrumbs and skill header for a known skill', async () => {
    render(<SkillSubpage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /ats-audit/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to Skills')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Playground' })).toBeInTheDocument();
  });

  it('shows a load error with retry when the list fails and no row resolves', async () => {
    // A distinct workspace id keeps SWR's per-key cache from deduping the fetch
    // away (the previous test already populated ['workspace-skills', ws-test-123]).
    mockParams = { workspaceId: 'ws-error-test', skillId: 'non-existent-skill-xyz' };
    (capabilitiesApi.listSkills as jest.Mock).mockRejectedValueOnce(new Error('Network down'));

    render(<SkillSubpage />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load this skill")).toBeInTheDocument();
    });
    expect(screen.getByText('Network down')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => {
      expect(capabilitiesApi.listSkills).toHaveBeenCalledTimes(2);
    });
  });

  it('labels seeded rows as offline fallback when the skill list fails to load', async () => {
    mockParams = { workspaceId: 'ws-fallback-test', skillId: 'ats-audit' };
    (capabilitiesApi.listSkills as jest.Mock).mockRejectedValueOnce(new Error('Network down'));

    render(<SkillSubpage />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/offline fallback data/i);
    });
    // The seed row still resolves, so the detail renders rather than an error page.
    expect(screen.getByRole('heading', { level: 1, name: /ats-audit/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(capabilitiesApi.listSkills).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('renders empty state when skill is not found', async () => {
    mockParams = { workspaceId: 'ws-test-123', skillId: 'non-existent-skill-xyz' };
    render(<SkillSubpage />);

    await waitFor(() => {
      expect(screen.getByText(/Skill "non-existent-skill-xyz" not found/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all Skills/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-test-123/capabilities?category=skills');
  });
});
