import MemoryPage from '@/app/workspace/[workspaceId]/memory/page';
import { TYPE_FILTERS } from '@/app/workspace/[workspaceId]/memory/typeFilters';
import { MemoryCard } from '@vaeloom/ui-kit';
import { memoryApi, memoryFeedApi, vaultSyncApi } from '@/lib/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';

const mockToast = jest.fn();

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockSearchParams = new Map<string, string>();

jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/lib/dynamic-imports', () => ({
  DynamicGraphViewer: () => null,
}));

jest.mock('@/components/memory/VaultSyncPanel', () => ({ VaultSyncPanel: () => null }));
jest.mock('@/components/memory/MemoryCorrectionPanel', () => ({
  MemoryCorrectionPanel: () => null,
}));
jest.mock('@/components/memory/ScaleMemoryViewer', () => ({ ScaleMemoryViewer: () => null }));

jest.mock('@/lib/api-client', () => ({
  memoryApi: {
    list: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    export: jest.fn(),
    import: jest.fn(),
    bulkStatus: jest.fn(),
  },
  memoryFeedApi: {
    feed: jest.fn(),
    lineage: jest.fn(),
  },
  vaultSyncApi: {
    getStatus: jest.fn(),
  },
}));

/**
 * Invariant tests for the memory UI's fabricated-data defects.
 *
 * These assert the rules directly instead of driving the 857-line page through
 * a full render, so they stay meaningful when the page's layout changes.
 */

// The authoritative taxonomy: `MemoryType` in `apps/api/src/api/schemas/memory.py`,
// mirrored in `@vaeloom/shared-types`. 6 canonical + 16 enterprise additive +
// the `note`/`fact` legacy aliases.
//
// This list was wrong twice. First it mirrored a *source format* set
// (document/email/code/note/conversation/webpage/structured) that the API never
// accepted as memory types — only `document` and `note` overlapped, so five of
// the seven filter options matched nothing. Before that it used
// profile/career/skill/project/decision/goal/insight/task/relationship, which
// included `task` — also not a real type. Either way the filter silently emptied
// the list rather than looking broken.
const MEMORY_TYPES = [
  'profile',
  'document',
  'career',
  'episodic',
  'preference',
  'working',
  'note',
  'fact',
  'project',
  'skill',
  'organization',
  'relationship',
  'event',
  'insight',
  'goal',
  'feedback',
  'decision',
  'knowledge',
  'reference',
  'contact',
  'financial',
  'health',
  'learning',
  'workflow',
] as const;

describe('memory type filters', () => {
  it('every filter id except "all" is a real MemoryType', () => {
    const bogus = TYPE_FILTERS.map((f) => f.id).filter(
      (id) => id !== 'all' && !(MEMORY_TYPES as readonly string[]).includes(id),
    );
    expect(bogus).toEqual([]);
  });

  it('offers every real MemoryType', () => {
    const ids = TYPE_FILTERS.map((f) => f.id);
    for (const t of MEMORY_TYPES) {
      expect(ids).toContain(t);
    }
  });

  it('offers no source-format values the API rejects', () => {
    const ids = TYPE_FILTERS.map((f) => f.id);
    for (const bogus of ['email', 'code', 'conversation', 'webpage', 'structured', 'task']) {
      expect(ids).not.toContain(bogus);
    }
  });

  it('has a non-empty label for every option', () => {
    for (const f of TYPE_FILTERS) {
      expect(f.label.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    const ids = TYPE_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MemoryCard confidence', () => {
  it('omits the indicator entirely when no score was stored', () => {
    // `confidence` was a required prop, which pushed callers to invent a
    // placeholder (the memory page used `?? 0.85`) and render it as if measured.
    render(<MemoryCard id="m-1" content="body" source="file" timestamp="now" />);
    expect(screen.queryByText(/85%/)).toBeNull();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('renders the real score when one exists', () => {
    render(<MemoryCard id="m-1" content="body" source="file" timestamp="now" confidence={0.42} />);
    expect(screen.getByText(/42%/)).toBeTruthy();
  });
});

const listMock = memoryApi.list as jest.Mock;
const searchMock = memoryApi.search as jest.Mock;
const feedMock = memoryFeedApi.feed as jest.Mock;
const statusMock = vaultSyncApi.getStatus as jest.Mock;

const makeMemory = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-1',
  title: 'Distributed systems notes',
  summary: 'Summary of distributed systems',
  content: null,
  type: 'note',
  tags: ['architecture'],
  confidence: null,
  source: 'manual',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  createdBy: 'u-1',
  updatedBy: 'u-1',
  tenantId: 't-1',
  ...overrides,
});

const VAULT_STATUS = {
  workspaceId: 'ws-1',
  status: 'unknown',
  installed: false,
  daemonStatus: 'not_connected',
  lastClientHeartbeat: null,
  lastError: null,
  branch: 'main',
  totalNotes: 0,
  vaultMemories: 0,
  conflictsCount: 0,
  autoIngest: false,
  debounceSeconds: 30,
  rebaseIntervalMinutes: 5,
  engine: 'client',
  engineNote: '',
};

const renderPage = () =>
  render(
    <SWRConfig
      value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
    >
      <MemoryPage />
    </SWRConfig>,
  );

describe('memory page rendering honesty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.clear();
    listMock.mockImplementation((params: { type?: string; page?: number } = {}) => {
      if (params.type === 'task') {
        return Promise.resolve({ memories: [], total: 0, page: 1, pageSize: 1 });
      }
      return Promise.resolve({ memories: [makeMemory()], total: 1, page: 1, pageSize: 100 });
    });
    searchMock.mockResolvedValue([]);
    feedMock.mockResolvedValue({ feed: [], total: 0, page: 1, pageSize: 50, stats: {} });
    statusMock.mockResolvedValue(VAULT_STATUS);
  });

  it('create modal offers exactly the canonical memory types, not legacy fabrications', async () => {
    renderPage();
    await screen.findByText('Summary of distributed systems');
    fireEvent.click(screen.getByRole('button', { name: /new note \/ memory/i }));
    const values = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values.length).toBe(MEMORY_TYPES.length);
    for (const v of values) {
      expect((MEMORY_TYPES as readonly string[]).includes(v)).toBe(true);
    }
    expect(values).not.toContain('task');
  });

  it('renders no fabricated sync copy', async () => {
    renderPage();
    await screen.findByText('Summary of distributed systems');
    expect(screen.queryByText(/auto-push/i)).toBeNull();
    expect(screen.queryByText(/rebase/i)).toBeNull();
    expect(screen.queryByText(/30s/i)).toBeNull();
  });

  it('shows an error with retry when the memory list fails, never a success state', async () => {
    listMock.mockImplementation((params: { type?: string } = {}) => {
      if (params.type === 'task') {
        return Promise.resolve({ memories: [], total: 0, page: 1, pageSize: 1 });
      }
      return Promise.reject(new Error('list down'));
    });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/couldn't load memories/i)).toBeTruthy();
    expect(screen.queryByText(/Your Memory is ready/i)).toBeNull();
    const callsBefore = listMock.mock.calls.length;
    fireEvent.click(within(alert).getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('reports the true total instead of claiming the window is everything', async () => {
    listMock.mockImplementation((params: { type?: string; page?: number } = {}) => {
      if (params.type === 'task') {
        return Promise.resolve({ memories: [], total: 0, page: 1, pageSize: 1 });
      }
      const page = params.page ?? 1;
      return Promise.resolve({
        memories: [makeMemory({ id: `m-${page}` })],
        total: 137,
        page,
        pageSize: 100,
      });
    });
    renderPage();
    await screen.findByText('Showing 1 of 137 memories');
    expect(screen.queryByText(/No matching memories/i)).toBeNull();
    expect(screen.queryByText(/No records match/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    await screen.findByText('Showing 2 of 137 memories');
  });

  it('keeps showing ready memories when a background refresh fails', async () => {
    renderPage();
    await screen.findByText('Summary of distributed systems');
    listMock.mockClear();
    listMock.mockImplementation((params: { type?: string } = {}) => {
      if (params.type === 'task') {
        return Promise.resolve({ memories: [], total: 0, page: 1, pageSize: 1 });
      }
      return Promise.reject(new Error('refresh down'));
    });
    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }));
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.getByText('Summary of distributed systems')).toBeTruthy();
    expect(screen.queryByText(/Your Memory is ready/i)).toBeNull();
  });

  it('shows scan results with an explicit cap note and no "no records" claim', async () => {
    searchMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        memory: makeMemory({ id: `s-${i}` }),
        score: 0.9,
      })),
    );
    renderPage();
    await screen.findByText('Summary of distributed systems');
    fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
      target: { value: 'distributed' },
    });
    await waitFor(
      () =>
        expect(searchMock).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'distributed', workspace_id: 'ws-1', top_k: 20 }),
        ),
      { timeout: 3000 },
    );
    await screen.findByText('Top 20 matches', {}, { timeout: 3000 });
    expect(screen.queryByText(/No records match/i)).toBeNull();
  });

  it('distinguishes "no strong matches" from "no records"', async () => {
    renderPage();
    await screen.findByText('Summary of distributed systems');
    fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
      target: { value: 'zzz-nothing' },
    });
    await screen.findByText(/No strong matches/i, {}, { timeout: 3000 });
    expect(screen.queryByText(/No records match/i)).toBeNull();
  });

  it('honours ?query= deep links on mount', async () => {
    mockSearchParams.set('query', 'architecture');
    searchMock.mockResolvedValue([{ memory: makeMemory({ id: 's-1' }), score: 0.8 }]);
    renderPage();
    const input = screen.getByPlaceholderText(/search memories/i) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('architecture'));
    await waitFor(() => expect(searchMock).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('never renders invented KPI zeros when the feed request fails', async () => {
    // The cards used to fall back to `?? 0` / `?? memItems.length`, painting a
    // confident "0 memories" dashboard over an API that never answered.
    feedMock.mockRejectedValue(new Error('feed down'));
    renderPage();
    await screen.findByText('Memory stats unavailable');
    expect(screen.getByText('feed down')).toBeTruthy();
    expect(screen.queryByText('Indexed knowledge items')).toBeNull();
    expect(screen.queryByText('Autonomous background extractions')).toBeNull();
    expect(screen.queryByText('Immutable version audit trail')).toBeNull();
    const callsBefore = feedMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(feedMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('marks KPI captions as not refreshed when a background feed refresh fails', async () => {
    renderPage();
    await screen.findByText('Indexed knowledge items');
    feedMock.mockImplementation(() => Promise.reject(new Error('feed refresh down')));
    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }));
    await screen.findByText('Indexed knowledge items · not refreshed');
  });
});
