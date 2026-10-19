import { fireEvent, render, screen } from '@testing-library/react';
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

describe('MemoryCorrectionPanel — windowed loading past the page cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('says how much is shown and continues the window on Load more', async () => {
    // The API caps page_size at 100. A workspace with more than that must not
    // silently confine corrections to the first window: the correction surface
    // exists precisely for rows (superseded ones) that can sit on any page.
    const page1 = Array.from({ length: 100 }, (_, i) =>
      supersededRow({ id: `id-p1-${i}`, title: `P1 row ${i}` }),
    );
    const page2 = Array.from({ length: 50 }, (_, i) =>
      supersededRow({ id: `id-p2-${i}`, title: `P2 row ${i}` }),
    );
    listMock.mockImplementation((params?: { page?: number }) =>
      Promise.resolve({
        memories: params?.page === 2 ? page2 : page1,
        total: 150,
        page: params?.page ?? 1,
        page_size: 100,
      }),
    );
    renderPanel();

    expect(await screen.findByText('Showing 100 of 150 memories')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Showing 150 of 150 memories')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    // The second window was appended, not swapped in: rows from both render.
    expect(screen.getByText('P1 row 0')).toBeInTheDocument();
    expect(screen.getByText('P2 row 0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('offers no Load more once the reported total is reached', async () => {
    mockList([supersededRow(), supersededRow({ id: 'second-id' })]);
    renderPanel();

    expect(await screen.findByText('Showing 2 of 2 memories')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});
