import MemoryDetailPage from '@/app/workspace/[workspaceId]/memory/[memoryId]/page';
import { memoryApi, memoryFeedApi } from '@/lib/api-client';
import { render, screen, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';

/**
 * The detail page's lineage strip used to label whichever record was open
 * "Current Version" with an Active badge — so a superseded ancestor rendered
 * a page whose header said SUPERSEDED above a card claiming to be current —
 * and it never rendered `chainForwards`, hiding the successor that actually
 * holds the current text.
 */

const mockParams: { workspaceId: string; memoryId: string } = {
  workspaceId: 'ws-1',
  memoryId: 'm1',
};

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/api-client', () => {
  class MockApiError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError: MockApiError,
    memoryApi: { get: jest.fn(), supersede: jest.fn() },
    memoryFeedApi: { lineage: jest.fn() },
  };
});

const getMock = memoryApi.get as unknown as jest.Mock;
const lineageMock = memoryFeedApi.lineage as unknown as jest.Mock;

const makeMemory = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  title: 'Original Fact',
  summary: 'the original wording',
  content: '',
  type: 'note',
  status: 'superseded',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const renderPage = () =>
  render(
    <SWRConfig
      value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
    >
      <MemoryDetailPage />
    </SWRConfig>,
  );

describe('memory detail page lineage honesty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the active successor and does not relabel a superseded record as current', async () => {
    const ancestor = makeMemory();
    const successor = makeMemory({
      id: 'm2',
      title: 'Revised Fact',
      summary: 'the corrected wording',
      status: 'active',
      supersedesId: 'm1',
    });
    mockParams.memoryId = 'm1';
    getMock.mockResolvedValue(ancestor);
    lineageMock.mockResolvedValue({
      memory: ancestor,
      chainBackwards: [ancestor],
      chainForwards: [successor],
      provenance: [],
      agentActions: [],
    });

    renderPage();

    // The successor is fetched in `chainForwards` and must actually render.
    const strip = await screen.findByTestId('lineage-chain');
    const successorCard = within(strip).getByText('Revised Fact').closest('a');
    expect(successorCard).not.toBeNull();
    expect(within(successorCard as HTMLElement).getByText(/Current Version/)).toBeTruthy();
    expect(within(successorCard as HTMLElement).getByText('Active')).toBeTruthy();

    // The record being viewed is superseded; its own card must say so.
    const ancestorCard = within(strip).getByText('Original Fact').closest('a');
    expect(ancestorCard).not.toBeNull();
    expect(within(ancestorCard as HTMLElement).queryByText(/Current Version/)).toBeNull();
    expect(within(ancestorCard as HTMLElement).queryByText('Active')).toBeNull();
    expect(within(ancestorCard as HTMLElement).getByText('This Version')).toBeTruthy();
  });

  it('still marks the active head as current when the head is what is open', async () => {
    const ancestor = makeMemory();
    const head = makeMemory({
      id: 'm2',
      title: 'Revised Fact',
      summary: 'the corrected wording',
      status: 'active',
      supersedesId: 'm1',
    });
    mockParams.memoryId = 'm2';
    getMock.mockResolvedValue(head);
    lineageMock.mockResolvedValue({
      memory: head,
      chainBackwards: [head, ancestor],
      chainForwards: [],
      provenance: [],
      agentActions: [],
    });

    renderPage();

    const strip = await screen.findByTestId('lineage-chain');
    const headCard = within(strip).getByText('Revised Fact').closest('a');
    expect(headCard).not.toBeNull();
    expect(within(headCard as HTMLElement).getByText(/Current Version/)).toBeTruthy();
    expect(within(headCard as HTMLElement).getByText('Active')).toBeTruthy();

    const ancestorCard = within(strip).getByText('Original Fact').closest('a');
    expect(ancestorCard).not.toBeNull();
    expect(within(ancestorCard as HTMLElement).queryByText(/Current Version/)).toBeNull();
    expect(within(ancestorCard as HTMLElement).getByText(/Ancestor/)).toBeTruthy();
  });
});
