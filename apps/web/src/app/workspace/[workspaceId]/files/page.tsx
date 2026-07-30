'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { documentApi } from '@/lib/api-client';
import type { DocumentResponse } from '@/lib/api-client';

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WorkspaceFilesPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await documentApi.list({ workspace_id: workspaceId });
      setDocuments(res.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Files</h1>
          <p className="text-text-muted">Manage your documents.</p>
        </header>
        <LoadingSpinner text="Loading files..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Files</h1>
          <p className="text-text-muted">Manage your documents.</p>
        </header>
        <ErrorState title="Failed to load files" message={error} onRetry={fetchDocuments} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Files</h1>
        <p className="text-text-muted">Manage your documents.</p>
      </header>

      {documents.length === 0 ? (
        <EmptyState title="No files yet" description="Upload your resume, transcripts, or cover letters to get started." />
      ) : (
        <div className="card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                <th scope="col" className="pb-3 font-normal">Name</th>
                <th scope="col" className="pb-3 font-normal">Type</th>
                <th scope="col" className="pb-3 font-normal">Created</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-border/50 hover:bg-background/50 cursor-pointer transition-colors">
                  <td className="py-3 text-text font-medium">{getFileName(doc.path)}</td>
                  <td className="py-3 text-text-muted font-mono text-sm">{doc.type}</td>
                  <td className="py-3 text-text-muted text-sm">{formatDate(doc.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
