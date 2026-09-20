'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gdprApi } from '@/lib/api-client';
import { clearToken, clearRefreshToken } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';

export function AccountPrivacyCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await gdprApi.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaeloom-personal-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        tone: 'success',
        title: 'Data archive downloaded',
        detail: `Exported ${data.total_records ?? 0} data records.`,
      });
    } catch (err: any) {
      toast({
        tone: 'error',
        title: 'Export failed',
        detail: err?.message || 'Could not compile personal data archive.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('You must type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await gdprApi.delete();
      clearToken();
      clearRefreshToken();
      toast({
        tone: 'success',
        title: 'Account deleted',
        detail: 'Your personal data has been erased. Redirecting...',
      });
      setTimeout(() => {
        router.replace('/login');
      }, 1500);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text border-b border-border pb-3 mb-4">
        Privacy & Data Ownership (GDPR)
      </h2>
      <p className="text-sm text-text-muted mb-6">
        Under zero-trust and GDPR principles, you have full ownership and portability of your
        personal data.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Data */}
        <div className="rounded-lg border border-border/80 bg-background/50 p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <svg
                className="w-4 h-4 text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Personal Data
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Export all your personal records, resumes, activity history, and settings into a
              machine-readable JSON archive.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportData}
            disabled={exporting}
            className="mt-4 w-full py-2 text-xs font-semibold rounded-lg border border-border hover:bg-surface-hover text-text transition-colors disabled:opacity-50"
          >
            {exporting ? 'Generating Archive...' : 'Download My Data (.json)'}
          </button>
        </div>

        {/* Delete Account */}
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Permanent Account Erasure
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Permanently delete your user account and cascade erase all associated personal profile
              records and documents.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmation('');
              setDeleteError(null);
              setDeleteModalOpen(true);
            }}
            className="mt-4 w-full py-2 text-xs font-semibold rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-lg font-bold text-text">Permanently Delete Account?</h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              This action is <strong className="text-text">permanent and irreversible</strong>. All
              your documents, profiles, agent memories, and sessions will be deleted immediately.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-text mb-1">
                Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text font-mono focus:border-red-500 focus:outline-none"
              />
              {deleteError && <p className="text-xs text-red-500 mt-1.5">{deleteError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmation !== 'DELETE'}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Erasing Account...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
