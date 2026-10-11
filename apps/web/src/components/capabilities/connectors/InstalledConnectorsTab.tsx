'use client';

import React from 'react';
import { Badge, Button, EmptyState } from '@vaeloom/ui-kit';
import { type ConfiguredItem } from './types';
import { InstalledConnectorCard } from './ConnectorCard';
import type { Connector } from '@vaeloom/shared-types';

export interface InstalledConnectorsTabProps {
  configuredItems: ConfiguredItem[];
  onBrowseDirectory: () => void;
  syncBusyId: string | null;
  busyAction: string | null;
  onSyncWorkspace: (connector: Connector) => void;
  onDynamicSync: (id: string) => void;
  onTestConnection: (id: string) => void;
  onInspectTools: (id: string, name: string) => void;
  onPendingDisconnect: (target: {
    id: string;
    name: string;
    isWorkspaceIntegration: boolean;
  }) => void;
}

export function InstalledConnectorsTab({
  configuredItems,
  onBrowseDirectory,
  syncBusyId,
  busyAction,
  onSyncWorkspace,
  onDynamicSync,
  onTestConnection,
  onInspectTools,
  onPendingDisconnect,
}: InstalledConnectorsTabProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-text font-sans flex items-center gap-2">
          Configured in this workspace
          <Badge variant="success" size="sm">
            {configuredItems.length} row{configuredItems.length === 1 ? '' : 's'}
          </Badge>
        </h3>
        <Button variant="ghost" size="sm" onClick={onBrowseDirectory}>
          Browse Directory
        </Button>
      </div>

      {configuredItems.length === 0 ? (
        <EmptyState
          title="No connectors configured"
          description="Nothing is registered in this workspace yet. Start from the directory, or build a custom protocol."
          action={{
            label: 'Discover connectors',
            onClick: onBrowseDirectory,
          }}
        />
      ) : (
        <ul role="list" className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
          {configuredItems.map((item) => {
            const isSyncing = syncBusyId === item.id || busyAction === `sync-${item.id}`;
            return (
              <InstalledConnectorCard
                key={item.id}
                item={item}
                isSyncing={isSyncing}
                isTesting={busyAction === `test-${item.id}`}
                onSync={() => {
                  if (item.isWorkspaceIntegration && item.originalConnector) {
                    onSyncWorkspace(item.originalConnector);
                  } else {
                    onDynamicSync(item.id);
                  }
                }}
                onTest={() => onTestConnection(item.id)}
                onInspectTools={
                  item.type.includes('MCP') ? () => onInspectTools(item.id, item.name) : undefined
                }
                onDisconnect={() =>
                  onPendingDisconnect({
                    id: item.id,
                    name: item.name,
                    isWorkspaceIntegration: item.isWorkspaceIntegration,
                  })
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
