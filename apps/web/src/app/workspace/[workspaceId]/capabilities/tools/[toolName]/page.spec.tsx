import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ToolSubpage from './page';

const mockPush = jest.fn();
let mockParams = { workspaceId: 'ws-test-123', toolName: 'ats_scan' };

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
    capabilitiesApi: {
      list: jest.fn().mockResolvedValue([
        {
          id: 'tool-ats_scan',
          name: 'ats_scan',
          category: 'tool',
          enabled: true,
        },
      ]),
      update: jest.fn().mockResolvedValue({ id: 'tool-ats_scan', enabled: false }),
      create: jest.fn().mockResolvedValue({ id: 'tool-ats_scan' }),
      test: jest.fn().mockResolvedValue({
        status: 'success',
        executed: true,
        executionDurationMs: 25,
        validationErrors: [],
        result: { score: 95 },
      }),
    },
  };
});

describe('ToolSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { workspaceId: 'ws-test-123', toolName: 'ats_scan' };
  });

  it('renders breadcrumbs and tool header for a known tool', async () => {
    render(<ToolSubpage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /ats_scan/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to Tools')).toBeInTheDocument();
  });

  it('renders empty state when tool is not found', async () => {
    mockParams = { workspaceId: 'ws-test-123', toolName: 'unknown-tool-xyz' };
    render(<ToolSubpage />);

    await waitFor(() => {
      expect(screen.getByText(/Tool "unknown-tool-xyz" not found/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all Tools/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-test-123/capabilities?category=tools');
  });
});
