'use client';
import React, { useState } from 'react';
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
}: DocumentPreviewModalProps) {
  const [imageZoom, setImageZoom] = useState(false);

  if (!document) return null;

  const fileName = getFileName(document.path);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const type = document.type?.toLowerCase() || '';

  const isMarkdown = type === 'markdown' || ext === 'md' || ext === 'markdown';
  const isPdf = type === 'pdf' || ext === 'pdf';
  const isImage =
    type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext);

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
            </div>

            <div className="flex items-center gap-2">
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
