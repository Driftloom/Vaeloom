import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

import { DocumentsHub } from '../DocumentsHub';
import { documentApi } from '@/lib/api-client';
import type { DocumentResponse, FolderResponse, FolderTreeItem } from '@/lib/api-client';
import { formatDate, previewKind } from '@/lib/document-format';

/**
 * THE PREVIOUS VERSION OF THIS FILE WAS VACUOUS.
 *
 * It mocked `documentApi.getFolders` and `documentApi.getVersions`. NEITHER
 * METHOD EXISTS — the real names are `listFolders` and `listVersions`. So
 * `fetchFolders` awaited `Promise.all([undefined, undefined])`, resolved,
 * called `setFolders(undefined)`, and `DocumentFolderTree` then threw a
 * TypeError that an empty `catch {}` swallowed. The suite was green while
 * exercising a real crash. Every fixture was snake_case too
 * (`workspace_id`, `metadata.size_bytes`, `sync_status`, `memory_id`), none of
 * which `transformKeys` can now produce.
 *
 * Everything below mocks `documentApi` COMPLETELY, with camelCase fixtures typed
 * against the real interfaces, so an unmocked method is a loud failure instead of
 * a silent `undefined`.
 */

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  },
}));

jest.mock('remark-gfm', () => () => {});

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock('@/lib/api-client', () => ({
  documentApi: {
    // Reads
    list: jest.fn(),
    search: jest.fn(),
    // Added with the workspace aggregates. WITHOUT this entry the hook's
    // `documentApi.stats(...)` threw a TypeError on every test, was swallowed by
    // the hook's own catch, and every render silently showed the stats ERROR
    // state — a suite that stayed green while the bar was broken.
    stats: jest.fn(),
    process: jest.fn(),
    getById: jest.fn(),
    getContent: jest.fn(),
    listFolders: jest.fn(),
    getFolderTree: jest.fn(),
    listVersions: jest.fn(),
    listShares: jest.fn(),
    actions: jest.fn(),
    audit: jest.fn(),
    compare: jest.fn(),
    workspaceActions: jest.fn(),
    workspaceAgentActions: jest.fn(),
    // Writes
    upload: jest.fn(),
    uploadWithProgress: jest.fn(),
    bulkUpload: jest.fn(),
    bulkDownload: jest.fn(),
    rename: jest.fn(),
    move: jest.fn(),
    updateTags: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
    bulkDelete: jest.fn(),
    undo: jest.fn(),
    syncMemory: jest.fn(),
    bulkSyncMemory: jest.fn(),
    autoOrganize: jest.fn(),
    createFolder: jest.fn(),
    updateFolder: jest.fn(),
    deleteFolder: jest.fn(),
    createVersion: jest.fn(),
    restoreVersion: jest.fn(),
    createShare: jest.fn(),
    revokeShare: jest.fn(),
  },
  legacySharePermission: (v: string) => (String(v).toLowerCase() === 'write' ? 'write' : 'read'),
  memoryApi: { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) },
}));

const WS = 'ws-1';
const PAGE_SIZE = 50;

/** Local-time construction, per `formatDate`'s documented guidance. */
const UPDATED = new Date(2026, 8, 30);

const folders: FolderResponse[] = [
  {
    id: 'f-legal',
    workspaceId: WS,
    parentId: null,
    name: 'Legal Contracts',
    createdAt: UPDATED.toISOString(),
    updatedAt: UPDATED.toISOString(),
  },
];

const folderTree: FolderTreeItem[] = [
  {
    id: 'f-legal',
    workspaceId: WS,
    parentId: null,
    name: 'Legal Contracts',
    createdAt: UPDATED.toISOString(),
    children: [],
  },
];

const cleanCsv: DocumentResponse = {
  id: 'doc-1',
  workspaceId: WS,
  folderId: null,
  path: 'sample_financials.csv',
  type: 'csv',
  status: 'ACTIVE',
  scanStatus: 'CLEAN',
  detectedMimeType: 'text/csv',
  createdAt: UPDATED.toISOString(),
  updatedAt: UPDATED.toISOString(),
  deletedAt: null,
  metadata: { size: 1024, tags: ['finance'], syncStatus: 'synced', memoryId: 'mem-1' },
};

const quarantinedMarkdown: DocumentResponse = {
  id: 'doc-2',
  workspaceId: WS,
  folderId: 'f-legal',
  path: 'archive/architecture_spec.md',
  type: 'markdown',
  scanStatus: 'MALICIOUS',
  scanResult: 'Embedded script rejected',
  createdAt: UPDATED.toISOString(),
  updatedAt: UPDATED.toISOString(),
  deletedAt: null,
  metadata: { size: 2048 },
};

const pendingDocx: DocumentResponse = {
  id: 'doc-3',
  workspaceId: WS,
  folderId: null,
  path: 'contract.docx',
  type: 'docx',
  scanStatus: 'PENDING',
  createdAt: UPDATED.toISOString(),
  updatedAt: UPDATED.toISOString(),
  deletedAt: null,
  metadata: {},
};

const archivedDoc: DocumentResponse = {
  id: 'doc-4',
  workspaceId: WS,
  folderId: null,
  path: 'old_notes.txt',
  type: 'text',
  scanStatus: 'CLEAN',
  createdAt: UPDATED.toISOString(),
  updatedAt: UPDATED.toISOString(),
  deletedAt: UPDATED.toISOString(),
  metadata: { size: 10 },
};

const ALL_DOCS = [cleanCsv, quarantinedMarkdown, pendingDocx];

/**
 * Workspace aggregates the stand-in stats endpoint returns by default.
 *
 * `activeShareCount` is present on purpose: it is the number no `DocumentResponse`
 * can express, so its whole journey — request -> card — is only observable with a
 * real value supplied.
 */
const STATS = {
  totalDocuments: 128,
  archivedDocuments: 17,
  totalBytes: 5 * 1024 * 1024,
  cleanCount: 121,
  quarantinedCount: 3,
  scanningCount: 2,
  folderCount: 4,
  activeShareCount: 7,
};

/**
 * Which bucket a row belongs to, as a SERVER-SIDE `?category=` filter would see it.
 *
 * The vocabulary is the client's `DocumentCategoryId` set, which is what the list
 * endpoint is now asked to filter by. `previewKind` is used rather than a second
 * hand-rolled classifier so the fixture cannot drift from the real MIME/extension
 * mapping; and an unclassifiable row falls into `documents`, which is the same
 * fallback the taxonomy used to apply in the browser.
 *
 * This lives in the TEST stand-in precisely because the production client no
 * longer classifies rows: the server owns the decision now.
 */
function bucketOf(doc: DocumentResponse): string {
  if (doc.metadata?.category === 'vault_note' || doc.type === 'vault_note') return 'vault_notes';
  const kind = previewKind(doc.detectedMimeType ?? null, null, doc.type, { path: doc.path });
  const byKind: Record<string, string> = {
    markdown: 'documents',
    text: 'documents',
    pdf: 'documents',
    csv: 'spreadsheets',
    image: 'images',
    code: 'code',
  };
  if (byKind[kind]) return byKind[kind];
  const ext = doc.path.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'xlsm', 'ods', 'numbers'].includes(ext)) return 'spreadsheets';
  if (['doc', 'docx', 'odt', 'ppt', 'pptx', 'odp', 'key', 'pages'].includes(ext))
    return 'documents';
  return 'documents';
}

/**
 * A stand-in for `GET /documents` that honours `folder_id`, `include_archived` and
 * `category`, which is what makes the folder-filter and category-filter assertions
 * meaningful: the SERVER decides the rows, so a passing test cannot be a
 * client-side filter that happens to agree.
 */
function listImpl(params?: Record<string, unknown>) {
  const page = Number(params?.page ?? 1);
  const folderId = (params?.folder_id as string | null | undefined) ?? null;
  const includeArchived = Boolean(params?.include_archived);
  const category = (params?.category as string | null | undefined) ?? null;
  const pool = ALL_DOCS.filter((doc) => (folderId ? doc.folderId === folderId : true))
    .filter((doc) => includeArchived || !doc.deletedAt)
    .filter((doc) => (category ? bucketOf(doc) === category : true));
  const start = (page - 1) * PAGE_SIZE;
  return Promise.resolve({
    documents: pool.slice(start, start + PAGE_SIZE),
    total: pool.length,
    page,
    pageSize: PAGE_SIZE,
  });
}

/**
 * A stand-in for `GET /documents/search`, which now answers with a paginated
 * ENVELOPE rather than a bare array. `matched` is what the server found overall;
 * the returned window is the slice at `offset`.
 */
function searchImpl(
  _ws: string,
  query: string,
  folderId?: string | null,
  pagination?: { limit?: number; offset?: number; category?: string | null },
) {
  const limit = pagination?.limit ?? PAGE_SIZE;
  const offset = pagination?.offset ?? 0;
  const folder = folderId ?? null;
  const category = pagination?.category ?? null;
  const matched = ALL_DOCS.filter((doc) => doc.path.toLowerCase().includes(query.toLowerCase()))
    .filter((doc) => (folder ? doc.folderId === folder : true))
    .filter((doc) => (category ? bucketOf(doc) === category : true));
  return Promise.resolve({
    documents: matched.slice(offset, offset + limit),
    total: matched.length,
    limit,
    offset,
  });
}

beforeAll(() => {
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = jest.fn();
  if (!Blob.prototype.arrayBuffer) {
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value: function arrayBuffer(this: Blob) {
        return new Promise<ArrayBuffer>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(this);
        });
      },
    });
  }
  if (!Blob.prototype.text) {
    Object.defineProperty(Blob.prototype, 'text', {
      configurable: true,
      value: function text(this: Blob) {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsText(this);
        });
      },
    });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  mockToast.mockReset();
  (documentApi.list as jest.Mock).mockImplementation(listImpl);
  (documentApi.search as jest.Mock).mockImplementation(searchImpl);
  (documentApi.stats as jest.Mock).mockResolvedValue(STATS);
  (documentApi.listFolders as jest.Mock).mockResolvedValue(folders);
  (documentApi.getFolderTree as jest.Mock).mockResolvedValue(folderTree);
  (documentApi.createFolder as jest.Mock).mockImplementation(
    (_ws: string, name: string, parentId?: string | null) =>
      Promise.resolve({
        id: 'f-new',
        workspaceId: WS,
        parentId: parentId ?? null,
        name,
        createdAt: UPDATED.toISOString(),
        updatedAt: UPDATED.toISOString(),
      }),
  );
  (documentApi.deleteFolder as jest.Mock).mockResolvedValue(undefined);
  (documentApi.archive as jest.Mock).mockImplementation((id: string) =>
    Promise.resolve({ ...cleanCsv, id }),
  );
  (documentApi.restore as jest.Mock).mockImplementation((id: string) =>
    Promise.resolve({ ...cleanCsv, id }),
  );
  (documentApi.delete as jest.Mock).mockResolvedValue(undefined);
  (documentApi.rename as jest.Mock).mockImplementation((id: string, _ws: string, path: string) =>
    Promise.resolve({ ...cleanCsv, id, path }),
  );
  (documentApi.move as jest.Mock).mockImplementation((id: string) =>
    Promise.resolve({ ...cleanCsv, id }),
  );
  (documentApi.bulkDelete as jest.Mock).mockResolvedValue({
    deletedCount: 1,
    documentIds: ['doc-1'],
  });
  (documentApi.syncMemory as jest.Mock).mockResolvedValue({
    success: true,
    documentId: 'doc-1',
    workspaceId: WS,
    memoryId: 'mem-9',
    status: 'synced',
  });
  (documentApi.bulkSyncMemory as jest.Mock).mockResolvedValue({
    syncedCount: 1,
    failedCount: 0,
    items: [],
  });
  (documentApi.listVersions as jest.Mock).mockResolvedValue([]);
  (documentApi.getContent as jest.Mock).mockResolvedValue(new Blob(['col1,col2']));
  (documentApi.autoOrganize as jest.Mock).mockResolvedValue({
    message: 'ok',
    organizedCount: 0,
    foldersCreated: [],
    movedDocuments: [],
  });
});

/** The table body row containing `name`. Fails loudly rather than returning null. */
function rowFor(name: string): HTMLElement {
  const row = Array.from(document.querySelectorAll('tbody tr')).find((tr) =>
    tr.textContent?.includes(name),
  );
  if (!row) throw new Error(`no table row rendered for "${name}"`);
  return row;
}

/** The category tab panel — the region the results live in. */
function panel(): HTMLElement {
  return screen.getByRole('tabpanel');
}

/**
 * One `<td>` by column index: select, name, security, size, updated, actions.
 * Addressed by position because several columns legitimately render the same
 * word — the Security cell also says "Not reported" — so a text query alone
 * cannot tell which verdict is being asserted.
 *
 * There is no `version` entry and there is no Version column. It rendered "Not
 * reported" in every row because its only source, `DocumentVersionResponse
 * .versionNumber`, needs a per-document request; see the note at the top of
 * `parts/DocumentsTable.tsx`. `versionCount()` below pins the fact that it is
 * gone rather than leaving the shift silent.
 */
const COL = {
  select: 0,
  name: 1,
  security: 2,
  size: 3,
  updated: 4,
  actions: 5,
} as const;

/**
 * The table's column headers, in order.
 *
 * Asserted rather than assumed so that adding, removing or reordering a column
 * is a test failure with a readable diff instead of a silently wrong `COL` index
 * pointing at the neighbouring cell.
 */
function headerLabels(): string[] {
  return Array.from(document.querySelectorAll('thead th')).map(
    (th) => th.textContent?.trim() ?? '',
  );
}

function cellFor(name: string, column: keyof typeof COL): HTMLElement {
  return within(rowFor(name)).getAllByRole('cell')[COL[column]] as HTMLElement;
}

const renderHub = (props: Partial<React.ComponentProps<typeof DocumentsHub>> = {}) =>
  render(<DocumentsHub workspaceId={WS} {...props} />);

/**
 * How long to wait for an async render to land.
 *
 * The repo sets no `asyncUtilTimeout`, so Testing Library defaults to 1s. That
 * is tight enough to fail intermittently when the full suite runs in parallel —
 * these tests mock the network and resolve immediately, so a slow tick is
 * scheduler contention, not a behaviour under test. Widening the wait keeps a
 * loaded machine from reporting a false failure without weakening any assertion.
 */
const ASYNC_WAIT = { timeout: 5000 };

/** Render and wait for the first document list to land. */
async function renderLoaded(
  props: Partial<React.ComponentProps<typeof DocumentsHub>> = {},
  firstRow = 'sample_financials.csv',
) {
  const utils = renderHub(props);
  await screen.findByRole('button', { name: firstRow }, ASYNC_WAIT);
  return utils;
}

describe('DocumentsHub — document rows render real values', () => {
  it('renders the level-1 heading the e2e specs assert on', async () => {
    await renderLoaded();
    expect(
      await screen.findByRole('heading', { level: 1, name: /workspace files/i }),
    ).toBeInTheDocument();
  });

  it('renders the real file name, the formatted byte size and a valid formatted date', async () => {
    await renderLoaded();

    const row = rowFor('sample_financials.csv');

    // The accessible name of the name button is EXACTLY the file name; that is
    // the contract `e2e/files-chat.spec.ts` matches with `exact: true`.
    const nameButton = within(row).getByRole('button', { name: 'sample_financials.csv' });
    expect(nameButton).toBeInTheDocument();
    // `metadata.size` is 1024 -> "1.0 KB" through `formatSize`. Reading
    // `metadata.size_bytes` would render the em dash instead, which is what this
    // assertion catches.
    expect(within(row).getByText('1.0 KB')).toBeInTheDocument();

    const expectedDate = formatDate(UPDATED);
    // Guards the formatter itself, so a failure here is diagnosable: the shared
    // `formatDate` promises never to emit "Invalid Date", and never an em dash
    // for a real timestamp.
    expect(expectedDate).not.toBe('Invalid Date');
    expect(expectedDate).not.toBe('-');
    expect(expectedDate).not.toBe('—');

    const dateCell = within(row).getByText(expectedDate);
    expect(dateCell.textContent).not.toMatch(/Invalid Date/);
    expect(dateCell.textContent).not.toBe('-');
    expect(dateCell.textContent).toBe(expectedDate);
  });

  it('renders the scan-status badge from scanStatus for every state', async () => {
    await renderLoaded();

    // `scanStateOf` maps CLEAN -> clean, MALICIOUS -> quarantined,
    // PENDING -> scanning. The Security cell is what these labels land in.
    expect(cellFor('sample_financials.csv', 'security')).toHaveTextContent('Clean');
    expect(cellFor('architecture_spec.md', 'security')).toHaveTextContent('Quarantined');
    expect(cellFor('contract.docx', 'security')).toHaveTextContent('Scanning');

    // Not a silent drop: the verdict cell is never blank.
    for (const name of ['sample_financials.csv', 'architecture_spec.md', 'contract.docx']) {
      expect(cellFor(name, 'security').textContent?.trim()).not.toBe('');
    }
  });

  it('renders "Not reported" rather than a badge when there is no verdict', async () => {
    (documentApi.list as jest.Mock).mockResolvedValue({
      documents: [{ ...cleanCsv, id: 'doc-x', scanStatus: undefined }],
      total: 1,
      page: 1,
      pageSize: PAGE_SIZE,
    });
    await renderLoaded();
    expect(cellFor('sample_financials.csv', 'security')).toHaveTextContent('Not reported');
  });

  it('has no Version column, because a column of "Not reported" is not a version', async () => {
    await renderLoaded();

    // The exact header row. `Version` used to sit between Security and Size and
    // rendered "Not reported" for all 50 rows, while its history button was
    // unreachable dead code. History is reachable through the row action instead,
    // which this also proves.
    expect(headerLabels()).toEqual(['Select', 'Name', 'Security', 'Size', 'Updated', 'Actions']);
    expect(screen.queryByRole('columnheader', { name: 'Version' })).not.toBeInTheDocument();
    expect(screen.queryByText('Not reported')).not.toBeInTheDocument();

    // Nothing in the table asks the versions endpoint for a number it cannot show.
    expect(documentApi.listVersions).not.toHaveBeenCalled();

    // And the feature the column was supposed to surface is still reachable.
    expect(
      within(rowFor('sample_financials.csv')).getByRole('button', {
        name: 'Version history for sample_financials.csv',
      }),
    ).toBeInTheDocument();
  });
});

describe('DocumentsHub — the folder filter is server-side', () => {
  it('sends folder_id and renders the rows the server scoped to that folder', async () => {
    await renderLoaded();

    expect(screen.getByText('sample_financials.csv')).toBeInTheDocument();
    expect(screen.getByText('architecture_spec.md')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Legal Contracts, 1 document' }));

    await waitFor(() =>
      expect(documentApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: WS, folder_id: 'f-legal', page: 1 }),
      ),
    );

    // The rendered set changed. A client-side `docs.filter(d => d.folderId === id)`
    // on page-1 rows would also produce this, so the request assertion above is
    // the half that distinguishes the two.
    await waitFor(() =>
      expect(screen.queryByText('sample_financials.csv')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('architecture_spec.md')).toBeInTheDocument();
    expect(screen.getByText(/Viewing folder:/)).toBeInTheDocument();
    // This count is the FOLDER's, and it says so. It sits directly under a stats
    // bar whose cards count the whole workspace (128 documents), so a bare
    // "(3 matching)" was two denominators a few centimetres apart with nothing
    // distinguishing them. Asserted so the scope cannot quietly go back to
    // implying "all files".
    expect(screen.getByText('(1 matching in this folder)')).toBeInTheDocument();
  });

  it('returns to every folder and drops folder_id from the request', async () => {
    await renderLoaded();

    fireEvent.click(await screen.findByRole('button', { name: 'Legal Contracts, 1 document' }));
    await waitFor(() =>
      expect(documentApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ folder_id: 'f-legal' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show All Files' }));
    await waitFor(() =>
      expect(documentApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ folder_id: null }),
      ),
    );
  });

  it('surfaces a folder load failure with a working retry instead of "No folders yet"', async () => {
    (documentApi.listFolders as jest.Mock)
      .mockRejectedValueOnce(new Error('folders 500'))
      .mockResolvedValue(folders);

    renderHub();
    expect(await screen.findByText(/Could not load folders\. folders 500/)).toBeInTheDocument();
    // The confident false claim this replaces: with no folders loaded, the tree
    // would otherwise render "No folders yet" beside the error.
    expect(screen.queryByText('No folders yet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry folders' }));

    await waitFor(() => expect(documentApi.listFolders).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: 'Legal Contracts, 1 document' });
  });

  it('reaches the folder-delete confirmation, which used to be an unreachable branch', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Delete folder Legal Contracts' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete folder')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Delete folder "Legal Contracts"?');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(documentApi.deleteFolder).toHaveBeenCalledWith('f-legal', WS));
  });
});

describe('DocumentsHub — pagination', () => {
  it('offers more than one page when total exceeds the page size and re-requests on change', async () => {
    (documentApi.list as jest.Mock).mockResolvedValue({
      documents: ALL_DOCS,
      total: 120,
      page: 1,
      pageSize: PAGE_SIZE,
    });

    await renderLoaded();

    const next = screen.getByRole('button', { name: 'Next Page' });
    const nav = next.closest('div[aria-label="Pagination Navigation"]');
    expect(nav).not.toBeNull();
    expect(nav).toHaveTextContent('of 120 results');
    expect(nav).toHaveTextContent('1 / 3');
    expect(screen.getByRole('button', { name: 'Previous Page' })).toBeDisabled();
    expect(next).toBeEnabled();

    fireEvent.click(next);

    await waitFor(() =>
      expect(documentApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, page_size: PAGE_SIZE }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Previous Page' })).toBeEnabled();
  });

  it('keeps the single-page control inert when everything fits on one page', async () => {
    await renderLoaded();

    expect(screen.getByRole('button', { name: 'Next Page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous Page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next Page' }).closest('div')).toHaveTextContent(
      '1 / 1',
    );
  });

  it('hides pagination entirely when the workspace has no documents at all', async () => {
    (documentApi.list as jest.Mock).mockResolvedValue({
      documents: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
    });

    renderHub();
    await within(panel()).findByText('No documents found');
    expect(screen.queryByRole('button', { name: 'Next Page' })).not.toBeInTheDocument();
  });
});

describe('DocumentsHub — empty, loading, error and retry states', () => {
  it('renders the empty state when the API returns zero documents', async () => {
    (documentApi.list as jest.Mock).mockResolvedValue({
      documents: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
    });

    renderHub();

    const results = await within(panel()).findByText('No documents found');
    expect(results).toBeInTheDocument();
    expect(within(panel()).getByText('Upload documents to get started.')).toBeInTheDocument();
    expect(screen.queryByText('sample_financials.csv')).not.toBeInTheDocument();
  });

  it('renders the error state on rejection and recovers through Retry', async () => {
    const listMock = documentApi.list as jest.Mock;
    listMock.mockReset();
    listMock.mockRejectedValueOnce(new Error('documents 500'));
    listMock.mockImplementation(listImpl);

    renderHub();

    // The failure has to reach the results area, not only the stats bar.
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('documents 500');
    expect(within(panel()).queryByText('sample_financials.csv')).not.toBeInTheDocument();

    fireEvent.click(within(panel()).getByRole('button', { name: /retry/i }));

    expect(
      await screen.findByRole('button', { name: 'sample_financials.csv' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it('marks the table busy while refreshing instead of blanking the rows', async () => {
    let release: (() => void) | null = null;
    (documentApi.list as jest.Mock).mockImplementationOnce(listImpl).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ documents: ALL_DOCS, total: 3, page: 1, pageSize: PAGE_SIZE });
        }),
    );

    await renderLoaded();

    // Flip the archived switch: a filter change, so a refetch, so `refreshing`.
    fireEvent.click(screen.getByRole('switch'));
    await screen.findByText('Refreshing…');
    // The stale rows are still there and the region says it is busy.
    expect(screen.getByRole('button', { name: 'sample_financials.csv' })).toBeInTheDocument();
    expect(screen.getByText('Refreshing…')).toBeInTheDocument();

    release?.();
    await waitFor(() => expect(screen.queryByText('Refreshing…')).not.toBeInTheDocument());
  });
});

describe('DocumentsHub — selection and bulk actions', () => {
  it('reveals the bulk bar only once a row is selected, and reports the count', async () => {
    await renderLoaded();

    expect(screen.queryByText(/document\(s\) selected/)).not.toBeInTheDocument();

    fireEvent.click(
      within(rowFor('sample_financials.csv')).getByRole('checkbox', {
        name: 'Select sample_financials.csv',
      }),
    );

    // The exact wording `e2e/files-chat.spec.ts` asserts on.
    expect(screen.getByText('1 document(s) selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download (.zip)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Archive Selected' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sync to Memory' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Selected' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('1 document(s) selected')).not.toBeInTheDocument();
  });

  it('selects every row on the page from the labelled select-all control', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 3 documents on this page' }));

    expect(screen.getByText('3 document(s) selected')).toBeInTheDocument();
  });

  it('archives the selected rows through the bulk endpoint', async () => {
    await renderLoaded();

    fireEvent.click(
      within(rowFor('sample_financials.csv')).getByRole('checkbox', {
        name: 'Select sample_financials.csv',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Archive Selected' }));

    await waitFor(() => expect(documentApi.archive).toHaveBeenCalledWith('doc-1', WS));
    expect(documentApi.bulkDelete).not.toHaveBeenCalled();
  });

  it('bulk-deletes only after the confirmation is accepted', async () => {
    await renderLoaded();

    fireEvent.click(
      within(rowFor('sample_financials.csv')).getByRole('checkbox', {
        name: 'Select sample_financials.csv',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Permanently delete 1 selected document(s)?');
    expect(documentApi.bulkDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(documentApi.bulkDelete).toHaveBeenCalledWith(WS, ['doc-1']));
  });

  it('moves the selection into a folder chosen in the bulk move dialog', async () => {
    await renderLoaded();

    fireEvent.click(
      within(rowFor('sample_financials.csv')).getByRole('checkbox', {
        name: 'Select sample_financials.csv',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move Selected' }));

    const dialog = await screen.findByRole('dialog');
    // The stand-in document says what it is and claims no security verdict.
    expect(dialog).toHaveTextContent('1 selected document (bulk move)');
    expect(dialog).not.toHaveTextContent('Clean');

    fireEvent.click(within(dialog).getByRole('radio', { name: /Legal Contracts/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Move Here/ }));

    await waitFor(() => expect(documentApi.move).toHaveBeenCalledWith('doc-1', WS, 'f-legal'));
  });
});

describe('DocumentsHub — single-document mutations hit the right endpoint', () => {
  it('archives one document behind a confirmation', async () => {
    await renderLoaded();

    fireEvent.click(
      within(rowFor('sample_financials.csv')).getByRole('button', {
        name: 'Archive sample_financials.csv',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Archive "sample_financials.csv"?');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(documentApi.archive).toHaveBeenCalledWith('doc-1', WS));
    // Archive is a POST to /archive; it must not be confused with a hard delete.
    expect(documentApi.delete).not.toHaveBeenCalled();
  });

  it('permanently deletes one document behind a confirmation', async () => {
    await renderLoaded();

    fireEvent.click(
      within(rowFor('sample_financials.csv')).getByRole('button', {
        name: 'Delete sample_financials.csv',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Permanently delete "sample_financials.csv"?');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(documentApi.delete).toHaveBeenCalledWith('doc-1', WS));
    expect(documentApi.archive).not.toHaveBeenCalled();
  });

  it('restores an archived document straight from the row, with no confirmation', async () => {
    (documentApi.list as jest.Mock).mockResolvedValue({
      documents: [archivedDoc],
      total: 1,
      page: 1,
      pageSize: PAGE_SIZE,
    });

    await renderLoaded({}, 'old_notes.txt');

    expect(
      screen.queryByRole('button', { name: /Archive old_notes\.txt/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore old_notes.txt' }));

    await waitFor(() => expect(documentApi.restore).toHaveBeenCalledWith('doc-4', WS));
    expect(documentApi.archive).not.toHaveBeenCalled();
  });

  it('syncs one document into Memory and refreshes', async () => {
    await renderLoaded();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Sync pending_docx to Memory'.replace('pending_docx', 'contract.docx'),
      }),
    );

    await waitFor(() => expect(documentApi.syncMemory).toHaveBeenCalledWith('doc-3', WS));
  });

  it('sends the archived-files toggle to the server as include_archived', async () => {
    await renderLoaded();

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(documentApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ include_archived: true }),
      ),
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('DocumentsHub — search reaches the search endpoint', () => {
  it('sends the query to documentApi.search with the active folder and page window', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Search workspace files'), {
      target: { value: 'financials' },
    });

    // `category: null` is the explicit "no category filter" the hook always
    // passes, so a future change that forgets to send it at all is visible here.
    await waitFor(
      () =>
        expect(documentApi.search).toHaveBeenCalledWith(WS, 'financials', null, {
          limit: PAGE_SIZE,
          offset: 0,
          category: null,
        }),
      ASYNC_WAIT,
    );
    expect(documentApi.search).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentsHub — accessibility contract', () => {
  it('exposes the category strip as a real tablist whose tabs control the results panel', async () => {
    await renderLoaded();

    const tablist = screen.getByRole('tablist', { name: 'Document categories' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All Files',
      'Vault Notes',
      'Documents',
      'Spreadsheets',
      'Images',
      'Code',
    ]);

    // The tree root is a BUTTON named "All Documents, N documents"; the category
    // control is a TAB named "All Files". Different roles, so the two can never
    // collide in a role-based query.
    expect(screen.getByRole('button', { name: 'All Documents, 3 documents' })).toBeInTheDocument();

    const selected = within(tablist).getByRole('tab', { name: 'All Files' });
    expect(selected).toHaveAttribute('aria-selected', 'true');

    // The SELECTED tab's `aria-controls` resolves to the panel that wraps the
    // table, and the panel points back. Inactive tabs are lazily mounted —
    // `TabPanel` returns null for a non-active tab, which is the ui-kit's own
    // behaviour and the same contract `DocumentDetailView` already ships.
    const controls = selected.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(panel()).toHaveAttribute('id', controls);
    expect(panel()).toHaveAttribute('aria-labelledby', selected.id);
  });

  it('asks the SERVER for the category and no longer filters the page in the browser', async () => {
    await renderLoaded();

    const tablist = screen.getByRole('tablist', { name: 'Document categories' });
    fireEvent.click(within(tablist).getByRole('tab', { name: 'Spreadsheets' }));

    // The half that distinguishes a server filter from a client one: the
    // category travels on the request.
    await waitFor(() =>
      expect(documentApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: WS, category: 'spreadsheets', page: 1 }),
      ),
    );
    // And the rows the server sent for that category are what is rendered.
    await waitFor(() => expect(screen.queryByText('architecture_spec.md')).not.toBeInTheDocument());
    expect(screen.getByText('sample_financials.csv')).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'Spreadsheets' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // The caption that admitted the filter ran in the browser is gone, because it
    // is no longer true. Asserting its ABSENCE matters: leaving a false claim in
    // place is the bug, not the caption's wording.
    expect(
      screen.queryByText(/This filter runs in the browser, not on the server/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/runs in the browser/)).not.toBeInTheDocument();
    // What replaced it says what is true: the server scoped the rows.
    expect(screen.getByText(/Filtered on the server to "Spreadsheets"/)).toBeInTheDocument();

    // Back to All Files: `all` is a UI sentinel, so it is sent as absent.
    fireEvent.click(within(tablist).getByRole('tab', { name: 'All Files' }));
    await waitFor(() =>
      expect(documentApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: null }),
      ),
    );
  });

  it('gives the long-name trigger a title and every row action a file-specific name', async () => {
    await renderLoaded();

    const row = rowFor('sample_financials.csv');
    expect(within(row).getByRole('button', { name: 'sample_financials.csv' })).toHaveAttribute(
      'title',
      expect.stringContaining('sample_financials.csv'),
    );

    for (const name of [
      'View sample_financials.csv',
      'Share sample_financials.csv',
      'Rename sample_financials.csv',
      'Move sample_financials.csv',
      'Delete sample_financials.csv',
    ]) {
      expect(within(row).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(
      within(row).getByRole('link', { name: 'Open details for sample_financials.csv' }),
    ).toBeInTheDocument();
  });

  it('hides the directory picker from assistive tech and names its trigger', async () => {
    const { container } = await renderLoaded();

    const hidden = container.querySelector('input[webkitdirectory]');
    expect(hidden).not.toBeNull();
    expect(hidden).toHaveAttribute('aria-hidden', 'true');
    // The trigger that opens it is a real, named button.
    expect(screen.getByRole('button', { name: 'Upload Folder Tree' })).toBeInTheDocument();
  });

  it('closes a modal on Escape and returns focus to the control that opened it', async () => {
    await renderLoaded();

    const trigger = within(rowFor('sample_financials.csv')).getByRole('button', {
      name: 'Move sample_financials.csv',
    });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });
});

describe('DocumentsHub — basePath reaches the detail links', () => {
  it('builds /documents/... links when mounted by documents/page.tsx', async () => {
    await renderLoaded({ basePath: 'documents' });
    expect(
      within(rowFor('sample_financials.csv')).getByRole('link', {
        name: 'Open details for sample_financials.csv',
      }),
    ).toHaveAttribute('href', `/workspace/${WS}/documents/doc-1`);
  });

  it('builds /files/... links when mounted by files/page.tsx', async () => {
    await renderLoaded({ basePath: 'files' });
    expect(
      within(rowFor('sample_financials.csv')).getByRole('link', {
        name: 'Open details for sample_financials.csv',
      }),
    ).toHaveAttribute('href', `/workspace/${WS}/files/doc-1`);
  });

  it('defaults to the documents route when basePath is omitted', async () => {
    // `files/page.tsx` passes `basePath="files"` and `documents/page.tsx` passes
    // `basePath="documents"`, but neither relies on the default — this pins it
    // anyway so a change to the default cannot silently move the link.
    render(<DocumentsHub workspaceId={WS} />);
    await screen.findByRole('button', { name: 'sample_financials.csv' });
    expect(
      within(rowFor('sample_financials.csv')).getByRole('link', {
        name: 'Open details for sample_financials.csv',
      }),
    ).toHaveAttribute('href', `/workspace/${WS}/documents/doc-1`);
  });
});

// --- Workspace aggregates, paginated search, and the tests for both ---------

/** The stats bar's metric grid. Located by its accessible name, not by index. */
function statsBar(): HTMLElement {
  return screen.getByLabelText('Document workspace metrics');
}

/**
 * One metric card, addressed by its label.
 *
 * `closest('button, div')` on the label would stop at the label's own flex row and
 * return a fragment of the card, so this walks to the card itself: the bar's
 * DIRECT child that contains the label text. That is stable whether the card
 * renders as a `<button>` (filterable) or a `<Card>` (static), and it does not
 * depend on column order.
 */
function metricCard(label: string): HTMLElement {
  const bar = statsBar();
  const card = Array.from(bar.children).find((child) => child.textContent?.includes(label));
  if (!card) throw new Error(`no metric card labelled "${label}" inside the stats bar`);
  return card as HTMLElement;
}

describe('DocumentsHub — the stats bar shows real workspace aggregates', () => {
  it('requests the aggregates for the current workspace and renders each returned value', async () => {
    await renderLoaded();

    // The request carries the workspace, and it is a SEPARATE request from the
    // list: two calls, two endpoints. That separation is what lets one fail
    // without taking the other down.
    await waitFor(() => expect(documentApi.stats).toHaveBeenCalledWith(WS), ASYNC_WAIT);
    expect(documentApi.stats).toHaveBeenCalledTimes(1);

    const bar = statsBar();
    // Every value comes from the STATS fixture, not from the three rows on screen.
    // `totalDocuments` is 128 while the table holds 3 rows and the list endpoint
    // reported total 3 — that difference is the whole point of the endpoint.
    expect(within(bar).getByText('128')).toBeInTheDocument();
    expect(within(bar).getByText('121')).toBeInTheDocument();
    expect(within(bar).getByText('3')).toBeInTheDocument();
    expect(within(bar).getByText('2')).toBeInTheDocument();
    expect(within(bar).getByText('4')).toBeInTheDocument();
    // 5 MiB through `formatBytes` ("5.0 MB"), not the sum of the page's
    // `metadata.size` (1024 + 2048 = 3.0 KB), which is what the bar used to print
    // under a workspace-scoped caption.
    expect(within(bar).getByText('5.0 MB')).toBeInTheDocument();

    // Captions still claim workspace scope, and now they can.
    expect(metricCard('Total Documents')).toHaveTextContent('Workspace index');
    expect(metricCard('Storage Used')).toHaveTextContent('S3 Object Store');
  });

  it('renders the Active Shares card once a real share count is supplied', async () => {
    await renderLoaded();

    // Before `GET /documents/stats` existed, nothing client-side could produce
    // this number — no field on `DocumentResponse` or `metadata` describes a
    // share — so the card was deliberately omitted rather than hardcoded to 0. It
    // is asserted as PRESENT and as CARRYING THE SERVER'S NUMBER, which is the
    // whole point of wiring the endpoint.
    const shares = metricCard('Active Shares');
    expect(shares).toHaveTextContent('7');
    expect(shares).toHaveTextContent('Shared Out');
    expect(shares).toHaveTextContent('Cross-workspace shares');
  });

  it('treats a share count of zero as a real answer, not as an absence', async () => {
    (documentApi.stats as jest.Mock).mockResolvedValue({ ...STATS, activeShareCount: 0 });

    await renderLoaded();

    // The card still renders, with the "nothing is shared out" badge. Omitting it
    // here would be wrong: 0 shares is a fact about the workspace, and the bar
    // only omits a card when it has no value at all (asserted in the next test).
    const shares = metricCard('Active Shares');
    expect(shares).toHaveTextContent('Not Shared');
    expect(shares).toHaveTextContent('Cross-workspace shares');
    // The formatted count is on screen; asserted via the value element so the
    // caption words above cannot satisfy it by accident.
    expect(within(shares).getByText('0', { selector: 'div' })).toBeInTheDocument();
  });

  it('omits the cards for fields the server did not send instead of printing 0', async () => {
    // A partial payload: `scanningCount`, `folderCount` and `activeShareCount` are
    // absent. Each of those cards must disappear rather than claim "0".
    (documentApi.stats as jest.Mock).mockResolvedValue({
      totalDocuments: 9,
      totalBytes: 2048,
      cleanCount: 9,
      quarantinedCount: 0,
    });

    await renderLoaded();

    const bar = statsBar();
    expect(within(bar).getByText('Total Documents')).toBeInTheDocument();
    expect(within(bar).getByText('Clean Scans')).toBeInTheDocument();
    // A genuine 0 with a source is kept — this is the quarantine count, and it
    // really is zero.
    expect(within(bar).getByText('Quarantined / Alerts')).toBeInTheDocument();

    expect(within(bar).queryByText('Scanning')).not.toBeInTheDocument();
    expect(within(bar).queryByText('Folders')).not.toBeInTheDocument();
    expect(within(bar).queryByText('Active Shares')).not.toBeInTheDocument();
  });

  it('keeps the document table rendered when the stats request fails', async () => {
    (documentApi.stats as jest.Mock).mockRejectedValue(new Error('stats 503'));

    renderHub();

    // The list is its own request and its own lifecycle: a dead totals endpoint
    // must not blank the files. The old code passed `list.error` into the stats
    // bar, which tied the two together in the other direction.
    await screen.findByRole('button', { name: 'sample_financials.csv' }, ASYNC_WAIT);
    expect(screen.getByText('architecture_spec.md')).toBeInTheDocument();

    // The failure is reported, not swallowed, and it names the endpoint.
    const alert = await screen.findByRole('alert', {}, ASYNC_WAIT);
    expect(alert).toHaveTextContent('Could not load document metrics');
    expect(alert).toHaveTextContent('stats 503');
    // ...and it never claimed the workspace was empty.
    expect(screen.queryByText('No documents in this workspace')).not.toBeInTheDocument();

    // Retry is wired to the STATS request, not to the list: one extra list call
    // would mean the two had been re-coupled.
    const listCallsBeforeRetry = (documentApi.list as jest.Mock).mock.calls.length;
    fireEvent.click(within(alert).getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(documentApi.stats).toHaveBeenCalledTimes(2), ASYNC_WAIT);
    expect((documentApi.list as jest.Mock).mock.calls.length).toBe(listCallsBeforeRetry);
  });

  it('refetches the aggregates after a mutation that changes them', async () => {
    await renderLoaded();
    expect(documentApi.stats).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(rowFor('sample_financials.csv')).getByRole('button', {
        name: 'Archive sample_financials.csv',
      }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    // An archive moves a row out of the document total. If the counters kept
    // describing the pre-click workspace, "128" would still be on screen minutes
    // later — confidently wrong.
    await waitFor(() => expect(documentApi.stats).toHaveBeenCalledTimes(2), ASYNC_WAIT);
  });
});

describe('DocumentsHub — search paginates instead of truncating', () => {
  /**
   * A search whose server found more matches than one page can hold.
   *
   * The returned window is deliberately SHORT (3 rows) even though `limit` echoes
   * the 50 the client asked for. A full 50-row table renders ~500 controls, and
   * driving three of those renders plus two debounced refetches through jsdom took
   * 44s for ONE test — over the suite's 30s budget. Nothing under test depends on
   * the row count: the page count comes from `total`, the window position comes
   * from `offset`, and every assertion reads the request the client actually made.
   * The short window is a fixture choice, stated here rather than hidden.
   */
  const manyMatches = (total: number) => {
    const SHORT_WINDOW = 3;
    (documentApi.search as jest.Mock).mockImplementation(
      (
        _ws: string,
        _q: string,
        _folder: string | null | undefined,
        p?: { limit?: number; offset?: number },
      ) => {
        const limit = p?.limit ?? PAGE_SIZE;
        const offset = p?.offset ?? 0;
        const rows = Math.max(0, Math.min(limit, total - offset, SHORT_WINDOW));
        return Promise.resolve({
          documents: Array.from({ length: rows }, (_, i) => ({
            ...cleanCsv,
            id: `hit-${offset + i}`,
            path: `hit_${offset + i}.txt`,
          })),
          total,
          limit,
          offset,
        });
      },
    );
  };

  it('renders pagination during a search and requests the next page offset', async () => {
    manyMatches(120);
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Search workspace files'), {
      target: { value: 'hit' },
    });

    await waitFor(() => expect(documentApi.search).toHaveBeenCalled(), ASYNC_WAIT);
    await screen.findByRole('button', { name: 'hit_0.txt' }, ASYNC_WAIT);

    // Pagination used to be suppressed for exactly this screen, because the search
    // endpoint had no total and any page count would have been a guess.
    const next = screen.getByRole('button', { name: 'Next Page' });
    expect(next).toBeEnabled();
    expect(next.closest('div[aria-label="Pagination Navigation"]')).toHaveTextContent('1 / 3');
    // `totalRecords` is the server's own count of matches, not the rows on screen.
    expect(next.closest('div[aria-label="Pagination Navigation"]')).toHaveTextContent(
      'of 120 results',
    );

    fireEvent.click(next);

    // Page 2 must ask for the window starting at PAGE_SIZE, not page 1 again.
    await waitFor(
      () =>
        expect(documentApi.search).toHaveBeenLastCalledWith(
          WS,
          'hit',
          null,
          expect.objectContaining({ offset: PAGE_SIZE, limit: PAGE_SIZE }),
        ),
      ASYNC_WAIT,
    );
    await screen.findByRole('button', { name: 'hit_50.txt' }, ASYNC_WAIT);
    expect(screen.getByRole('button', { name: 'Previous Page' })).toBeEnabled();
  });

  it('returns to page 1 when the query changes', async () => {
    manyMatches(120);
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Search workspace files'), {
      target: { value: 'hit' },
    });
    await waitFor(() => expect(documentApi.search).toHaveBeenCalled(), ASYNC_WAIT);
    fireEvent.click(await screen.findByRole('button', { name: 'Next Page' }, ASYNC_WAIT));
    await waitFor(
      () =>
        expect(documentApi.search).toHaveBeenLastCalledWith(
          WS,
          'hit',
          null,
          expect.objectContaining({ offset: PAGE_SIZE }),
        ),
      ASYNC_WAIT,
    );

    // A new query invalidates every page but the first: staying on page 2 of the
    // new result set would show an empty table whenever it is shorter.
    fireEvent.change(screen.getByLabelText('Search workspace files'), {
      target: { value: 'hit_1' },
    });

    await waitFor(
      () =>
        expect(documentApi.search).toHaveBeenLastCalledWith(
          WS,
          'hit_1',
          null,
          expect.objectContaining({ offset: 0 }),
        ),
      ASYNC_WAIT,
    );
  });

  it('returns to page 1 when the folder filter changes', async () => {
    manyMatches(120);
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Search workspace files'), {
      target: { value: 'hit' },
    });
    await waitFor(() => expect(documentApi.search).toHaveBeenCalled(), ASYNC_WAIT);
    fireEvent.click(await screen.findByRole('button', { name: 'Next Page' }, ASYNC_WAIT));
    await waitFor(
      () =>
        expect(documentApi.search).toHaveBeenLastCalledWith(
          WS,
          'hit',
          null,
          expect.objectContaining({ offset: PAGE_SIZE }),
        ),
      ASYNC_WAIT,
    );

    // The rail names a folder by its count only when that count is non-zero
    // (`DocumentFolderTree.tsx:351`), and the count is derived from the rows on
    // screen — 50 search hits, none of them in `f-legal`. Matched by prefix so the
    // test does not depend on that page-derived number.
    fireEvent.click(await screen.findByRole('button', { name: /^Legal Contracts/ }, ASYNC_WAIT));

    await waitFor(
      () =>
        expect(documentApi.search).toHaveBeenLastCalledWith(
          WS,
          'hit',
          'f-legal',
          expect.objectContaining({ offset: 0 }),
        ),
      ASYNC_WAIT,
    );
  });

  it('falls back to the window size it asked for when the echo is nonsense', async () => {
    // `limit: 0` would make `Math.ceil(total / 0)` Infinity and the page count
    // nonsense, so a non-positive echo is ignored in favour of PAGE_SIZE.
    (documentApi.search as jest.Mock).mockResolvedValue({
      documents: [cleanCsv],
      total: 1,
      limit: 0,
      offset: 0,
    });
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Search workspace files'), {
      target: { value: 'financials' },
    });

    await waitFor(() => expect(documentApi.search).toHaveBeenCalled(), ASYNC_WAIT);
    expect(await screen.findByText('1 / 1', undefined, ASYNC_WAIT)).toBeInTheDocument();
  });
});
