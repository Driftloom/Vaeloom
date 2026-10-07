'use client';

import React from 'react';
import { Badge, Button, DownloadIcon, Panel } from '@vaeloom/ui-kit';
import type { DocumentResponse } from '@/lib/api-client';
import { DocumentPreview } from '../DocumentPreview';

export interface DocumentPreviewTabProps {
  doc: DocumentResponse;
  blobUrl: string | null;
  textContent: string | null;
  contentError: string | null;
  copied: boolean;
  inlinePreviewable: string;
  fileName: string;
  onCopyText: (text: string) => void;
}

export const DocumentPreviewTab: React.FC<DocumentPreviewTabProps> = ({
  doc,
  blobUrl,
  textContent,
  contentError,
  copied,
  inlinePreviewable,
  fileName,
  onCopyText,
}) => {
  return (
    <div className="space-y-3">
      {textContent != null && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {copied && (
            <Badge variant="success" size="sm" role="status">
              Copied to clipboard
            </Badge>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onCopyText(textContent)}
          >
            Copy Content
          </Button>
        </div>
      )}

      <Panel padding="none" variant="subtle" className="min-h-[50dvh] overflow-auto">
        <DocumentPreview
          document={doc}
          source={{ url: blobUrl, text: textContent }}
          error={contentError}
          onCopyText={onCopyText}
          headerActions={
            <>
              {inlinePreviewable !== 'none' && blobUrl && (
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${fileName} in a new browser tab`}
                  className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover text-text border border-border font-medium inline-flex items-center gap-1 transition-colors text-xs"
                >
                  Open in New Tab
                </a>
              )}
              {blobUrl && (
                <a
                  href={blobUrl}
                  download={fileName}
                  aria-label={`Download ${fileName}`}
                  className="px-2.5 py-1 rounded bg-primary text-primary-fg hover:bg-primary/90 font-medium inline-flex items-center gap-1 transition-colors text-xs"
                >
                  <DownloadIcon size={12} />
                  Download
                </a>
              )}
            </>
          }
          fallbackAction={
            blobUrl ? (
              <a
                href={blobUrl}
                download={fileName}
                aria-label={`Download ${fileName}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-action text-action-fg hover:bg-action-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <DownloadIcon size={16} />
                Download File ({fileName})
              </a>
            ) : undefined
          }
        />
      </Panel>
    </div>
  );
};
