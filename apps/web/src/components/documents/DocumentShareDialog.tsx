'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Input,
  Select,
  Badge,
  Spinner,
  UsersIcon,
  TrashIcon,
  AlertCircleIcon,
  CheckIcon,
  ClockIcon,
} from '@vaeloom/ui-kit';
import { documentApi, type DocumentResponse, type DocumentShareResponse } from '@/lib/api-client';

export interface DocumentShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document?: DocumentResponse | null;
  documentId?: string;
  workspaceId?: string;
  documentName?: string;
  shares?: DocumentShareResponse[];
  loadingShares?: boolean;
  onShare?: (
    targetWorkspaceId: string,
    permission: string,
    expiresAt?: string,
  ) => Promise<unknown> | void;
  onRevoke?: (shareId: string) => Promise<unknown> | void;
  onShareCreated?: (share: DocumentShareResponse) => void;
  onShareRevoked?: (shareId: string) => void;
}

const PERMISSION_OPTIONS = [
  { value: 'READ', label: 'Read Only (View & Download)' },
  { value: 'READ_WRITE', label: 'Read & Write (Edit & Upload Versions)' },
];

function getDocName(doc?: DocumentResponse | null, fallback = 'Document'): string {
  if (!doc?.path) return fallback;
  const parts = doc.path.split('/');
  return parts[parts.length - 1] || doc.path;
}

export const DocumentShareDialog: React.FC<DocumentShareDialogProps> = ({
  isOpen,
  onClose,
  document,
  documentId: propDocumentId,
  workspaceId: propWorkspaceId,
  documentName: propDocumentName,
  shares: propShares,
  loadingShares: propLoadingShares,
  onShare,
  onRevoke,
  onShareCreated,
  onShareRevoked,
}) => {
  const activeDocId = propDocumentId || document?.id || '';
  const activeWorkspaceId =
    propWorkspaceId ||
    document?.workspace_id ||
    (document as unknown as Record<string, string>)?.['workspaceId'] ||
    '';
  const displayName = propDocumentName || getDocName(document);

  const [internalShares, setInternalShares] = useState<DocumentShareResponse[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [sharesError, setSharesError] = useState<string | null>(null);

  const activeShares = propShares !== undefined ? propShares : internalShares;
  const isSharesLoading = propLoadingShares !== undefined ? propLoadingShares : internalLoading;

  // Form State
  const [targetWorkspaceId, setTargetWorkspaceId] = useState('');
  const [permission, setPermission] = useState('READ');
  const [expiresAt, setExpiresAt] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Revoke State
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    if (!activeDocId || !activeWorkspaceId || !isOpen || propShares !== undefined) return;
    setInternalLoading(true);
    setSharesError(null);

    try {
      const data = await documentApi.listShares(activeDocId, activeWorkspaceId);
      setInternalShares(data);
    } catch (err) {
      setSharesError(err instanceof Error ? err.message : 'Failed to load existing shares');
    } finally {
      setInternalLoading(false);
    }
  }, [activeDocId, activeWorkspaceId, isOpen, propShares]);

  useEffect(() => {
    if (isOpen) {
      void fetchShares();
      setCreateError(null);
      setCreateSuccess(null);
      setTargetWorkspaceId('');
      setPermission('READ');
      setExpiresAt('');
    }
  }, [isOpen, fetchShares]);

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTarget = targetWorkspaceId.trim();

    if (!trimmedTarget) {
      setCreateError('Target Workspace ID is required.');
      return;
    }

    if (activeWorkspaceId && trimmedTarget.toLowerCase() === activeWorkspaceId.toLowerCase()) {
      setCreateError('Cannot share with the same source workspace.');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const isoExpires = expiresAt ? new Date(expiresAt).toISOString() : undefined;

      if (onShare) {
        await onShare(trimmedTarget, permission, isoExpires);
      } else if (activeDocId && activeWorkspaceId) {
        const created = await documentApi.createShare(
          activeDocId,
          activeWorkspaceId,
          trimmedTarget,
          permission,
          isoExpires || null,
        );
        onShareCreated?.(created);
        await fetchShares();
      }

      setCreateSuccess(
        `Access successfully granted to workspace ${trimmedTarget.substring(0, 8)}...`,
      );
      setTargetWorkspaceId('');
      setExpiresAt('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to grant workspace share');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    setRevokingId(shareId);
    setSharesError(null);

    try {
      if (onRevoke) {
        await onRevoke(shareId);
      } else if (activeWorkspaceId) {
        await documentApi.revokeShare(shareId, activeWorkspaceId, activeDocId || undefined);
        setInternalShares((prev) => prev.filter((s) => s.id !== shareId));
        onShareRevoked?.(shareId);
      }
    } catch (err) {
      setSharesError(err instanceof Error ? err.message : 'Failed to revoke workspace share');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${displayName}"`} size="md">
      <div className="space-y-6">
        {/* Create Share Section */}
        <form onSubmit={handleCreateShare} className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-3">
              Grant Cross-Workspace Access
            </h4>

            <div className="space-y-3">
              <Input
                label="Target Workspace ID"
                placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                value={targetWorkspaceId}
                onChange={(e) => setTargetWorkspaceId(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Permission Level"
                  options={PERMISSION_OPTIONS}
                  value={permission}
                  onChange={(val) => setPermission(val)}
                />

                <Input
                  label="Optional Expiration"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {createError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-error/10 border border-error/20 text-xs text-error flex items-start gap-2"
            >
              <AlertCircleIcon size={14} className="shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          {createSuccess && (
            <div
              role="status"
              className="p-2.5 rounded-lg bg-success/10 border border-success/20 text-xs text-success flex items-start gap-2"
            >
              <CheckIcon size={14} className="shrink-0 mt-0.5" />
              <span>{createSuccess}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={createLoading}
              disabled={!targetWorkspaceId.trim()}
            >
              <UsersIcon size={14} className="mr-1.5" />
              Grant Access
            </Button>
          </div>
        </form>

        {/* Existing Shares Section */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
              Active Shares ({activeShares.length})
            </h4>
            {isSharesLoading && <Spinner size="sm" />}
          </div>

          {sharesError && (
            <div className="p-2.5 rounded-lg bg-error/10 border border-error/20 text-xs text-error">
              {sharesError}
            </div>
          )}

          {!isSharesLoading && activeShares.length === 0 && (
            <div className="p-6 text-center text-xs text-text-muted bg-surface-100 rounded-lg border border-border-subtle">
              This document is not currently shared with any other workspaces.
            </div>
          )}

          {activeShares.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activeShares.map((share) => {
                const targetWid = share.targetWorkspaceId || share.target_workspace_id || '';
                const perm = share.permission || 'READ';
                const exp = share.expiresAt || share.expires_at;

                return (
                  <div
                    key={share.id}
                    className="p-3 rounded-lg border border-border bg-surface-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <UsersIcon size={14} className="text-text-muted shrink-0" />
                        <span className="font-mono text-text font-medium truncate">
                          {targetWid}
                        </span>
                        <Badge
                          variant={perm.toUpperCase().includes('WRITE') ? 'primary' : 'default'}
                          size="sm"
                        >
                          {perm}
                        </Badge>
                      </div>

                      {exp && (
                        <div className="flex items-center gap-1 text-[11px] text-text-muted">
                          <ClockIcon size={12} />
                          <span>Expires: {new Date(exp).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeShare(share.id)}
                      loading={revokingId === share.id}
                      className="shrink-0 text-error hover:bg-error/10 h-7 px-2"
                      title="Revoke access"
                    >
                      <TrashIcon size={13} className="mr-1" />
                      Revoke
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
