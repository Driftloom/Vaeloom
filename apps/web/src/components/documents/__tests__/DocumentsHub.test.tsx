import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DocumentsHub } from '../DocumentsHub';
import { documentApi } from '@/lib/api-client';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  },
}));

jest.mock('remark-gfm', () => () => {});

const mockToast = {
  toast: jest.fn(),
  dismiss: jest.fn(),
};

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => mockToast,
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-test-123' }),
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
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
    list: jest.fn(),
    upload: jest.fn(),
    getFolders: jest.fn(),
    createFolder: jest.fn(),
    delete: jest.fn(),
    bulkDelete: jest.fn(),
    syncMemory: jest.fn(),
    bulkSyncMemory: jest.fn(),
    getContent: jest.fn(),
    getVersions: jest.fn(),
    actions: jest.fn(),
    autoOrganize: jest.fn(),
  },
  memoryApi: {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

const mockDocs = [
  {
    id: 'doc-1',
    workspace_id: 'ws-test-123',
    path: 'sample_financials.csv',
    type: 'csv',
    content: 'col1,col2\nval1,val2',
    scan_status: 'clean',
    created_at: '2026-09-30T10:00:00Z',
    updated_at: '2026-09-30T10:00:00Z',
    metadata: {
      size_bytes: 1024,
      sync_status: 'synced',
      memory_id: 'mem-1',
    },
  },
  {
    id: 'doc-2',
    workspace_id: 'ws-test-123',
    path: 'architecture_spec.md',
    type: 'markdown',
    content: '# Architecture Spec',
    scan_status: 'clean',
    created_at: '2026-09-30T11:00:00Z',
    updated_at: '2026-09-30T11:00:00Z',
    metadata: {
      size_bytes: 2048,
    },
  },
];

describe('DocumentsHub Enterprise Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (documentApi.list as jest.Mock).mockResolvedValue({
      documents: mockDocs,
      items: mockDocs,
      total: 2,
      page: 1,
      page_size: 20,
    });
    (documentApi.getFolders as jest.Mock).mockResolvedValue([]);
    (documentApi.createFolder as jest.Mock).mockResolvedValue({ id: 'f-1', name: 'New Folder' });
    (documentApi.delete as jest.Mock).mockResolvedValue({ success: true });
    (documentApi.bulkDelete as jest.Mock).mockResolvedValue({ deleted_count: 1 });
    (documentApi.syncMemory as jest.Mock).mockResolvedValue({
      success: true,
      document_id: 'doc-2',
      memory_id: 'mem-2',
      status: 'synced',
    });
    (documentApi.bulkSyncMemory as jest.Mock).mockResolvedValue({
      synced_count: 2,
      failed_count: 0,
      items: [],
    });
    (documentApi.autoOrganize as jest.Mock).mockResolvedValue({
      proposed_folders: ['Reports', 'Architecture'],
      categorized_count: 2,
    });
  });

  it('renders level 1 heading "Workspace Files" for E2E specification compliance', async () => {
    render(<DocumentsHub workspaceId="ws-test-123" />);

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: /workspace files/i,
    });
    expect(heading).toBeInTheDocument();
  });

  it('renders file upload inputs including multiple files and directory folder upload', async () => {
    const { container } = render(<DocumentsHub workspaceId="ws-test-123" />);

    await waitFor(() => {
      expect(documentApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: 'ws-test-123' }),
      );
    });

    const fileInputs = container.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThanOrEqual(1);

    // One input supports multiple files
    const multiInput = Array.from(fileInputs).find((i) => i.hasAttribute('multiple'));
    expect(multiInput).toBeDefined();

    // Verify "Upload Files" and "Upload Folder" trigger buttons exist
    expect(screen.getAllByRole('button', { name: /upload files/i }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByRole('button', { name: /upload folder/i }).length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('renders document items with filename and status details', async () => {
    render(<DocumentsHub workspaceId="ws-test-123" />);

    expect(await screen.findByText('sample_financials.csv')).toBeInTheDocument();
    expect(screen.getByText('architecture_spec.md')).toBeInTheDocument();
  });

  it('renders category filter tabs and allows category switching', async () => {
    render(<DocumentsHub workspaceId="ws-test-123" />);

    await screen.findByText('sample_financials.csv');

    // Category tabs
    expect(screen.getByRole('button', { name: /^all files/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^documents$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spreadsheets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();

    // Click Spreadsheets tab
    fireEvent.click(screen.getByRole('button', { name: /spreadsheets/i }));
    expect(screen.getByText('sample_financials.csv')).toBeInTheDocument();
  });

  it('triggers 1-click memory synchronization for unsynced documents', async () => {
    render(<DocumentsHub workspaceId="ws-test-123" />);

    await screen.findByText('architecture_spec.md');

    // Click sync memory button for doc-2
    const syncButtons = screen.getAllByRole('button', { name: /sync/i });
    expect(syncButtons.length).toBeGreaterThan(0);

    fireEvent.click(syncButtons[0]);

    await waitFor(() => {
      expect(documentApi.syncMemory).toHaveBeenCalledWith(
        expect.stringMatching(/^doc-[12]$/),
        'ws-test-123',
      );
    });
  });

  it('provides auto-organize button and triggers auto-organize workflow', async () => {
    render(<DocumentsHub workspaceId="ws-test-123" />);

    await screen.findByText('sample_financials.csv');

    const organizeBtn = screen.getByRole('button', { name: /organize/i });
    expect(organizeBtn).toBeInTheDocument();

    fireEvent.click(organizeBtn);

    await waitFor(() => {
      expect(documentApi.autoOrganize).toHaveBeenCalledWith('ws-test-123');
    });
  });
});
