'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gdprApi } from '@/lib/api-client';

export function ProfileExport({ workspaceId, userId }: { workspaceId: string; userId?: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportPDF = () => {
    router.push(`/workspace/${workspaceId}/resume`);
  };

  const handleCopyLink = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = userId
        ? `${origin}/p/${userId}`
        : typeof window !== 'undefined'
          ? window.location.href
          : '';
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadJSON = async () => {
    setDownloading(true);
    setError(null);
    try {
      const data = await gdprApi.export();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaeloom-profile-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export profile data');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text">Export Profile</h2>
        <p className="text-sm text-text-dim mt-1">Download your data or share your profile</p>
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleExportPDF}
          className="w-full flex items-center justify-between p-3 border border-border rounded-lg hover:bg-surface-hover hover:border-primary/30 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-surface-200 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-text">Export as PDF</p>
              <p className="text-xs text-text-dim">Generate a resume from your profile</p>
            </div>
          </div>
          <svg
            className="w-4 h-4 text-text-muted group-hover:text-text transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-between p-3 border border-border rounded-lg hover:bg-surface-hover hover:border-primary/30 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-surface-200 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
              {copied ? (
                <svg
                  className="w-4 h-4 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-text">
                {copied ? 'Link Copied to Clipboard!' : 'Copy Profile Link'}
              </p>
              <p className="text-xs text-text-dim">Share your public profile page</p>
            </div>
          </div>
          {copied ? (
            <span className="text-xs text-emerald-600 font-medium">Copied!</span>
          ) : (
            <svg
              className="w-4 h-4 text-text-muted group-hover:text-text transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
              />
            </svg>
          )}
        </button>

        <button
          onClick={handleDownloadJSON}
          disabled={downloading}
          className="w-full flex items-center justify-between p-3 border border-border rounded-lg hover:bg-surface-hover hover:border-primary/30 transition-colors group cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-surface-200 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-text">
                {downloading ? 'Preparing Export...' : 'Download JSON'}
              </p>
              <p className="text-xs text-text-dim">GDPR-compliant full data export</p>
            </div>
          </div>
          <svg
            className="w-4 h-4 text-text-muted group-hover:text-text transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
