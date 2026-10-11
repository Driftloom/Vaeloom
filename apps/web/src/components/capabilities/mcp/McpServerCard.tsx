'use client';

import React, { useState } from 'react';
import { Badge, Button, ConfirmationDialog, IconButton, StatusDot, Tooltip } from '@vaeloom/ui-kit';
import { type ConnectorItem } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/capabilities-data';
import { isStdioConfig, SERVER_STATUS_META } from './types';

export interface McpServerCardProps {
  server: ConnectorItem;
  variant?: 'row' | 'detail';
  isSelected?: boolean;
  isSyncing?: boolean;
  toolCount?: number;
  onSelect?: () => void;
  onDelete?: (server: ConnectorItem) => Promise<void> | void;
  onTogglePause?: (server: ConnectorItem) => Promise<void> | void;
}

export const McpServerCard: React.FC<McpServerCardProps> = ({
  server,
  variant = 'row',
  isSelected = false,
  isSyncing = false,
  toolCount,
  onSelect,
  onDelete,
  onTogglePause,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pausing, setPausing] = useState(false);

  const isStdio = isStdioConfig(server.config);
  const statusMeta = SERVER_STATUS_META[server.status] ?? SERVER_STATUS_META.error;
  const isPaused = server.status === 'paused';

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(server);
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePause = async () => {
    if (!onTogglePause) return;
    setPausing(true);
    try {
      await onTogglePause(server);
    } finally {
      setPausing(false);
    }
  };

  if (variant === 'detail') {
    return (
      <>
        <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-text font-mono flex items-center gap-2 flex-wrap">
                {server.name}
                <Badge variant="mono" size="sm">
                  {String(server.config?.['transport'] ?? 'unspecified')}
                </Badge>
                <Badge
                  variant={
                    statusMeta.dot === 'error'
                      ? 'error'
                      : statusMeta.dot === 'warning'
                        ? 'warning'
                        : statusMeta.dot === 'active'
                          ? 'success'
                          : 'default'
                  }
                  size="sm"
                >
                  {statusMeta.label}
                </Badge>
                {typeof toolCount === 'number' && (
                  <Badge variant="default" size="sm">
                    {toolCount} tool{toolCount === 1 ? '' : 's'}
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-text-muted mt-1 font-mono">
                ID {server.id} &middot; last sync {formatRelativeTime(server.lastSyncedAt ?? null)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onTogglePause && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={pausing}
                  onClick={() => void handleTogglePause()}
                >
                  {isPaused ? 'Resume Server' : 'Pause Server'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                Disconnect Server
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-elevated border border-border font-mono text-xs text-text space-y-1 break-all">
            {server.config?.['command'] ? (
              <div>
                <span className="text-text-muted">command: </span>
                <span className="text-primary font-medium">
                  {String(server.config['command'])}
                </span>{' '}
                <span className="text-text-secondary">
                  {Array.isArray(server.config['args']) ? server.config['args'].join(' ') : ''}
                </span>
              </div>
            ) : server.config?.['url'] ? (
              <div>
                <span className="text-text-muted">url: </span>
                <span className="text-primary font-medium">{String(server.config['url'])}</span>
              </div>
            ) : (
              <div className="text-text-muted">
                This connector has no command or URL, so nothing can be contacted.
              </div>
            )}
          </div>
        </div>

        <ConfirmationDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={() => void handleDelete()}
          loading={deleting}
          variant="destructive"
          title="Remove MCP server?"
          message={`${server.name} will be removed from this workspace. Any agent that was bridged to its tools loses them, and the server is not contacted again.`}
          confirmLabel="Remove server"
          cancelLabel="Keep it"
        />
      </>
    );
  }

  // Row variant (used in left sidebar list)
  return (
    <>
      <div
        className={`group flex items-center justify-between gap-2 p-1.5 pl-2.5 rounded-lg border transition-colors ${
          isSelected
            ? 'bg-primary/10 border-primary/40'
            : 'bg-surface-elevated border-border hover:border-border-subtle hover:bg-surface-hover'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-current={isSelected ? 'true' : undefined}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Tooltip content={`Status: ${isSyncing ? 'syncing' : statusMeta.label}`}>
            <StatusDot
              status={isSyncing ? 'warning' : statusMeta.dot}
              pulse={isSyncing}
              size="sm"
            />
          </Tooltip>
          <span className="text-xs font-mono font-medium text-text truncate">{server.name}</span>
          <span className="px-1.5 py-0.2 rounded text-2xs font-mono bg-surface text-text-secondary border border-border">
            {isStdio ? 'stdio' : 'http'}
          </span>
          <span className="ml-auto text-2xs font-sans text-text-muted">
            {isSyncing ? 'syncing' : statusMeta.label}
          </span>
        </button>

        <div className="flex items-center gap-1">
          {onTogglePause && (
            <IconButton
              aria-label={isPaused ? `Resume ${server.name}` : `Pause ${server.name}`}
              variant="ghost"
              size="sm"
              onClick={() => void handleTogglePause()}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-text-muted hover:text-text transition-opacity"
            >
              {isPaused ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </IconButton>
          )}

          <IconButton
            aria-label={`Delete ${server.name}`}
            variant="ghost"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-error transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </IconButton>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        variant="destructive"
        title="Remove MCP server?"
        message={`${server.name} will be removed from this workspace. Any agent that was bridged to its tools loses them, and the server is not contacted again.`}
        confirmLabel="Remove server"
        cancelLabel="Keep it"
      />
    </>
  );
};
