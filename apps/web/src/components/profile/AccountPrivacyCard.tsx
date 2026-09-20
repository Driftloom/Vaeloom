'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gdprApi } from '@/lib/api-client';
import { clearToken, clearRefreshToken } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Panel, Button, DownloadIcon, TrashIcon, ShieldIcon } from '@vaeloom/ui-kit';

export function AccountPrivacyCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        title: 'Data archive generated',
        detail: `Exported ${data.total_records ?? 0} data records.`,
      });
    } catch (err: unknown) {
      toast({
        tone: 'error',
        title: 'Export failed',
        detail: err instanceof Error ? err.message : 'Could not compile personal data archive.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
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
    } catch (err: unknown) {
      toast({
        tone: 'error',
        title: 'Deletion failed',
        detail: err instanceof Error ? err.message : 'Failed to delete account.',
      });
      setDeleting(false);
    }
  };

  return (
    <Panel
      padding="lg"
      header={
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Privacy & Data Ownership (GDPR)</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Under zero-trust and GDPR principles, you retain full ownership and portability of all
              personal data.
            </p>
          </div>
          <ShieldIcon size={18} className="text-primary" />
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Data */}
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <DownloadIcon size={16} className="text-primary" />
              <span>Download Personal Data</span>
            </div>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              Export all your personal records, resumes, activity history, and settings into a
              machine-readable JSON archive.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportData}
            loading={exporting}
            className="w-full justify-center"
          >
            Download My Data (.json)
          </Button>
        </div>

        {/* Delete Account */}
        <div className="rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-error">
              <TrashIcon size={16} />
              <span>Permanent Account Erasure</span>
            </div>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              Permanently delete your user account and cascade erase all associated personal profile
              records, memories, and documents.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteModalOpen(true)}
            className="w-full justify-center"
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Canonical Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Permanently Delete Account?"
        message="This action is permanent and irreversible. All your documents, profiles, agent memories, and active sessions will be deleted immediately."
        confirmLabel="Permanently Delete"
        variant="danger"
        loading={deleting}
      />
    </Panel>
  );
}
