import { render, screen } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { MemoryCorrectionPanel } from '@/components/memory/MemoryCorrectionPanel';
import { memoryApi } from '@/lib/api-client';

// `jest` is intentionally the ambient global, NOT imported from '@jest/globals'.
// Importing it from there opts out of babel-plugin-jest-hoist, so the jest.mock
// factories below never registered and every assertion ran against the real
// api-client module.

/**
 * Regression tests for the corrections ledger defects.
 *
 * Every assertion is a negative control against the previous implementation:
 * the list request omitted `include_superseded`, so superseded rows never
 * arrived and "Re-Correct" was unreachable; the `supersedes_id` pointer was
 * read only from snake_case fields, so a camelCased payload rendered no link.
 */

const ANCESTOR_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
const MEMORY_ID = 'bbbbbbbb-5555-6666-7777-888888888888';

const mockToast = jest.fn();

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/api-client', () => ({
  memoryApi: {
    list: jest.fn(),
    supersede: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const listMock = memoryApi.list as jest.Mock;

function supersededRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMORY_ID,
    type: 'note',
    title: 'Corrected belief',
    summary: 'Revised summary',
    status: 'superseded',
    tags: [],
    ...overrides,
  };
}

function mockList(memories: Record<string, unknown>[]) {
  listMock.mockResolvedValue({
    memories,
    total: memories.length,
    page: 1,
    page_size: 100,
  });
}

// SWR's default cache is module-level, so without a per-render provider the
// first test's payload is served to every later test and the fetcher never
// runs again.
function renderPanel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryCorrectionPanel workspaceId="ws-1" />
    </SWRConfig>,
  );
}

describe('MemoryCorrectionPanel — corrections ledger regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests superseded rows and renders them with a SUPERSEDED badge', async () => {
    mockList([supersededRow({ supersedesId: ANCESTOR_ID })]);
    renderPanel();

    expect(await screen.findByText('SUPERSEDED')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'ws-1',
        include_superseded: true,
      }),
    );
  });

  it('keeps Re-Correct reachable on a superseded row', async () => {
    mockList([supersededRow({ supersedesId: ANCESTOR_ID })]);
    renderPanel();

    expect(await screen.findByText('SUPERSEDED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-Correct' })).toBeEnabled();
  });

  it('renders a workspace-scoped lineage link for a camelCased supersedesId', async () => {
    mockList([supersededRow({ supersedesId: ANCESTOR_ID })]);
    renderPanel();

    const link = await screen.findByRole('link', { name: ANCESTOR_ID.slice(0, 8) });
    expect(link).toHaveAttribute('href', `/workspace/ws-1/memory/${ANCESTOR_ID}`);
  });

  it('falls back to metadata.supersedes_id when the row carries snake_case', async () => {
    mockList([supersededRow({ metadata: { supersedes_id: ANCESTOR_ID } })]);
    renderPanel();

    const link = await screen.findByRole('link', { name: ANCESTOR_ID.slice(0, 8) });
    expect(link).toHaveAttribute('href', `/workspace/ws-1/memory/${ANCESTOR_ID}`);
  });

  it('shows a retryable error, never a first-run empty state, when the list request fails', async () => {
    // `/memory/corrections` must not read as "this workspace has no memories"
    // while its one request is failing: that empty state is reserved for a
    // resolved zero-row response.
    listMock.mockRejectedValue(new Error('connection refused'));
    renderPanel();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load memories/i);
    expect(screen.queryByText('No memories found')).toBeNull();
  });
});
