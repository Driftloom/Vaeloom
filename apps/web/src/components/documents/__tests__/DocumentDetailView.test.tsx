import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';

import { DocumentDetailView } from '../DocumentDetailView';
import { documentApi } from '@/lib/api-client';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  },
}));
jest.mock('remark-gfm', () => () => {});
jest.mock('@/components/shared/Toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-1', documentId: 'doc-1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});
jest.mock('../DocumentAuditPanel', () => ({ DocumentAuditPanel: () => <p>audit</p> }));
jest.mock('../DocumentCompareView', () => ({ DocumentCompareView: () => <p>compare</p> }));
jest.mock('../DocumentShareDialog', () => ({ DocumentShareDialog: () => null }));
jest.mock('../DocumentMoveDialog', () => ({ DocumentMoveDialog: () => null }));
jest.mock('@/components/shared/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/components/shared/DiffViewer', () => ({ DiffViewer: () => <p>diff</p> }));

jest.mock('@/lib/api-client', () => ({
  documentApi: {
    getById: jest.fn(),
    getContent: jest.fn(),
    actions: jest.fn(),
    listVersions: jest.fn(),
    listShares: jest.fn(),
    updateTags: jest.fn(),
    syncMemory: jest.fn(),
  },
  legacySharePermission: (v: string) => (String(v).toLowerCase() === 'write' ? 'write' : 'read'),
}));

const doc = {
  id: 'doc-1',
  workspaceId: 'ws-1',
  path: 'reports/q3.csv',
  type: 'csv',
  scanStatus: 'CLEAN',
  scanResult: null,
  deletedAt: null,
  createdAt: new Date(2026, 8, 30).toISOString(),
  updatedAt: new Date(2026, 8, 30).toISOString(),
  metadata: { size: 2048, tags: ['finance'] },
};

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
  (documentApi.getById as jest.Mock).mockResolvedValue(doc);
  (documentApi.getContent as jest.Mock).mockResolvedValue(
    new Blob(['region,total\nEU,1\nUS,2'], { type: 'text/csv' }),
  );
  (documentApi.actions as jest.Mock).mockResolvedValue({ actions: [], total: 0 });
  (documentApi.listVersions as jest.Mock).mockResolvedValue([
    {
      id: 'v2',
      documentId: 'doc-1',
      versionNumber: 2,
      storageKey: 'k',
      checksum: 'abcdef0123456789',
      sizeBytes: 10,
      createdAt: new Date(2026, 8, 29).toISOString(),
    },
  ]);
  (documentApi.listShares as jest.Mock).mockResolvedValue([]);
});

describe('DocumentDetailView tab semantics', () => {
  it('satisfies the WAI-ARIA tabs pattern', async () => {
    render(<DocumentDetailView />);
    await screen.findByRole('heading', { level: 1, name: 'q3.csv' });

    const tablist = screen.getByRole('tablist', { name: 'Document views' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(6);

    tabs.forEach((tab) => {
      const controls = tab.getAttribute('aria-controls');
      expect(tab.id).toBe(`tab-${tab.getAttribute('data-tab-id')}`);
      expect(controls).toBeTruthy();
      const panel = document.getElementById(controls as string);
      if (tab.getAttribute('aria-selected') === 'true') {
        expect(panel).not.toBeNull();
        expect(panel).toHaveAttribute('aria-labelledby', tab.id);
        expect(tab).toHaveAttribute('tabindex', '0');
      } else {
        expect(tab).toHaveAttribute('tabindex', '-1');
      }
    });

    const panels = screen.getAllByRole('tabpanel');
    expect(panels).toHaveLength(1);

    // Scan verdict, revision number, CSV branch and tag controls render.
    expect(screen.getByText('Upload checks passed')).toBeInTheDocument();
    expect(screen.getByText(/Rev v2/)).toBeInTheDocument();
    expect(screen.getByTestId('document-preview-csv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove tag #finance' })).toBeInTheDocument();
    expect(screen.getByLabelText('Add tag')).toBeInTheDocument();

    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('tabpanel')).toBeInTheDocument());
    expect(within(screen.getByRole('tablist')).getAllByRole('tab')[1]).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows a shares error with retry instead of the false "not shared" claim', async () => {
    (documentApi.listShares as jest.Mock).mockRejectedValue(new Error('shares 500'));
    render(<DocumentDetailView />);
    await screen.findByRole('heading', { level: 1, name: 'q3.csv' });

    fireEvent.click(
      within(screen.getByRole('tablist')).getByRole('tab', { name: /Access & Sharing/ }),
    );
    const panel = await screen.findByRole('tabpanel');
    expect(within(panel).getByRole('alert')).toHaveTextContent('shares 500');
    expect(within(panel).queryByText(/private to workspace/)).not.toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: /Retry loading sharing information/ }),
    ).toBeInTheDocument();
  });

  it('shows a revisions error instead of "no previous revisions"', async () => {
    (documentApi.listVersions as jest.Mock).mockRejectedValue(new Error('versions 500'));
    render(<DocumentDetailView />);
    await screen.findByRole('heading', { level: 1, name: 'q3.csv' });
    expect(screen.getByText(/Revision —/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Revisions/ }));
    const panel = await screen.findByRole('tabpanel');
    expect(within(panel).getByRole('alert')).toHaveTextContent('versions 500');
    expect(within(panel).queryByText('No previous revisions')).not.toBeInTheDocument();
  });
});
