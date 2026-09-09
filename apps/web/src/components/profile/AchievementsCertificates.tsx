'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { documentApi, DocumentListResponse } from '@/lib/api-client';

interface Certificate {
  id: string;
  title: string;
  source: string;
  date: string;
}

export function AchievementsCertificates({
  certificates,
  workspaceId,
}: {
  certificates?: Certificate[];
  workspaceId?: string;
}) {
  const { data: docList, isLoading } = useSWR<DocumentListResponse>(
    workspaceId && (!certificates || certificates.length === 0)
      ? ['workspace-docs', workspaceId]
      : null,
    () => documentApi.list({ workspace_id: workspaceId, page_size: 20 }),
    { revalidateOnFocus: false },
  );

  const displayCertificates: Certificate[] = React.useMemo(() => {
    if (certificates && certificates.length > 0) return certificates;
    if (!docList?.documents || docList.documents.length === 0) return [];

    return docList.documents
      .filter((doc) => !doc.deleted_at)
      .slice(0, 6)
      .map((doc) => {
        const rawTitle =
          doc.path
            .split('/')
            .pop()
            ?.replace(/\.[^/.]+$/, '') || 'Document';
        const formattedTitle = rawTitle
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const d = doc.created_at ? new Date(doc.created_at) : new Date();
        const dateStr = d.toLocaleDateString([], { month: 'short', year: 'numeric' });

        return {
          id: doc.id,
          title: formattedTitle,
          source: doc.summary
            ? doc.summary.slice(0, 60) + '...'
            : `Uploaded document (${doc.type.toUpperCase()})`,
          date: dateStr,
        };
      });
  }, [certificates, docList]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-text">Achievements & Credentials</h2>
          <p className="text-sm text-text-dim mt-1">Credentials extracted from your documents</p>
        </div>
        {workspaceId && (
          <Link
            href={`/workspace/${workspaceId}/documents`}
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            Manage Docs
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
          <div className="h-20 bg-surface-200 rounded-lg" />
          <div className="h-20 bg-surface-200 rounded-lg" />
        </div>
      ) : displayCertificates.length === 0 ? (
        <div className="text-center py-8 px-4 border border-dashed border-border rounded-lg bg-surface-50">
          <svg
            className="w-8 h-8 text-text-muted mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
          <p className="text-sm font-medium text-text">No certificates found</p>
          <p className="text-xs text-text-dim mt-1 mb-4">
            Upload your certifications to build your profile
          </p>
          {workspaceId && (
            <Link
              href={`/workspace/${workspaceId}/documents`}
              className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
            >
              Upload Document
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayCertificates.map((cert) => (
            <div
              key={cert.id}
              className="border border-border rounded-lg p-4 flex gap-4 items-start hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-text truncate">{cert.title}</h3>
                <p className="text-xs text-text-dim mt-1 line-clamp-2">{cert.source}</p>
                <p className="text-xs font-mono text-text-muted mt-2">{cert.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
