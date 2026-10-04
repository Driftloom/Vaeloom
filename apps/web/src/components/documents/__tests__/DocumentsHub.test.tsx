import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

import { DocumentsHub } from '../DocumentsHub';
import { documentApi } from '@/lib/api-client';
import type { DocumentResponse, FolderResponse, FolderTreeItem } from '@/lib/api-client';
import { formatDate } from '@/lib/document-format';

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
 * A stand-in for `GET /documents` that honours `folder_id` and
 * `include_archived`, which is what makes the folder-filter assertion meaningful:
 * the server decides the rows, so a passing test cannot be a client-side filter
 * that happens to agree.
 */
function listImpl(params?: Record<string, unknown>) {
  const page = Number(params?.page ?? 1);
  const folderId = (params?.folder_id as string | null | undefined) ?? null;
  const includeArchived = Boolean(params?.include_archived);
  const pool = ALL_DOCS.filter((doc) => (folderId ? doc.folderId === folderId : true)).filter(
    (doc) => includeArchived || !doc.deletedAt,
  );
  const start = (page - 1) * PAGE_SIZE;
  return Promise.resolve({
    documents: pool.slice(start, start + PAGE_SIZE),
    total: pool.length,
    page,
    pageSize: PAGE_SIZE,
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
  (documentApi.search as jest.Mock).mockResolvedValue([]);
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
 * One `<td>` by column index: select, name, security, version, size, updated,
 * actions. Addressed by position because several columns legitimately render the
 * same word — the Version cell also says "Not reported" — so a text query alone
 * cannot tell which verdict is being asserted.
 */
const COL = {
  select: 0,
  name: 1,
  security: 2,
  version: 3,
  size: 4,
  updated: 5,
  actions: 6,
} as const;

function cellFor(name: string, column: keyof typeof COL): HTMLElement {
  return within(rowFor(name)).getAllByRole('cell')[COL[column]] as HTMLElement;
}

const renderHub = (props: Partial<React.ComponentProps<typeof DocumentsHub>> = {}) =>
  render(<DocumentsHub workspaceId={WS} {...props} />);

/** Render and wait for the first document list to land. */
async function renderLoaded(
  props: Partial<React.ComponentProps<typeof DocumentsHub>> = {},
  firstRow = 'sample_financials.csv',
) {
  const utils = renderHub(props);
  await screen.findByRole('button', { name: firstRow });
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
    (documentApi.search as jest.Mock).mockResolvedValue([cleanCsv]);
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Search workspace files'), {
      target: { value: 'financials' },
    });

    await waitFor(() =>
      expect(documentApi.search).toHaveBeenCalledWith(WS, 'financials', null, {
        limit: PAGE_SIZE,
        offset: 0,
      }),
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

  it('filters the rendered rows when a category tab is chosen', async () => {
    await renderLoaded();

    const tablist = screen.getByRole('tablist', { name: 'Document categories' });
    fireEvent.click(within(tablist).getByRole('tab', { name: 'Spreadsheets' }));

    await waitFor(() => expect(screen.queryByText('architecture_spec.md')).not.toBeInTheDocument());
    expect(screen.getByText('sample_financials.csv')).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'Spreadsheets' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The browser-side nature of the filter is stated, not hidden.
    expect(
      screen.getByText(/This filter runs in the browser, not on the server/),
    ).toBeInTheDocument();
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
