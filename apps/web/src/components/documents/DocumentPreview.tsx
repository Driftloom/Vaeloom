'use client';

/**
 * The single renderer for inline document previews.
 *
 * WHY THIS EXISTS
 *
 * `DocumentDetailView` and `DocumentPreviewModal` each carried their own copy of
 * the same nine-branch preview renderer (PDF object/iframe, image, video, audio,
 * markdown, CSV table, code viewer, plain text, unsupported fallback) plus their
 * own CSV parser, their own line splitter and their own seven extension tables.
 * The copies had already drifted: the detail view's image branch offered "Full
 * Resolution" and "Download" links that the modal's did not, the modal's PDF
 * branch and the detail view's PDF branch passed different fragment parameters to
 * the same `<object>`, and both CSV parsers silently mangled a quoted field
 * containing the delimiter.
 *
 * Classification is NOT re-implemented here. `previewKind` from
 * `@/lib/document-format` resolves all nine kinds from (extension, backend
 * `type`, MIME) with the documented precedence, so the seven hand-maintained
 * extension sets that used to live in each component are gone.
 *
 * SCOPE, DELIBERATELY
 *
 * This component renders MEDIA AND CONTENT ONLY. Zoom, download and
 * open-in-new-tab are chrome, and chrome belongs to the surface that owns it:
 * the modal owns its zoom toggle, new-tab link and download link, and the detail
 * view owns its header download. Hosts inject their own controls through
 * `headerActions` and `fallbackAction`; this component never renders a
 * download link of its own.
 */

import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, EmptyState, ErrorState, FileTextIcon, Spinner } from '@vaeloom/ui-kit';

import type { DocumentResponse } from '@/lib/api-client';
import {
  extensionOf,
  getFileName,
  parseCsv,
  previewKind,
  type PreviewKind,
} from '@/lib/document-format';

/** How much of a CSV is rendered before the rest is summarised as a count. */
export const CSV_PREVIEW_ROWS = 100;

/**
 * How many lines of source are rendered.
 *
 * The old renderers split the whole document with no ceiling, so a multi-hundred-
 * megabyte text file froze the tab. The cap is reported in the UI rather than
 * applied silently.
 */
export const CODE_PREVIEW_LINES = 2000;

/**
 * Records fetched so the CSV header can state an EXACT row count whenever the
 * file is small enough to count.
 *
 * `parseCsv` stops at `maxRows`, so asking for `CSV_PREVIEW_ROWS + 1` tells us
 * only that there are at least 100 data rows. Asking for `CSV_PREVIEW_ROWS + 2`
 * means a full result of `CSV_PREVIEW_ROWS + 1` data rows proves truncation, and
 * a shorter result means we read the entire file. That distinction is what lets
 * the header say "42 rows" honestly instead of the old code's count of non-blank
 * LINES, which over-counted any CSV containing a newline inside a quoted field.
 */
const CSV_ROW_PROBE = CSV_PREVIEW_ROWS + 2;

/** Bytes the preview renders. */
export interface DocumentPreviewSource {
  /** Object URL for the document's bytes. Required by every binary kind. */
  url?: string | null;
  /** Decoded UTF-8 text. Required by markdown, text, CSV and code. */
  text?: string | null;
  /**
   * MIME to assume when the blob's own type is unusable. The content endpoint
   * frequently returns `application/octet-stream` for a `.md` or `.csv`, which
   * makes the browser refuse the blob.
   */
  mimeType?: string | null;
}

/**
 * The content shape `DocumentPreviewModal` hands to {@link DocumentPreview}.
 *
 * `unsupported` is retained ONLY so the existing prop object in `DocumentsHub`
 * still type-checks. It is NOT read by {@link DocumentPreview}: `DocumentsHub`
 * computes that flag with its own extension list, which is the exact
 * double-classification this component was created to delete. Honouring it would
 * mean an `.mp4` rendered as "unsupported" even though the bytes are right there.
 */
export interface DocumentPreviewContent extends DocumentPreviewSource {
  url: string;
  unsupported?: boolean;
}

/**
 * Which of the two hosts is rendering. Only affects vertical sizing — the branch
 * taken for a given document is identical either way, which is what keeps the
 * two call sites from drifting again.
 */
export type DocumentPreviewLayout = 'panel' | 'modal';

const LAYOUTS: Record<
  DocumentPreviewLayout,
  { gutter: string; prose: string; scroller: string; media: string; pdfFrame: string }
> = {
  panel: {
    gutter: 'p-4',
    prose: 'max-h-[65vh] overflow-y-auto',
    scroller: 'max-h-[65vh]',
    media: 'max-h-[65vh]',
    pdfFrame: 'min-h-[58vh] max-h-[72vh]',
  },
  modal: {
    gutter: 'p-2',
    prose: 'max-h-[68vh] overflow-y-auto',
    scroller: 'max-h-[68vh]',
    media: 'max-h-[62vh]',
    pdfFrame: 'min-h-[55vh] max-h-[70vh]',
  },
};

export interface DocumentPreviewProps {
  /** The document being previewed. `null` renders the empty state. */
  document: DocumentResponse | null;
  /** The fetched bytes/text. `null` before the fetch resolves. */
  source: DocumentPreviewContent | DocumentPreviewSource | null;
  /** Renders the loading state instead of a branch. */
  loading?: boolean;
  /**
   * A fetch that failed. Rendered as an alert rather than silently degraded to
   * "no preview available", which is how a permission error used to look like a
   * missing file.
   */
  error?: string | null;
  /** Called with the raw text when a copy affordance inside the body fires. */
  onCopyText?: (text: string) => void;
  /** True when the host offers a zoom toggle for images. */
  zoom?: boolean;
  /** Host zoom toggle, wired to Enter/Space as well as click on the image. */
  onZoomToggle?: () => void;
  /** Host chrome (new tab, download, zoom button) rendered above the media. */
  headerActions?: React.ReactNode;
  /** Host control rendered inside the unsupported-format state. */
  fallbackAction?: React.ReactNode;
  layout?: DocumentPreviewLayout;
  className?: string;
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** Exact count when the whole file was parsed; otherwise a lower bound. */
  totalRows: number;
  truncated: boolean;
  /** No header record at all — a genuinely empty file. */
  emptyFile: boolean;
  /** A header but no data rows. */
  empty: boolean;
}

function parseCsvForPreview(text: string | null | undefined, isTsv: boolean): ParsedCsv | null {
  // `null`/`undefined` means the text was never fetched, which is a DIFFERENT
  // condition from an empty file: the former cannot be previewed, the latter
  // previews to nothing. Collapsing them produced "Table not available" for an
  // empty CSV, which reads as a fetch failure.
  if (text === null || text === undefined) return null;

  const records = parseCsv(text, {
    delimiter: isTsv ? '\t' : ',',
    maxRows: CSV_ROW_PROBE,
  });
  if (records.length === 0) {
    return { headers: [], rows: [], totalRows: 0, truncated: false, emptyFile: true, empty: true };
  }

  const headers = records[0] ?? [];
  const dataRows = records.slice(1);
  const truncated = dataRows.length > CSV_PREVIEW_ROWS;

  return {
    headers,
    rows: truncated ? dataRows.slice(0, CSV_PREVIEW_ROWS) : dataRows,
    totalRows: truncated ? CSV_PREVIEW_ROWS : dataRows.length,
    truncated,
    emptyFile: false,
    empty: dataRows.length === 0,
  };
}

export function DocumentPreview({
  document,
  source,
  loading = false,
  error = null,
  onCopyText,
  zoom = false,
  onZoomToggle,
  headerActions,
  fallbackAction,
  layout = 'panel',
  className = '',
}: DocumentPreviewProps) {
  const sizes = LAYOUTS[layout] ?? LAYOUTS.panel;
  const fileName = document ? getFileName(document.path) : '';
  const ext = document ? extensionOf(document.path) : '';

  // ONE discriminator, not six booleans.
  const kind: PreviewKind = useMemo(
    () =>
      previewKind(
        source?.mimeType ?? document?.detectedMimeType ?? null,
        null,
        document?.type ?? null,
        {
          path: document?.path ?? null,
        },
      ),
    [source?.mimeType, document?.detectedMimeType, document?.type, document?.path],
  );

  const csv = useMemo(
    () => (kind === 'csv' ? parseCsvForPreview(source?.text ?? null, ext === 'tsv') : null),
    [kind, source?.text, ext],
  );

  const codeLines = useMemo(() => {
    if (kind !== 'code') return null;
    const text = source?.text ?? null;
    // An empty file still has (zero) lines to render; only a missing text is a
    // state the renderer cannot show.
    if (text === null) return null;
    const all = text.split(/\r?\n/);
    return {
      lines: all.slice(0, CODE_PREVIEW_LINES),
      truncated: all.length > CODE_PREVIEW_LINES,
    };
  }, [kind, source?.text]);

  const handleZoomKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLImageElement>) => {
      if (!onZoomToggle) return;
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      onZoomToggle();
    },
    [onZoomToggle],
  );

  const url = source?.url ?? null;
  const text = source?.text ?? null;
  const zoomable = typeof onZoomToggle === 'function';

  // ─── Non-content states ────────────────────────────────────────────────────
  //
  // Error is checked BEFORE loading on purpose. A host that sets `error` while a
  // stale `loading` flag is still true would otherwise show a spinner that never
  // resolves, which is the exact failure the detail view's swallowed content
  // fetch used to produce.

  if (error) {
    return (
      <div className="py-8" data-testid="document-preview-error">
        <ErrorState title="Preview unavailable" message={error} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16"
        data-testid="document-preview-loading"
      >
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted">Loading document preview…</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="py-8" data-testid="document-preview-empty">
        <EmptyState
          icon={<FileTextIcon size={24} />}
          title="No document selected"
          description="Open a document to preview its contents here."
        />
      </div>
    );
  }

  // ─── Content branches ──────────────────────────────────────────────────────

  const body = (() => {
    switch (kind) {
      case 'markdown': {
        if (text === null) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="Text not available"
              description={`The contents of ${fileName} could not be read for preview. Download the file to inspect it.`}
            />
          );
        }
        return (
          <div
            data-testid="document-preview-markdown"
            className={`prose prose-invert prose-sm max-w-none p-4 leading-relaxed ${sizes.prose}`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        );
      }

      case 'text': {
        if (text === null) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="Text not available"
              description={`The contents of ${fileName} could not be read for preview. Download the file to inspect it.`}
            />
          );
        }
        return (
          <pre
            data-testid="document-preview-text"
            className={`font-mono text-xs text-text leading-relaxed whitespace-pre-wrap break-words p-4 ${sizes.prose}`}
          >
            {text}
          </pre>
        );
      }

      case 'code': {
        if (!codeLines) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="Source not available"
              description={`The contents of ${fileName} could not be read for preview. Download the file to inspect it.`}
            />
          );
        }
        return (
          <div
            data-testid="document-preview-code"
            className="rounded-lg border border-border/80 bg-surface-sunken overflow-hidden font-mono text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-surface-200 border-b border-border text-[11px] text-text-muted">
              <span>
                {fileName} ({codeLines.lines.length} lines
                {codeLines.truncated ? `, first ${CODE_PREVIEW_LINES} shown` : ''})
              </span>
              {onCopyText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyText(text ?? '')}
                >
                  Copy Code
                </Button>
              )}
            </div>
            <div className={`overflow-auto p-2 ${sizes.scroller}`}>
              <table className="w-full border-collapse">
                <caption className="sr-only">Source of {fileName}, numbered by line</caption>
                <tbody>
                  {codeLines.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-surface-elevated/40">
                      <td
                        data-line-number={idx + 1}
                        className="w-10 text-right pr-3 select-none text-text-dim text-[10px] py-0.5 border-r border-border/40"
                      >
                        {idx + 1}
                      </td>
                      <td className="pl-3 py-0.5 text-text whitespace-pre font-mono">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'csv': {
        if (csv === null) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="Table not available"
              description={`The contents of ${fileName} could not be read for preview. Download the file to inspect it.`}
            />
          );
        }
        if (csv.empty) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="No rows to preview"
              description={
                csv.emptyFile
                  ? `${fileName} contains no rows.`
                  : `${fileName} contains a header but no data rows.`
              }
            />
          );
        }
        const rowSummary = csv.truncated
          ? `${CSV_PREVIEW_ROWS}+ rows (showing first ${CSV_PREVIEW_ROWS})`
          : `${csv.totalRows} ${csv.totalRows === 1 ? 'row' : 'rows'}`;
        return (
          <div data-testid="document-preview-csv" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted px-1">
              <span>
                {csv.headers.length} {csv.headers.length === 1 ? 'column' : 'columns'} ·{' '}
                {rowSummary}
              </span>
              {onCopyText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyText(text ?? '')}
                >
                  Copy CSV Text
                </Button>
              )}
            </div>
            <div className={`overflow-x-auto border border-border/80 rounded-lg ${sizes.scroller}`}>
              <table className="w-full text-left text-xs border-collapse">
                <caption className="sr-only">
                  First {csv.rows.length} data {csv.rows.length === 1 ? 'row' : 'rows'} of{' '}
                  {fileName}
                </caption>
                <thead className="bg-surface-200 sticky top-0 border-b border-border text-text font-semibold">
                  <tr>
                    <th
                      scope="col"
                      className="p-2.5 w-10 text-center text-text-dim border-r border-border/50"
                    >
                      #
                    </th>
                    {csv.headers.map((header, i) => (
                      <th
                        key={`${header}-${i}`}
                        scope="col"
                        className="p-2.5 border-r border-border/50 whitespace-nowrap"
                      >
                        {header || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                  {csv.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-surface-hover/50 odd:bg-surface/20">
                      <th
                        scope="row"
                        className="p-2 text-center text-text-dim border-r border-border/50 font-normal"
                      >
                        {rIdx + 1}
                      </th>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="p-2 border-r border-border/50 whitespace-nowrap max-w-xs truncate text-text"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'pdf': {
        if (!url) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="PDF not available"
              description={`The bytes for ${fileName} could not be loaded for preview.`}
            />
          );
        }
        return (
          <div
            data-testid="document-preview-pdf"
            className={`flex flex-col w-full ${sizes.pdfFrame}`}
          >
            <object
              data={`${url}#toolbar=1`}
              type="application/pdf"
              aria-label={`PDF preview of ${fileName}`}
              className="w-full flex-1 min-h-[52vh] rounded-lg border border-border bg-surface-100"
            >
              <iframe
                src={`${url}#toolbar=1`}
                title={fileName || 'PDF document'}
                className="w-full h-full min-h-[52vh] rounded-lg border-0"
              />
            </object>
          </div>
        );
      }

      case 'image': {
        if (!url) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="Image not available"
              description={`The bytes for ${fileName} could not be loaded for preview.`}
            />
          );
        }
        return (
          <div
            data-testid="document-preview-image"
            className="flex flex-col items-center justify-center"
          >
            <div className={`w-full flex items-center justify-center ${sizes.scroller}`}>
              {/* eslint-disable-next-line @next/next/no-img-element --
                `next/image` cannot optimize a `blob:` URL: the optimizer fetches
                over HTTP and this object URL exists only in the tab that created
                it. The bytes came from an authenticated, workspace-scoped API
                call rather than a public CDN path, so there is no origin server
                to hand to the optimizer. */}
              <img
                src={url}
                alt={fileName || 'Document preview image'}
                className={`rounded-lg shadow-lg object-contain transition-all ${
                  zoom ? 'max-w-none cursor-zoom-out' : `${sizes.media} max-w-full cursor-zoom-in`
                }`}
                onClick={zoomable ? onZoomToggle : undefined}
                onKeyDown={zoomable ? handleZoomKeyDown : undefined}
                role={zoomable ? 'button' : undefined}
                tabIndex={zoomable ? 0 : undefined}
                aria-pressed={zoomable ? zoom : undefined}
                aria-label={
                  zoomable
                    ? zoom
                      ? `${fileName}, zoomed to 100%. Activate to fit to screen.`
                      : `${fileName}, fit to screen. Activate to zoom to 100%.`
                    : undefined
                }
              />
            </div>
          </div>
        );
      }

      case 'video': {
        if (!url) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="Video not available"
              description={`The bytes for ${fileName} could not be loaded for playback.`}
            />
          );
        }
        return (
          <div
            data-testid="document-preview-video"
            className="flex flex-col items-center justify-center"
          >
            <video
              controls
              src={url}
              aria-label={`Video preview of ${fileName}`}
              className={`${sizes.media} max-w-full rounded-lg shadow-lg border border-border bg-black`}
            >
              {/* Placeholder only. No caption file exists for an arbitrary upload,
                  so this entry gives the captions menu a control to point at
                  rather than satisfying WCAG 1.2.2 — see the phase report. */}
              <track kind="captions" srcLang="en" label="Captions not available for this file" />
              Your browser does not support HTML5 video preview.
            </video>
          </div>
        );
      }

      case 'audio': {
        if (!url) {
          return (
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="Audio not available"
              description={`The bytes for ${fileName} could not be loaded for playback.`}
            />
          );
        }
        return (
          <div
            data-testid="document-preview-audio"
            className="flex flex-col items-center justify-center p-8 bg-surface-100 rounded-xl border border-border"
          >
            <div aria-hidden="true" className="text-3xl mb-3">
              🎵
            </div>
            <p className="text-sm font-semibold text-text mb-4">{fileName}</p>
            <audio
              controls
              src={url}
              aria-label={`Audio preview of ${fileName}`}
              className="w-full max-w-md"
            >
              Your browser does not support HTML5 audio playback.
            </audio>
          </div>
        );
      }

      case 'none':
      default: {
        const label = ext || document.type || 'this file format';
        return (
          <div data-testid="document-preview-unsupported" className="py-6">
            <EmptyState
              icon={<FileTextIcon size={24} />}
              title="No inline preview"
              description={`Vaeloom does not render ${label} files in the browser. Download the file to inspect it.`}
            />
            {fallbackAction && <div className="flex justify-center -mt-4">{fallbackAction}</div>}
          </div>
        );
      }
    }
  })();

  return (
    <div
      className={`flex flex-col ${sizes.gutter} ${className}`}
      data-testid="document-preview"
      data-kind={kind}
    >
      {headerActions && (
        <div className="flex flex-wrap items-center justify-end gap-2 pb-2 mb-2 border-b border-border/40">
          {headerActions}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center">{body}</div>
    </div>
  );
}

export default DocumentPreview;
