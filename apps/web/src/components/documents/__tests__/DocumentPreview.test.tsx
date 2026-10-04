import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { DocumentPreview, CSV_PREVIEW_ROWS } from '../DocumentPreview';
import type { DocumentResponse } from '@/lib/api-client';

/**
 * These tests assert WHICH BRANCH was taken, never merely that something rendered.
 *
 * The failure mode this component was extracted to fix was nine near-identical
 * branch ladders drifting in two files, so the assertion that matters is
 * `data-kind` plus the branch-specific marker (the `<object type>` for PDF, the
 * `<track kind="captions">` for video, the `<th scope="col">` row for CSV, ...).
 * A test that only asserted "the component rendered" would have passed against
 * both the old duplicated code and the new one, which is worthless.
 */

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  },
}));

jest.mock('remark-gfm', () => () => {});

const BLOB_URL = 'blob:https://vaeloom.test/abcdef';

function makeDoc(overrides: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id: 'doc-1',
    workspaceId: 'ws-1',
    path: 'notes.md',
    type: 'markdown',
    createdAt: '2026-09-30T10:00:00Z',
    updatedAt: '2026-09-30T10:00:00Z',
    ...overrides,
  };
}

/** The root element carries the resolved kind, so branch identity is assertable. */
function kind(container: HTMLElement): string | null {
  return (
    container.querySelector('[data-testid="document-preview"]')?.getAttribute('data-kind') ?? null
  );
}

describe('DocumentPreview — branch coverage for all nine preview kinds', () => {
  it('renders markdown through the markdown renderer, not the text branch', () => {
    const doc = makeDoc({ path: 'architecture.md', type: 'markdown' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ text: '# Title\n\nBody copy.' }} />,
    );

    expect(kind(container)).toBe('markdown');
    expect(screen.getByTestId('document-preview-markdown')).toBeInTheDocument();
    expect(screen.queryByTestId('document-preview-text')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('document-preview-markdown')).getByTestId('markdown-preview'),
    ).toHaveTextContent('# Title');
  });

  it('renders a plain-text document in a <pre> verbatim', () => {
    const doc = makeDoc({ path: 'release.log', type: 'text' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ text: 'line one\n  indented\nlast' }} />,
    );

    expect(kind(container)).toBe('text');
    const pre = screen.getByTestId('document-preview-text');
    expect(pre.tagName).toBe('PRE');
    // `textContent`, not `toHaveTextContent`: the matcher collapses whitespace,
    // which is exactly the thing a verbatim <pre> must preserve.
    expect(pre.textContent).toBe('line one\n  indented\nlast');
    expect(screen.queryByTestId('document-preview-markdown')).not.toBeInTheDocument();
  });

  it('renders source code as a numbered line table, not as plain text', () => {
    const doc = makeDoc({ path: 'service.py', type: 'python' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ text: 'def f():\n    return 1' }} />,
    );

    expect(kind(container)).toBe('code');
    const code = screen.getByTestId('document-preview-code');
    expect(code).toBeInTheDocument();
    expect(screen.queryByTestId('document-preview-text')).not.toBeInTheDocument();

    const numbers = code.querySelectorAll('[data-line-number]');
    expect(numbers).toHaveLength(2);
    expect(numbers[0]).toHaveAttribute('data-line-number', '1');
    expect(numbers[1]).toHaveAttribute('data-line-number', '2');
    expect(code).toHaveTextContent('2 lines');
  });

  it('renders CSV as a real table with column and row headers', () => {
    const doc = makeDoc({ path: 'q3.csv', type: 'csv' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ text: 'region,total\nEU,120\nUS,340\n' }} />,
    );

    expect(kind(container)).toBe('csv');
    const table = screen.getByTestId('document-preview-csv').querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table).toHaveAccessibleName(/First 2 data rows of q3.csv/);

    const columnHeaders = within(table as HTMLTableElement).getAllByRole('columnheader');
    expect(columnHeaders.map((th) => th.textContent)).toEqual(['#', 'region', 'total']);

    const rowHeaders = within(table as HTMLTableElement).getAllByRole('rowheader');
    expect(rowHeaders.map((th) => th.textContent)).toEqual(['1', '2']);

    expect(screen.getByTestId('document-preview-csv')).toHaveTextContent('2 columns · 2 rows');
  });

  it('keeps a quoted CSV field containing the delimiter in one cell', () => {
    // The two deleted parsers split "Smith, John",42 into three fields. If the
    // shared parseCsv were bypassed, this cell would split and the cell count
    // would be 3 instead of 2.
    const doc = makeDoc({ path: 'people.csv', type: 'csv' });
    render(
      <DocumentPreview document={doc} source={{ text: 'name,role\n"Smith, John",admin\n' }} />,
    );

    const table = screen.getByTestId('document-preview-csv').querySelector('table');
    const rowHeaders = within(table as HTMLTableElement).getAllByRole('rowheader');
    expect(rowHeaders).toHaveLength(1);

    const cells = within(table as HTMLTableElement)
      .getAllByRole('cell')
      .map((td) => td.textContent);
    expect(cells).toEqual(['Smith, John', 'admin']);
  });

  it('parses TSV with a tab delimiter rather than splitting on commas', () => {
    const doc = makeDoc({ path: 'matrix.tsv', type: 'csv' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ text: 'a\tb\n1,5\t2\n' }} />,
    );

    expect(kind(container)).toBe('csv');
    const table = screen.getByTestId('document-preview-csv').querySelector('table');
    const headers = within(table as HTMLTableElement).getAllByRole('columnheader');
    expect(headers.map((th) => th.textContent)).toEqual(['#', 'a', 'b']);
  });

  it('reports a CSV row count as a lower bound when it truncated the file', () => {
    const rows = Array.from({ length: CSV_PREVIEW_ROWS + 40 }, (_, i) => `r${i},x`);
    const doc = makeDoc({ path: 'big.csv', type: 'csv' });
    render(<DocumentPreview document={doc} source={{ text: ['h1,h2', ...rows].join('\n') }} />);

    const summary = screen.getByTestId('document-preview-csv');
    expect(summary).toHaveTextContent(`${CSV_PREVIEW_ROWS}+ rows`);
    expect(summary).toHaveTextContent(`showing first ${CSV_PREVIEW_ROWS}`);
    // Exactly the preview budget is rendered, not the whole file.
    expect(
      summary.querySelectorAll('tbody [data-line-number], tbody tr[role="row"], tbody tr'),
    ).toHaveLength(CSV_PREVIEW_ROWS);
  });

  it('renders PDF through an <object type="application/pdf"> that is itself labelled', () => {
    const doc = makeDoc({ path: 'contract.pdf', type: 'pdf' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('pdf');
    expect(screen.getByTestId('document-preview-pdf')).toBeInTheDocument();

    const object = container.querySelector('object');
    expect(object).toHaveAttribute('type', 'application/pdf');
    // The defect being fixed: the inner iframe had a title but the wrapping
    // <object> had no accessible name at all.
    expect(object).toHaveAttribute('aria-label', 'PDF preview of contract.pdf');

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('title', 'contract.pdf');
  });

  it('renders an image with alt text taken from the file name', () => {
    const doc = makeDoc({ path: 'charts/revenue.png', type: 'image' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('image');
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', BLOB_URL);
    expect(img).toHaveAttribute('alt', 'revenue.png');
  });

  it('renders video with an accessible name and a captions track element', () => {
    const doc = makeDoc({ path: 'demo.mp4', type: 'video' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('video');
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('aria-label', 'Video preview of demo.mp4');
    expect(video?.querySelector('track[kind="captions"]')).not.toBeNull();
  });

  it('renders audio with a named control and hides the decorative emoji', () => {
    const doc = makeDoc({ path: 'theme.mp3', type: 'audio' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('audio');
    expect(container.querySelector('audio')).toHaveAttribute(
      'aria-label',
      'Audio preview of theme.mp3',
    );

    const emoji = screen
      .getByTestId('document-preview-audio')
      .querySelector('div[aria-hidden="true"]');
    expect(emoji).not.toBeNull();
    expect(emoji).toHaveTextContent('🎵');
  });

  it('renders the unsupported state for a format with no inline renderer', () => {
    const doc = makeDoc({ path: 'payload.exe', type: 'unknown' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('none');
    expect(screen.getByTestId('document-preview-unsupported')).toHaveTextContent(
      'No inline preview',
    );
    expect(screen.getByTestId('document-preview-unsupported')).toHaveTextContent('exe');
    // And nothing else rendered: this is the branch, not a fallback after a
    // failed attempt at a media branch.
    expect(screen.queryByTestId('document-preview-image')).not.toBeInTheDocument();
    expect(container.querySelector('img, video, audio, object')).toBeNull();
  });

  it('honours Office binaries as unsupported rather than guessing a text branch', () => {
    const doc = makeDoc({ path: 'budget.xlsx', type: 'xlsx' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('none');
    expect(screen.getByTestId('document-preview-unsupported')).toBeInTheDocument();
  });
});

describe('DocumentPreview — classification precedence', () => {
  it('prefers the extension over a contradicting backend type', () => {
    // EXTENSION_MAP can label a `.md` as 'text'. Extension wins, so this must be
    // markdown — the old detail view branched on the type first and would have
    // dropped it into the plain-text <pre>.
    const doc = makeDoc({ path: 'runbook.md', type: 'text' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ text: '# Runbook', mimeType: 'text/plain' }} />,
    );

    expect(kind(container)).toBe('markdown');
  });

  it('falls back to the detected MIME when the path has no extension', () => {
    const doc = makeDoc({ path: 'blob', type: 'unknown', detectedMimeType: 'image/png' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('image');
  });

  it('does not render markdown for a PDF even when a text body is supplied', () => {
    // The negative control: if the branch order regressed to "text first", this
    // would render the markdown branch and the test would still pass on a
    // "something rendered" assertion.
    const doc = makeDoc({ path: 'report.pdf', type: 'pdf' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ url: BLOB_URL, text: '# not markdown' }} />,
    );

    expect(kind(container)).toBe('pdf');
    expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
    expect(container.querySelector('object')).not.toBeNull();
  });
});

describe('DocumentPreview — non-content states', () => {
  it('renders a polite status region while loading and no branch at all', () => {
    const doc = makeDoc({ path: 'notes.md' });
    const { container } = render(<DocumentPreview document={doc} source={null} loading />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading document preview');
    expect(container.querySelector('[data-testid="document-preview"]')).toBeNull();
  });

  it('renders a failed preview as an alert carrying the reason', () => {
    const doc = makeDoc({ path: 'notes.md' });
    render(<DocumentPreview document={doc} source={null} error="Content fetch was denied" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Content fetch was denied');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('prefers the error over the loading state when both are supplied', () => {
    const doc = makeDoc({ path: 'notes.md' });
    render(<DocumentPreview document={doc} source={null} loading error="Boom" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    expect(screen.queryByTestId('document-preview-loading')).not.toBeInTheDocument();
  });

  it('says the text is unavailable instead of degrading a text document to a download', () => {
    const doc = makeDoc({ path: 'notes.md' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    expect(kind(container)).toBe('markdown');
    expect(screen.getByText('Text not available')).toBeInTheDocument();
    expect(screen.queryByTestId('document-preview-unsupported')).not.toBeInTheDocument();
  });

  it('reports an empty CSV as having no rows rather than as a broken table', () => {
    const doc = makeDoc({ path: 'empty.csv', type: 'csv' });
    const { container } = render(<DocumentPreview document={doc} source={{ text: '' }} />);

    expect(kind(container)).toBe('csv');
    expect(screen.getByText('No rows to preview')).toBeInTheDocument();
    expect(screen.queryByText('Table not available')).not.toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
  });

  it('distinguishes a header-only CSV from a completely empty one', () => {
    const doc = makeDoc({ path: 'header-only.csv', type: 'csv' });
    render(<DocumentPreview document={doc} source={{ text: 'region,total\n' }} />);

    expect(screen.getByText(/contains a header but no data rows/)).toBeInTheDocument();
  });

  it('renders the host empty state when no document is selected', () => {
    render(<DocumentPreview document={null} source={null} />);

    expect(screen.getByText('No document selected')).toBeInTheDocument();
  });

  it('hides host header chrome while loading and while erroring', () => {
    const doc = makeDoc({ path: 'notes.md' });
    const { rerender } = render(
      <DocumentPreview
        document={doc}
        source={null}
        loading
        headerActions={<button type="button">Download</button>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();

    rerender(
      <DocumentPreview
        document={doc}
        source={{ text: '# x' }}
        error="nope"
        headerActions={<button type="button">Download</button>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('exposes the host fallback action inside the unsupported state only', () => {
    const doc = makeDoc({ path: 'payload.exe', type: 'unknown' });
    render(
      <DocumentPreview
        document={doc}
        source={{ url: BLOB_URL }}
        fallbackAction={<button type="button">Download File</button>}
      />,
    );

    const unsupported = screen.getByTestId('document-preview-unsupported');
    expect(within(unsupported).getByRole('button', { name: 'Download File' })).toBeInTheDocument();
  });
});

describe('DocumentPreview — copy and zoom handoff to the host', () => {
  it('hands the raw text to onCopyText from the CSV body copy control', () => {
    const onCopyText = jest.fn();
    const doc = makeDoc({ path: 'data.csv', type: 'csv' });
    render(
      <DocumentPreview document={doc} source={{ text: 'a,b\n1,2' }} onCopyText={onCopyText} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy CSV Text' }));
    expect(onCopyText).toHaveBeenCalledWith('a,b\n1,2');
  });

  it('omits every copy control when the host does not provide onCopyText', () => {
    const doc = makeDoc({ path: 'data.csv', type: 'csv' });
    render(<DocumentPreview document={doc} source={{ text: 'a,b\n1,2' }} />);

    expect(screen.queryByRole('button', { name: 'Copy CSV Text' })).not.toBeInTheDocument();
  });

  it('makes the image a keyboard-operable zoom control with announced state', () => {
    // Before: a bare <img onClick>. No role, no tab stop, no key handling, and a
    // sighted-only affordance.
    const onZoomToggle = jest.fn();
    const doc = makeDoc({ path: 'shot.png', type: 'image' });
    const { container, rerender } = render(
      <DocumentPreview
        document={doc}
        source={{ url: BLOB_URL }}
        zoom={false}
        onZoomToggle={onZoomToggle}
      />,
    );

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('role', 'button');
    expect(img).toHaveAttribute('tabindex', '0');
    expect(img).toHaveAttribute('aria-pressed', 'false');
    expect(img).toHaveAttribute('aria-label', 'shot.png, fit to screen. Activate to zoom to 100%.');

    fireEvent.click(img);
    expect(onZoomToggle).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(img, { key: 'Enter' });
    fireEvent.keyDown(img, { key: ' ' });
    expect(onZoomToggle).toHaveBeenCalledTimes(3);

    // A key the handler ignores must not toggle, so the control cannot be driven
    // by stray typing while it holds focus.
    fireEvent.keyDown(img, { key: 'ArrowRight' });
    expect(onZoomToggle).toHaveBeenCalledTimes(3);

    // The host owns the state; the renderer reflects it back in the ARIA.
    rerender(
      <DocumentPreview
        document={doc}
        source={{ url: BLOB_URL }}
        zoom
        onZoomToggle={onZoomToggle}
      />,
    );
    const zoomed = container.querySelector('img') as HTMLImageElement;
    expect(zoomed).toHaveAttribute('aria-pressed', 'true');
    expect(zoomed).toHaveAttribute(
      'aria-label',
      'shot.png, zoomed to 100%. Activate to fit to screen.',
    );
  });

  it('leaves the image inert when the host offers no zoom', () => {
    const doc = makeDoc({ path: 'shot.png', type: 'image' });
    const { container } = render(<DocumentPreview document={doc} source={{ url: BLOB_URL }} />);

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toHaveAttribute('role');
    expect(img).not.toHaveAttribute('tabindex');
    expect(img).not.toHaveAttribute('aria-pressed');
  });
});

describe('DocumentPreview — layout variant does not change the branch', () => {
  it.each(['panel', 'modal'] as const)('resolves the same kind in the %s layout', (layout) => {
    const doc = makeDoc({ path: 'photo.jpg', type: 'image' });
    const { container } = render(
      <DocumentPreview document={doc} source={{ url: BLOB_URL }} layout={layout} />,
    );

    expect(kind(container)).toBe('image');
    expect(container.querySelector('img')).not.toBeNull();
  });
});
