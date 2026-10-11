'use client';

import React from 'react';
import { Badge, Button, StatusDot, Tooltip } from '@vaeloom/ui-kit';
import { PlusIcon } from '@/lib/connectors-catalog';
import {
  type CatalogRow,
  type ConfiguredItem,
  CONFIGURED_STATUS_META,
  formatDate,
  rowActionCount,
  rowCategoryText,
  rowDescription,
  rowIcon,
  rowName,
  rowProtocol,
  rowScopes,
} from './types';

export interface CatalogCardProps {
  row: CatalogRow;
  connected: boolean;
  /** A capability that is part of the runtime and has no connector row. */
  builtIn: boolean;
  connectBusy: boolean;
  onSelect: () => void;
  onConnect: () => void;
}

export function CatalogCard({
  row,
  connected,
  builtIn,
  connectBusy,
  onSelect,
  onConnect,
}: CatalogCardProps) {
  const scopes = rowScopes(row);
  const actionCount = rowActionCount(row);

  return (
    <li className="group relative flex flex-col justify-between rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 shadow-xs hover:shadow-md">
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 w-full text-left p-4 pb-2 rounded-t-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <span className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center p-2 shrink-0 group-hover:border-primary/40 transition-colors">
            {rowIcon(row)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                {rowName(row)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="mono" size="sm">
                {rowProtocol(row)}
              </Badge>
              {row.kind === 'definition' && row.def.isTrending && (
                <Badge variant="warning" size="sm">
                  Trending
                </Badge>
              )}
              {row.kind === 'definition' && row.def.isNew && (
                <Badge variant="primary" size="sm">
                  New
                </Badge>
              )}
              {row.kind === 'app' && (
                <Badge variant="default" size="sm">
                  from Composio
                </Badge>
              )}
            </span>
          </span>
        </span>
        <span className="block text-xs text-text-secondary line-clamp-2 mt-2.5 leading-relaxed font-sans">
          {rowDescription(row)}
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border text-2xs">
        <span className="font-mono text-text-secondary truncate">
          {rowCategoryText(row) || 'Category not declared'}
        </span>
        {actionCount !== null ? (
          <span className="text-text-muted font-mono">
            {actionCount} action{actionCount === 1 ? '' : 's'} reported
          </span>
        ) : scopes.length > 0 ? (
          <span className="text-text-muted font-mono truncate max-w-[150px]">{scopes[0]}</span>
        ) : (
          <span className="text-text-muted">Scope not declared</span>
        )}
      </div>

      <div className="px-4 pb-3 flex items-center justify-end">
        {connected ? (
          <Tooltip content="A connector row for this service exists in this workspace">
            <Badge variant="success" size="sm">
              <StatusDot status="active" size="sm" />
              Connected
            </Badge>
          </Tooltip>
        ) : builtIn ? (
          <p className="text-2xs text-text-muted text-left">
            Part of the runtime. There is no connector row to connect.
          </p>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={connectBusy}
            onClick={onConnect}
            // Without this every card contributes a button named "Connect", which
            // is unusable with a screen reader once the list has more than one
            // row. The visible label stays "Connect".
            aria-label={`Connect ${rowName(row)}`}
            className="items-center"
          >
            <PlusIcon />
            Connect
          </Button>
        )}
      </div>
    </li>
  );
}

export interface InstalledCardProps {
  item: ConfiguredItem;
  isSyncing: boolean;
  isTesting: boolean;
  onSync: () => void;
  onTest: () => void;
  onInspectTools?: () => void;
  onDisconnect: () => void;
}

export function InstalledConnectorCard({
  item,
  isSyncing,
  isTesting,
  onSync,
  onTest,
  onInspectTools,
  onDisconnect,
}: InstalledCardProps) {
  const displayName = item.name?.trim() || item.provider?.toUpperCase() || 'Custom Connector';

  return (
    <li className="group relative flex flex-col justify-between rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 shadow-xs hover:shadow-md space-y-3.5 p-4">
      <div>
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
              {displayName}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="mono" size="sm">
                {item.type}
              </Badge>
            </div>
          </div>
          <Tooltip content={`Reported status: ${CONFIGURED_STATUS_META[item.status].label}`}>
            <Badge
              variant={
                item.status === 'active'
                  ? 'success'
                  : item.status === 'syncing'
                    ? 'warning'
                    : item.status === 'error'
                      ? 'error'
                      : 'default'
              }
              size="sm"
            >
              <StatusDot
                status={CONFIGURED_STATUS_META[item.status].dot}
                pulse={isSyncing}
                size="sm"
              />
              {CONFIGURED_STATUS_META[item.status].label}
            </Badge>
          </Tooltip>
        </div>

        <div className="flex items-center justify-between text-2xs text-text-muted font-mono pt-2">
          <span>Last synced</span>
          <span className="text-text-secondary">{formatDate(item.lastSync)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-border gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" loading={isSyncing} onClick={onSync}>
            Sync Now
          </Button>
          <Button variant="outline" size="sm" loading={isTesting} onClick={onTest}>
            Ping
          </Button>
          {item.type.includes('MCP') && onInspectTools && (
            <Button variant="outline" size="sm" onClick={onInspectTools}>
              Tools
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger/80"
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      </div>
    </li>
  );
}

export type ConnectorCardProps =
  ({ variant?: 'catalog' } & CatalogCardProps) | ({ variant: 'installed' } & InstalledCardProps);

export function ConnectorCard(props: ConnectorCardProps) {
  if (props.variant === 'installed') {
    return <InstalledConnectorCard {...props} />;
  }
  return <CatalogCard {...props} />;
}
