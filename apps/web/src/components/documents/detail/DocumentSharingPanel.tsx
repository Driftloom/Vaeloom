'use client';

import React, { useMemo } from 'react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Panel,
  ShieldIcon,
  type ColumnDef,
} from '@vaeloom/ui-kit';
import { legacySharePermission, type DocumentShareResponse } from '@/lib/api-client';
import { formatDate } from '@/lib/document-format';
import { LoadablePanel } from './LoadablePanel';

export interface DocumentSharingPanelProps {
  shares: DocumentShareResponse[];
  sharesLoading: boolean;
  sharesError: string | null;
  onRetry: () => void;
  revokeBusyId: string | null;
  onOpenShareDialog: () => void;
  onRevokeShare: (shareId: string) => void;
}

export const DocumentSharingPanel: React.FC<DocumentSharingPanelProps> = ({
  shares,
  sharesLoading,
  sharesError,
  onRetry,
  revokeBusyId,
  onOpenShareDialog,
  onRevokeShare,
}) => {
  const shareColumns = useMemo<ColumnDef<DocumentShareResponse>[]>(
    () => [
      {
        key: 'targetWorkspaceId',
        header: 'Shared With',
        render: (_value, row) => (
          <code className="text-xs font-mono text-text bg-surface-100 px-1.5 py-0.5 rounded border border-border/50">
            {row.targetWorkspaceId}
          </code>
        ),
      },
      {
        key: 'permission',
        header: 'Permission',
        render: (_value, row) => {
          const perm = legacySharePermission(row.permission);
          return (
            <Badge variant={perm === 'write' ? 'primary' : 'default'} size="sm">
              {perm === 'write' ? 'Can Edit (Write)' : 'Read Only'}
            </Badge>
          );
        },
      },
      {
        key: 'expiresAt',
        header: 'Expires',
        render: (_value, row) => (
          <span className="text-xs text-text-muted">
            {row.expiresAt ? formatDate(row.expiresAt) : 'Never'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (_value, row) => (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={revokeBusyId === row.id}
              onClick={() => onRevokeShare(row.id)}
            >
              Revoke
            </Button>
          </div>
        ),
      },
    ],
    [revokeBusyId, onRevokeShare],
  );

  return (
    <div className="space-y-4">
      <Panel padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text">Workspace Access Controls</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Share this file across distinct organizational tenants with time-bound permissions.
            </p>
          </div>

          <Button type="button" variant="primary" size="sm" onClick={onOpenShareDialog}>
            Share Access
          </Button>
        </div>
      </Panel>

      <LoadablePanel
        loading={sharesLoading}
        error={sharesError}
        onRetry={onRetry}
        label="sharing information"
      >
        {shares.length === 0 ? (
          <EmptyState
            icon={<ShieldIcon size={24} />}
            title="Private document"
            description="This document has not been shared with any other workspaces."
            action={{
              label: 'Share with a workspace',
              onClick: onOpenShareDialog,
            }}
          />
        ) : (
          <DataTable<DocumentShareResponse>
            columns={shareColumns}
            data={shares}
            keyExtractor={(row) => row.id}
            emptyMessage="No shares to show"
            loading={false}
            skeletonRows={2}
          />
        )}
      </LoadablePanel>
    </div>
  );
};
