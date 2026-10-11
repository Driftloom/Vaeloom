'use client';

import React from 'react';
import { Badge, Button, ConfirmationDialog, EmptyState, Modal, Spinner } from '@vaeloom/ui-kit';
import type { ConnectorProvider } from '@vaeloom/shared-types';
import type { ConnectorHealthResponse, McpToolInfo } from '@/lib/api-client';
import { PROVIDER_META, formatDate } from './types';

export interface ConnectorModalsProps {
  pendingProvider: ConnectorProvider | null;
  onClosePendingProvider: () => void;
  onExecuteConnect: (provider: ConnectorProvider) => void;
  busyAction: string | null;

  healthTarget: ConnectorHealthResponse | null;
  healthLoading: boolean;
  onCloseHealthTarget: () => void;

  toolsModalTarget: { id: string; name: string } | null;
  toolsList: McpToolInfo[];
  toolsLoading: boolean;
  onCloseToolsModal: () => void;

  pendingDisconnect: { id: string; name: string; isWorkspaceIntegration: boolean } | null;
  onClosePendingDisconnect: () => void;
  onConfirmDisconnect: () => void;
}

export function ConnectorModals({
  pendingProvider,
  onClosePendingProvider,
  onExecuteConnect,
  busyAction,
  healthTarget,
  healthLoading,
  onCloseHealthTarget,
  toolsModalTarget,
  toolsList,
  toolsLoading,
  onCloseToolsModal,
  pendingDisconnect,
  onClosePendingDisconnect,
  onConfirmDisconnect,
}: ConnectorModalsProps) {
  return (
    <>
      {/* ── OAuth confirmation ─────────────────────────────────────────────── */}
      {pendingProvider && (
        <Modal
          isOpen
          onClose={onClosePendingProvider}
          title={`Connect ${PROVIDER_META[pendingProvider]?.name ?? pendingProvider}`}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-secondary">
              {PROVIDER_META[pendingProvider]?.intent ??
                'Authorizing this connector lets Vaeloom agents read the data you grant, and nothing more.'}
            </p>
            <div className="bg-surface-elevated p-2.5 rounded border border-border">
              <span className="text-2xs font-semibold text-text block mb-1">Scopes</span>
              <p className="text-2xs text-text-muted">
                Not known ahead of time. The provider&apos;s own consent screen decides which scopes
                are requested, and this client has not read its app registration. Read the consent
                screen before approving.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={onClosePendingProvider}>
                Cancel
              </Button>
              <Button
                size="sm"
                loading={busyAction === `connect-${pendingProvider}`}
                onClick={() => onExecuteConnect(pendingProvider)}
              >
                Continue to OAuth
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Health details ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={healthLoading || healthTarget !== null}
        onClose={onCloseHealthTarget}
        title="Connector health"
        size="sm"
      >
        {healthLoading ? (
          <div
            role="status"
            aria-label="Reading connector health"
            className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted"
          >
            <Spinner size="sm" />
            <span>Reading GET /connectors/&#123;id&#125;/health...</span>
          </div>
        ) : healthTarget ? (
          <dl className="space-y-2 text-xs">
            {(
              [
                ['Connector', healthTarget.name],
                ['ID', healthTarget.connectorId],
                ['Protocol', healthTarget.type],
                ['Status', healthTarget.status],
                ['Last sync', formatDate(healthTarget.lastSyncedAt)],
                ['Auth', healthTarget.authState],
                ['Connectivity', healthTarget.connectivity],
                ['Details', healthTarget.details],
              ] as const
            ).map(([term, value]) => (
              <div
                key={term}
                className="grid grid-cols-3 gap-2 border-b border-border-subtle pb-1.5"
              >
                <dt className="text-text-muted">{term}</dt>
                <dd className="col-span-2 font-mono text-text break-all">{value}</dd>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={onCloseHealthTarget}>
                Close
              </Button>
            </div>
          </dl>
        ) : null}
      </Modal>

      {/* ── MCP tool inspector ─────────────────────────────────────────────── */}
      {toolsModalTarget && (
        <Modal
          isOpen
          onClose={onCloseToolsModal}
          title={`MCP tools: ${toolsModalTarget.name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {toolsLoading ? (
              <div
                role="status"
                aria-label="Listing MCP tools"
                className="flex items-center justify-center gap-2 py-8 text-text-muted"
              >
                <Spinner size="sm" />
                <span>Listing MCP tools...</span>
              </div>
            ) : toolsList.length === 0 ? (
              <EmptyState
                title="No tools listed"
                description="The server returned an empty tool list, or the last tools/list call failed."
              />
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {toolsList.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3 rounded-lg bg-surface-elevated border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-primary">{tool.name}</span>
                      <Badge variant={tool.readOnlyHint ? 'success' : 'warning'} size="sm">
                        {tool.readOnlyHint ? 'Read-only' : 'Approval gated'}
                      </Badge>
                    </div>
                    <p className="text-text-secondary">
                      {tool.description || 'The server sent no description for this tool.'}
                    </p>
                    {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                      <pre className="p-2 rounded bg-surface border border-border text-2xs text-text-muted font-mono overflow-x-auto">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={onCloseToolsModal}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Disconnect confirmation dialog ─────────────────────────────────── */}
      <ConfirmationDialog
        isOpen={pendingDisconnect !== null}
        onClose={onClosePendingDisconnect}
        onConfirm={onConfirmDisconnect}
        loading={busyAction === `disconnect-${pendingDisconnect?.id ?? ''}`}
        variant="destructive"
        title="Disconnect connector?"
        message={
          pendingDisconnect
            ? `${pendingDisconnect.name} will be unlinked from this workspace. Any agent bridged to its data stops receiving it, and credentials held for it are removed with the row.`
            : ''
        }
        confirmLabel="Disconnect"
        cancelLabel="Keep it"
      />
    </>
  );
}
