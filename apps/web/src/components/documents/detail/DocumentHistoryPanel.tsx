'use client';

import React from 'react';
import { Button, ClockIcon, EmptyState, Panel } from '@vaeloom/ui-kit';
import type { DocumentAction } from '@/lib/api-client';
import { formatDateTime } from './formatDateTime';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { LoadablePanel } from './LoadablePanel';

export interface DocumentHistoryPanelProps {
  actions: DocumentAction[];
  historyLoading: boolean;
  historyError: string | null;
  onRetry: () => void;
  undoBusyId: string | null;
  onUndoPrompt: (actionId: string) => void;
}

export const DocumentHistoryPanel: React.FC<DocumentHistoryPanelProps> = ({
  actions,
  historyLoading,
  historyError,
  onRetry,
  undoBusyId,
  onUndoPrompt,
}) => {
  return (
    <div className="space-y-4">
      <Panel padding="sm">
        <h2 className="text-sm font-semibold text-text">Audit Trail &amp; Action History</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Reversible forensic log of modifications, renames, and workspace archival events.
        </p>
      </Panel>

      <LoadablePanel
        loading={historyLoading}
        error={historyError}
        onRetry={onRetry}
        label="activity history"
      >
        {actions.length === 0 ? (
          <EmptyState
            icon={<ClockIcon size={24} />}
            title="No recorded changes"
            description="Nothing has been modified, renamed or archived on this document."
          />
        ) : (
          <div className="space-y-3">
            {actions.map((act) => {
              const oldPath = act.oldPath;
              const newPath = act.newPath;
              const undone = Boolean(act.undoneAt);
              const isRename = act.actionType === 'document_rename' && oldPath && newPath;

              return (
                <Panel key={act.id} padding="sm" className={undone ? 'opacity-60' : ''}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-text">
                        {isRename
                          ? `Renamed ${oldPath} to ${newPath}`
                          : act.actionType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {formatDateTime(act.createdAt)}
                        {' · '}
                        {undone ? (
                          <span className="text-warning font-medium">Reverted / Undone</span>
                        ) : (
                          <span className="text-success font-medium">Active</span>
                        )}
                      </p>
                    </div>

                    {!undone && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={undoBusyId === act.id}
                        onClick={() => onUndoPrompt(act.id)}
                      >
                        Undo Action
                      </Button>
                    )}
                  </div>

                  {isRename && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                      <DiffViewer oldText={oldPath} newText={newPath} />
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </LoadablePanel>
    </div>
  );
};
