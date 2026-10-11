import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
            doc: '# ATS Audit instructions',
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
