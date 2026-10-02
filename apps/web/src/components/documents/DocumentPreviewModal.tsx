'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Modal } from '@vaeloom/ui-kit';
import type { DocumentResponse } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentResponse | null;
  content: {
    url: string;
    text?: string;
    unsupported?: boolean;
  } | null;
  loading: boolean;
  workspaceId?: string;
}

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  document,
  content,
  loading,
  workspaceId,
}: DocumentPreviewModalProps) {
  const [imageZoom, setImageZoom] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileName = document ? getFileName(document.path) : '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const type = document?.type?.toLowerCase() || '';

  const isMarkdown = type === 'markdown' || ext === 'md' || ext === 'markdown';
  const isPdf = type === 'pdf' || ext === 'pdf';
  const isImage =
    type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext);
  const isCsv = type === 'csv' || ext === 'csv' || ext === 'tsv';
  const isCode = [
    'js',
    'ts',
    'tsx',
    'jsx',
    'py',
    'json',
    'yaml',
    'yml',
    'sql',
    'sh',
    'bash',
    'html',
    'css',
    'go',
    'rs',
    'cpp',
    'c',
    'h',
  ].includes(ext);
  const isVideo = ['mp4', 'mov', 'webm'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);

  const parsedCsv = useMemo(() => {
    if (!isCsv || !content?.text) return null;
    const lines = content.text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === delimiter && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };
    const firstLine = lines[0] ?? '';
    const headers = parseLine(firstLine);
    const rows = lines.slice(1, 101).map((r) => parseLine(r ?? ''));
    return { headers, rows, totalRows: lines.length - 1 };
  }, [isCsv, content?.text, ext]);

  const codeLines = useMemo(() => {
    if (!isCode || !content?.text) return [];
    return content.text.split(/\r?\n/);
  }, [isCode, content?.text]);

  const handleCopy = () => {
    if (content?.text) {
      void navigator.clipboard.writeText(content.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!document) return null;

  const isVaultNote =
    document.metadata?.['category'] === 'vault_note' ||
    document.type === 'vault_note' ||
    document.detected_mime_type === 'text/markdown' ||
    isMarkdown;

  const noteTitle = (document.metadata?.['title'] as string) || fileName.replace(/\.md$/i, '');

  const targetWsId =
    workspaceId ||
    (document as unknown as Record<string, string>)?.['workspace_id'] ||
    (document as unknown as Record<string, string>)?.['workspaceId'] ||
    '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={fileName} size="xl">
      <div className="w-full flex flex-col min-h-[350px] max-h-[82vh] overflow-hidden">
        {/* Quick Action & Metadata Bar */}
        {content?.url && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 mb-2 bg-surface-200/80 rounded-lg border border-border/60 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-text-muted text-[11px] truncate max-w-[220px] sm:max-w-xs">
                {fileName}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-surface text-text-dim border border-border/50">
                {ext || type || 'file'}
              </span>
              {isVaultNote && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-400 bg-purple-500/15 border border-purple-500/30 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Vault Synced
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isVaultNote && targetWsId && (
                <Link
                  href={`/workspace/${targetWsId}/memory?query=${encodeURIComponent(noteTitle)}`}
                  className="px-2.5 py-1 rounded-md bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/40 font-medium inline-flex items-center gap-1.5 transition-colors text-xs shadow-sm"
                  title="View in Memory Graph"
                >
                  <svg
                    className="w-3.5 h-3.5 text-purple-400"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon
                      points="12,2 20,9 17,21 7,21 4,9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>View in Memory Graph</span>
                </Link>
              )}
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover text-text border border-border font-medium inline-flex items-center gap-1 transition-colors text-xs"
                title="Open in new browser tab"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span>New Tab</span>
              </a>

              <a
                href={content.url}
                download={fileName}
                className="px-2.5 py-1 rounded-md bg-primary text-primary-fg hover:bg-primary/90 font-medium inline-flex items-center gap-1 transition-colors text-xs shadow-sm"
                title="Download to local device"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Download</span>
              </a>
            </div>
          </div>
        )}

        {/* Content Preview Container */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-1 sm:p-2">
          {loading ? (
            <div className="py-16">
              <LoadingSpinner size="lg" text="Loading document preview..." />
            </div>
          ) : content?.text ? (
            isMarkdown ? (
              <div className="w-full max-h-[68vh] overflow-y-auto p-4 sm:p-6 rounded-lg bg-surface/80 border border-border/60 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.text}</ReactMarkdown>
              </div>
            ) : isCsv && parsedCsv ? (
              <div className="w-full max-h-[68vh] overflow-y-auto space-y-2 p-2 rounded-lg bg-surface/80 border border-border/60">
                <div className="flex items-center justify-between text-xs text-text-muted px-2 py-1">
                  <span>
                    {parsedCsv.headers.length} columns · {parsedCsv.totalRows} rows
                    {parsedCsv.totalRows > 100 && ' (previewing first 100)'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-primary hover:underline font-medium text-xs"
                  >
                    {copied ? 'Copied CSV' : 'Copy CSV Text'}
                  </button>
                </div>
                <div className="overflow-x-auto border border-border/70 rounded-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-200 sticky top-0 border-b border-border text-text font-semibold">
                      <tr>
                        <th className="p-2 w-10 text-center text-text-dim border-r border-border/50">
                          #
                        </th>
                        {parsedCsv.headers.map((h, i) => (
                          <th key={i} className="p-2 border-r border-border/50 whitespace-nowrap">
                            {h || `Col ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                      {parsedCsv.rows.map((r, rIdx) => (
                        <tr key={rIdx} className="hover:bg-surface-hover/50 odd:bg-surface/20">
                          <td className="p-2 text-center text-text-dim border-r border-border/50">
                            {rIdx + 1}
                          </td>
                          {r.map((cell, cIdx) => (
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
            ) : isCode && codeLines.length > 0 ? (
              <div className="w-full max-h-[68vh] overflow-hidden rounded-lg bg-surface-sunken border border-border/80 font-mono text-xs">
                <div className="flex items-center justify-between px-3 py-1.5 bg-surface-200 border-b border-border text-[11px] text-text-muted">
                  <span>
                    {fileName} ({codeLines.length} lines)
                  </span>
                  <button type="button" onClick={handleCopy} className="hover:text-text font-sans">
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <div className="overflow-auto max-h-[62vh] p-2">
                  <table className="w-full border-collapse">
                    <tbody>
                      {codeLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-surface-elevated/40">
                          <td className="w-10 text-right pr-3 select-none text-text-dim text-[10px] py-0.5 border-r border-border/40">
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
            ) : (
              <pre className="w-full max-h-[68vh] overflow-auto p-4 rounded-lg bg-background font-mono text-xs text-text leading-relaxed whitespace-pre-wrap break-words border border-border/50">
                {content.text}
              </pre>
            )
          ) : isImage && content?.url ? (
            <div className="w-full flex flex-col items-center justify-center p-2 rounded-lg bg-surface-50/40 border border-border/50">
              <div className="w-full flex justify-end pb-2">
                <button
                  type="button"
                  onClick={() => setImageZoom((prev) => !prev)}
                  className="px-2 py-0.5 text-[11px] rounded border border-border bg-surface text-text-muted hover:text-text"
                >
                  {imageZoom ? 'Fit to Screen' : 'Zoom 100%'}
                </button>
              </div>
              <div className="max-h-[65vh] w-full overflow-auto flex items-center justify-center">
                <img
                  src={content.url}
                  alt={fileName}
                  className={`rounded-lg object-contain transition-all shadow-md ${
                    imageZoom
                      ? 'max-w-none cursor-zoom-out'
                      : 'max-h-[60vh] max-w-full cursor-zoom-in'
                  }`}
                  onClick={() => setImageZoom((prev) => !prev)}
                />
              </div>
            </div>
          ) : isVideo && content?.url ? (
            <div className="w-full flex flex-col items-center justify-center p-2">
              <video
                controls
                src={content.url}
                className="max-h-[62vh] max-w-full rounded-lg shadow-lg border border-border bg-black"
              >
                Your browser does not support HTML5 video preview.
              </video>
            </div>
          ) : isAudio && content?.url ? (
            <div className="w-full flex flex-col items-center justify-center p-8 bg-surface-100 rounded-xl border border-border">
              <div className="text-3xl mb-3">🎵</div>
              <p className="text-sm font-semibold text-text mb-4">{fileName}</p>
              <audio controls src={content.url} className="w-full max-w-md">
                Your browser does not support HTML5 audio playback.
              </audio>
            </div>
          ) : isPdf && content?.url ? (
            <div className="w-full flex-1 flex flex-col h-[65vh] sm:h-[70vh]">
              <object
                data={`${content.url}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="w-full flex-1 rounded-lg border border-border bg-surface-100"
              >
                <iframe
                  src={`${content.url}#toolbar=1`}
                  title={fileName}
                  className="w-full h-full border-0 rounded-lg"
                >
                  <div className="p-8 text-center space-y-3 bg-surface-100 rounded-lg">
                    <p className="text-sm text-text-muted">
                      Your browser has disabled inline PDF preview.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <a
                        href={content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-surface border border-border text-text hover:bg-surface-hover"
                      >
                        Open in New Tab
                      </a>
                      <a
                        href={content.url}
                        download={fileName}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary/90"
                      >
                        Download PDF
                      </a>
                    </div>
                  </div>
                </iframe>
              </object>
            </div>
          ) : (
            <div className="text-center space-y-3 py-10 px-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-surface-200 flex items-center justify-center text-text-dim">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-text-muted">
                Direct in-browser preview is not supported for{' '}
                <span className="font-semibold text-text">{ext || type || 'binary'}</span> files.
              </p>
              {content?.url && (
                <div className="pt-2">
                  <a
                    href={content.url}
                    download={fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download File ({fileName})
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
