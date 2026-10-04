'use client';

/**
 * The document preview DIALOG.
 *
 * All media/content rendering lives in `./DocumentPreview`, which this modal is
 * now a thin shell around. What stays here is the chrome that belongs to a modal
 * and to nothing else: the zoom toggle, the open-in-new-tab link, the download
 * link, the vault-note badge and the file-type label.
 *
 * Accessibility notes for this shell specifically:
 *
 *  - The image zoom is a real control, not a click handler on an `<img>`. The
 *    button carries `aria-pressed`, and the image itself becomes a
 *    `role="button"` with a tab stop and Enter/Space handling inside
 *    `DocumentPreview`, so the zoom is reachable without a pointer.
 *  - The loading spinner sits inside a `role="status"` live region, so a screen
 *    reader announces that the preview is loading rather than landing on a
 *    silent dialog.
 *  - The "New Tab" and "Download" anchors are named with the file, because their
 *    visible text ("New Tab", "Download") says nothing about WHICH document they
 *    act on.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Modal } from '@vaeloom/ui-kit';
import { DownloadIcon, ExternalLinkIcon } from '@vaeloom/ui-kit';

import type { DocumentResponse } from '@/lib/api-client';
import { extensionOf, getFileName, previewKind } from '@/lib/document-format';

import { DocumentPreview, type DocumentPreviewContent } from './DocumentPreview';

export type { DocumentPreviewContent } from './DocumentPreview';

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentResponse | null;
  content: DocumentPreviewContent | null;
  loading: boolean;
  workspaceId?: string;
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

  if (!document) return null;

  const fileName = getFileName(document.path);
  const ext = extensionOf(document.path);
  const type = (document.type || '').toLowerCase();
  // `docWorkspaceId` from document-format is not used here: its parameter is typed
  // `(WorkspaceScoped & Record<string, unknown>)`, which `DocumentResponse` (an
  // interface with no index signature) is not assignable to. `workspaceId` is a
  // required string on the interface, so this is the same lookup, typed.
  const targetWsId = document.workspaceId || workspaceId || '';

  const isVaultNote =
    document.metadata?.category === 'vault_note' ||
    document.type === 'vault_note' ||
    document.detectedMimeType === 'text/markdown';

  // The backend never writes a `title` key into Document.metadata, so the file
  // name with its extension stripped is the only honest note title available.
  const noteTitle = fileName.replace(/\.md$/i, '');

  const handleCopy = () => {
    if (content?.text) {
      void navigator.clipboard.writeText(content.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const typeLabel = ext || type || 'file';

  // The zoom toggle is chrome, so it belongs here — but it is only meaningful for
  // an image. The classification itself is NOT duplicated: this asks the shared
  // `previewKind`, which is the same call `DocumentPreview` makes internally.
  const zoomable = previewKind(document.detectedMimeType ?? null, null, document.type, {
    path: document.path,
  });

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
              <Badge variant="mono" size="sm">
                {typeLabel}
              </Badge>
              {isVaultNote && (
                <Badge variant="info" size="sm" title="Synchronized with the workspace vault">
                  Vault Synced
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isVaultNote && targetWsId && (
                <Link
                  href={`/workspace/${targetWsId}/memory?query=${encodeURIComponent(noteTitle)}`}
                  className="px-2.5 py-1 rounded-md bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/40 font-medium inline-flex items-center gap-1.5 transition-colors text-xs shadow-sm"
                >
                  <span>View in Memory Graph</span>
                </Link>
              )}
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${fileName} in a new browser tab`}
                className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover text-text border border-border font-medium inline-flex items-center gap-1 transition-colors text-xs"
              >
                <ExternalLinkIcon size={14} />
                <span>New Tab</span>
              </a>

              <a
                href={content.url}
                download={fileName}
                aria-label={`Download ${fileName} to this device`}
                className="px-2.5 py-1 rounded-md bg-primary text-primary-fg hover:bg-primary/90 font-medium inline-flex items-center gap-1 transition-colors text-xs shadow-sm"
              >
                <DownloadIcon size={14} />
                <span>Download</span>
              </a>
            </div>
          </div>
        )}

        {/* Content Preview Container */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-center">
          <DocumentPreview
            document={document}
            source={content}
            loading={loading}
            zoom={imageZoom}
            onZoomToggle={zoomable === 'image' ? () => setImageZoom((prev) => !prev) : undefined}
            onCopyText={handleCopy}
            layout="modal"
            headerActions={
              zoomable === 'image' || copied ? (
                <>
                  {zoomable === 'image' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-pressed={imageZoom}
                      onClick={() => setImageZoom((prev) => !prev)}
                    >
                      {imageZoom ? 'Fit to Screen' : 'Zoom 100%'}
                    </Button>
                  )}
                  {copied && (
                    <Badge variant="success" size="sm" role="status">
                      Copied
                    </Badge>
                  )}
                </>
              ) : undefined
            }
          />
        </div>
      </div>
    </Modal>
  );
}

export default DocumentPreviewModal;
