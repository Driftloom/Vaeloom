'use client';

import React, { useMemo, useState } from 'react';
import { Badge, Button, ConfirmationDialog } from '@vaeloom/ui-kit';
import { type BuiltinMcpServer } from '@/lib/api-client';
import {
  builtinCommandLine,
  MCP_CATALOG_TEMPLATES,
  templateCommandLine,
  type McpCatalogTemplate,
} from './types';

export interface McpTemplateGalleryProps {
  builtinServers: BuiltinMcpServer[];
  installedNames: Set<string>;
  installedCommands: Set<string>;
  searchQuery?: string;
  onInstall: (
    item:
      | {
          kind: 'builtin';
          server: BuiltinMcpServer;
        }
      | {
          kind: 'template';
          template: McpCatalogTemplate;
        },
  ) => Promise<void>;
  installing?: boolean;
}

export const McpTemplateGallery: React.FC<McpTemplateGalleryProps> = ({
  builtinServers,
  installedNames,
  installedCommands,
  searchQuery = '',
  onInstall,
  installing = false,
}) => {
  const [pendingInstall, setPendingInstall] = useState<
    | { kind: 'builtin'; server: BuiltinMcpServer }
    | { kind: 'template'; template: McpCatalogTemplate }
    | null
  >(null);

  const effectiveQuery = searchQuery.trim().toLowerCase();

  const filteredBuiltins = useMemo(() => {
    if (!effectiveQuery) return builtinServers;
    return builtinServers.filter(
      (server) =>
        server.name.toLowerCase().includes(effectiveQuery) ||
        server.description.toLowerCase().includes(effectiveQuery) ||
        server.id.toLowerCase().includes(effectiveQuery),
    );
  }, [builtinServers, effectiveQuery]);

  const filteredTemplates = useMemo(() => {
    if (!effectiveQuery) return MCP_CATALOG_TEMPLATES;
    return MCP_CATALOG_TEMPLATES.filter(
      (template) =>
        template.name.toLowerCase().includes(effectiveQuery) ||
        template.description.toLowerCase().includes(effectiveQuery) ||
        template.category.toLowerCase().includes(effectiveQuery),
    );
  }, [effectiveQuery]);

  const handleConfirmInstall = async () => {
    if (!pendingInstall) return;
    try {
      await onInstall(pendingInstall);
      setPendingInstall(null);
    } catch {
      // Parent handles error logging and notifications
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2.5 border-b border-border bg-surface-elevated/70 shrink-0">
        <h2 className="text-xs font-semibold text-text font-sans tracking-tight">
          Verified Catalog
        </h2>
        <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
          Built-in definitions served by this API from{' '}
          <code className="font-mono">GET /connectors/mcp/builtin</code>. They run this
          deployment&apos;s own interpreter, so nothing is downloaded.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-2 pb-8 space-y-1.5">
        {filteredBuiltins.length === 0 ? (
          <p className="text-2xs text-text-muted px-2 py-3">
            The API returned no built-in MCP definitions.
          </p>
        ) : (
          filteredBuiltins.map((server) => {
            const isInstalled =
              installedNames.has(server.name.toLowerCase()) ||
              installedCommands.has(builtinCommandLine(server));
            return (
              <div
                key={server.id}
                className="p-3 rounded-lg border border-border bg-surface-elevated/40 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-text font-sans">{server.name}</span>
                    <Badge variant="mono" size="sm">
                      {server.transport}
                    </Badge>
                    {Array.isArray(server.tools) && server.tools.length > 0 && (
                      <Badge variant="default" size="sm">
                        {server.tools.length} declared tool
                        {server.tools.length === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary font-sans leading-relaxed mt-1 line-clamp-2">
                    {server.description}
                  </p>
                  <p className="text-2xs font-mono text-text-muted mt-1 break-all">
                    {builtinCommandLine(server)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isInstalled ? 'outline' : 'primary'}
                  disabled={isInstalled}
                  onClick={() => setPendingInstall({ kind: 'builtin', server })}
                >
                  {isInstalled ? 'Installed' : 'Add'}
                </Button>
              </div>
            );
          })
        )}

        <div className="px-1 pt-4">
          <h2 className="text-xs font-semibold text-text font-sans tracking-tight">
            Community templates (unverified)
          </h2>
          <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
            Third-party npm packages. The exact command is shown before anything is created, and the
            package is downloaded and executed on the machine that discovers tools. Vaeloom has not
            audited any of them.
          </p>
        </div>

        {filteredTemplates.map((template) => {
          const isInstalled = installedNames.has(template.name.toLowerCase());
          return (
            <div
              key={template.id}
              className="p-3 rounded-lg border border-border bg-surface-elevated/40 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-text font-sans">{template.name}</span>
                  {template.transports.map((transport) => (
                    <Badge key={transport} variant="mono" size="sm">
                      {transport}
                    </Badge>
                  ))}
                  {template.authType && (
                    <Badge variant="warning" size="sm">
                      needs {template.authType}
                    </Badge>
                  )}
                  <Badge variant="default" size="sm">
                    {template.category}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary font-sans leading-relaxed mt-1 line-clamp-2">
                  {template.description}
                </p>
                <p className="text-2xs font-mono text-text-muted mt-1 break-all">
                  {templateCommandLine(template)}
                </p>
              </div>
              <Button
                size="sm"
                variant={isInstalled ? 'outline' : 'secondary'}
                disabled={isInstalled}
                onClick={() => setPendingInstall({ kind: 'template', template })}
              >
                {isInstalled ? 'Installed' : 'Review'}
              </Button>
            </div>
          );
        })}
      </div>

      <ConfirmationDialog
        isOpen={pendingInstall !== null}
        onClose={() => {
          if (!installing) setPendingInstall(null);
        }}
        onConfirm={() => void handleConfirmInstall()}
        loading={installing}
        variant={pendingInstall?.kind === 'template' ? 'warning' : 'default'}
        title={
          pendingInstall
            ? pendingInstall.kind === 'builtin'
              ? `Add ${pendingInstall.server.name}?`
              : `Run third-party code: ${pendingInstall.template.name}?`
            : ''
        }
        message={
          pendingInstall
            ? pendingInstall.kind === 'builtin'
              ? `This registers the connector and later runs: ${builtinCommandLine(pendingInstall.server)}. The command comes from this API and uses its own interpreter; nothing is downloaded.`
              : `This registers the connector and later runs on this machine: ${templateCommandLine(pendingInstall.template)}.\n\nnpx downloads that package from the npm registry and executes it as a subprocess. Vaeloom has not audited it.${pendingInstall.template.credentialNote ? `\n\n${pendingInstall.template.credentialNote}` : ''}`
            : ''
        }
        confirmLabel={pendingInstall?.kind === 'template' ? 'Install anyway' : 'Add server'}
        cancelLabel="Cancel"
      />
    </div>
  );
};
