'use client';

import React from 'react';
import { Badge, Button, EmptyState, ErrorState, IconButton, StatusDot } from '@vaeloom/ui-kit';
import { PlusIcon } from '@/lib/connectors-catalog';
import type { BuiltinMcpServer, ConnectorItem } from '@/lib/api-client';
import { CONNECTOR_BADGE_VARIANT, CONNECTOR_DOT_STATUS, CONNECTOR_STATUS_LABEL } from './types';

export interface CustomProtocolsTabProps {
  customConnectors: ConnectorItem[];
  builtinServers: BuiltinMcpServer[];
  builtinError: string | null;
  dynamicError: string | null;
  busyAction: string | null;
  healthLoading: boolean;
  onRetryLoad: () => void;
  onOpenAddCustom: (type?: 'mcp' | 'rest' | 'graphql') => void;
  onConfigureBuiltin: (server: BuiltinMcpServer) => void;
  onTestConnection: (id: string) => void;
  onOpenHealthModal: (id: string) => void;
  onInspectTools: (id: string, name: string) => void;
  onPendingDisconnect: (target: {
    id: string;
    name: string;
    isWorkspaceIntegration: boolean;
  }) => void;
}

export function CustomProtocolsTab({
  customConnectors,
  builtinServers,
  builtinError,
  dynamicError,
  busyAction,
  healthLoading,
  onRetryLoad,
  onOpenAddCustom,
  onConfigureBuiltin,
  onTestConnection,
  onOpenHealthModal,
  onInspectTools,
  onPendingDisconnect,
}: CustomProtocolsTabProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-semibold text-text tracking-tight">
            Custom protocol builder
          </h3>
          <p className="text-xs text-text-secondary max-w-2xl mt-1 leading-relaxed">
            Register Model Context Protocol servers over stdio or streamable HTTP, plus enterprise
            REST and GraphQL endpoints. The command or URL you enter here is exactly what will be
            executed or contacted.
          </p>
        </div>
        <Button size="sm" onClick={() => onOpenAddCustom()}>
          <PlusIcon />
          Add Custom Connector
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(
          [
            {
              type: 'mcp' as const,
              title: 'Model Context Protocol (MCP)',
              body: 'Connect a local subprocess over stdio, or a remote streamable-HTTP endpoint. Tools are discovered from the server itself.',
            },
            {
              type: 'rest' as const,
              title: 'Enterprise REST API',
              body: 'Point agents at an internal HTTP API. A base URL is required; a key is optional.',
            },
            {
              type: 'graphql' as const,
              title: 'GraphQL endpoint',
              body: 'Point agents at a GraphQL endpoint by URL. Schemas are not introspected from here.',
            },
          ] as const
        ).map((card) => (
          <div
            key={card.type}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-text">{card.title}</h4>
              <p className="text-xs text-text-secondary leading-relaxed">{card.body}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenAddCustom(card.type)}>
              Add{' '}
              {card.type === 'mcp'
                ? 'MCP server'
                : card.type === 'rest'
                  ? 'REST connector'
                  : 'GraphQL endpoint'}
            </Button>
          </div>
        ))}
      </div>

      <section aria-labelledby="builtin-mcp-heading" className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-border pb-2 gap-3 flex-wrap">
          <div>
            <h3 id="builtin-mcp-heading" className="text-sm font-semibold text-text">
              Built-in MCP servers
            </h3>
            <p className="text-xs text-text-muted">
              Served by this API from <code className="font-mono">GET /connectors/mcp/builtin</code>
              . Each entry runs this deployment&apos;s own interpreter; nothing is downloaded.
            </p>
          </div>
          <span className="text-xs font-mono text-text-secondary">
            {builtinServers.length} declared
          </span>
        </div>

        {builtinError ? (
          <ErrorState
            title="Built-in catalog unavailable"
            message={builtinError}
            onRetry={onRetryLoad}
            actionText="Try again"
          />
        ) : builtinServers.length === 0 ? (
          <EmptyState
            title="No built-in servers declared"
            description="The API answered with an empty built-in MCP catalog."
          />
        ) : (
          <div
            role="table"
            aria-label="Built-in MCP servers"
            className="rounded-xl border border-border overflow-hidden"
          >
            <div role="rowgroup">
              <div
                role="row"
                className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2 bg-surface-elevated border-b border-border text-2xs font-mono uppercase tracking-wider text-text-muted"
              >
                <span role="columnheader">Server</span>
                <span role="columnheader">Transport</span>
                <span role="columnheader">Declared tools</span>
                <span role="columnheader" className="md:text-right">
                  Action
                </span>
              </div>
            </div>
            <div role="rowgroup">
              {builtinServers.map((server) => (
                <div
                  key={server.id}
                  role="row"
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2.5 border-b border-border-subtle last:border-b-0"
                >
                  <span role="cell" className="min-w-0">
                    <span className="block text-xs font-semibold text-text">{server.name}</span>
                    <span className="block text-2xs text-text-muted line-clamp-2">
                      {server.description}
                    </span>
                  </span>
                  <span role="cell">
                    <Badge variant="mono" size="sm">
                      {server.transport}
                    </Badge>
                  </span>
                  <span role="cell" className="text-2xs text-text-secondary">
                    {Array.isArray(server.tools) && server.tools.length > 0
                      ? server.tools.join(', ')
                      : 'None declared'}
                  </span>
                  <span role="cell" className="md:text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyAction === `composio-${server.id}`}
                      onClick={() => onConfigureBuiltin(server)}
                    >
                      Configure
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="custom-connectors-heading" className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 id="custom-connectors-heading" className="text-sm font-semibold text-text">
            Custom connectors in this workspace
          </h3>
          <span className="text-xs text-text-muted font-mono">
            {customConnectors.length} registered
          </span>
        </div>

        {dynamicError ? (
          <ErrorState
            title="Connector list unavailable"
            message={dynamicError}
            onRetry={onRetryLoad}
            actionText="Try again"
          />
        ) : customConnectors.length === 0 ? (
          <EmptyState
            title="No custom connectors yet"
            description="This workspace has no MCP, REST or GraphQL connector registered."
            action={{ label: 'Add the first one', onClick: () => onOpenAddCustom() }}
          />
        ) : (
          <div
            role="table"
            aria-label="Custom connectors in this workspace"
            className="rounded-xl border border-border overflow-hidden"
          >
            <div role="rowgroup">
              <div
                role="row"
                className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2 bg-surface-elevated border-b border-border text-2xs font-mono uppercase tracking-wider text-text-muted"
              >
                <span role="columnheader">Connector</span>
                <span role="columnheader">Protocol</span>
                <span role="columnheader">Status</span>
                <span role="columnheader" className="md:text-right">
                  Actions
                </span>
              </div>
            </div>
            <div role="rowgroup">
              {customConnectors.map((conn) => (
                <div
                  key={conn.id}
                  role="row"
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2.5 border-b border-border-subtle last:border-b-0"
                >
                  <span role="cell" className="min-w-0">
                    <span className="block text-xs font-semibold text-text">{conn.name}</span>
                    <span className="block text-2xs font-mono text-text-muted truncate">
                      {conn.id}
                    </span>
                  </span>
                  <span role="cell">
                    <Badge variant="mono" size="sm">
                      {conn.type.toUpperCase()}
                    </Badge>
                  </span>
                  <span role="cell">
                    <Badge variant={CONNECTOR_BADGE_VARIANT[conn.status]} size="sm">
                      <StatusDot status={CONNECTOR_DOT_STATUS[conn.status]} size="sm" />
                      {CONNECTOR_STATUS_LABEL[conn.status] ?? conn.status}
                    </Badge>
                  </span>
                  <span role="cell" className="md:text-right flex flex-wrap gap-1.5 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busyAction === `test-${conn.id}`}
                      onClick={() => onTestConnection(conn.id)}
                    >
                      Ping Health
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={healthLoading}
                      onClick={() => onOpenHealthModal(conn.id)}
                    >
                      Details
                    </Button>
                    {conn.type?.toLowerCase() === 'mcp' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onInspectTools(conn.id, conn.name)}
                      >
                        Tools
                      </Button>
                    )}
                    <IconButton
                      aria-label={`Remove ${conn.name}`}
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger/80"
                      onClick={() =>
                        onPendingDisconnect({
                          id: conn.id,
                          name: conn.name,
                          isWorkspaceIntegration: false,
                        })
                      }
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </IconButton>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
