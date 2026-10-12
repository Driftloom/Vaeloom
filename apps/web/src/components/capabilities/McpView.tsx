'use client';

import React from 'react';
import Link from 'next/link';
import { Button, EmptyState, Spinner, Tooltip } from '@vaeloom/ui-kit';
import {
  McpActivityLog,
  McpManifestTab,
  McpServerCard,
  McpTemplateGallery,
  McpToolInspectPanel,
  useMcpServers,
  type McpCatalogTemplate,
  type McpProbeResult,
  type McpToolCallResult,
} from './mcp';

interface McpViewProps {
  workspaceId: string;
  searchQuery?: string;
  onOpenCreateServer: () => void;
  onOpenImport: () => void;
}

export const McpView: React.FC<McpViewProps> = ({
  workspaceId,
  searchQuery = '',
  onOpenCreateServer,
  onOpenImport,
}) => {
  const {
    installedServers,
    builtinServers,
    loadingServers,
    loadError,
    selectedServerId,
    setSelectedServerId,
    selectedServer,
    probeCapabilityId,
    serverTools,
    loadingTools,
    syncingServerId,
    refreshingTools,
    activeSubTab,
    setActiveSubTab,
    mcpConfigText,
    setMcpConfigText,
    manifestOmissions,
    isEditorDirty,
    setIsEditorDirty,
    savingConfig,
    logFilter,
    setLogFilter,
    logs,
    setLogs,
    installing,
    probing,
    probeResult,
    filteredInstalled,
    installedNames,
    installedCommands,
    paneTitle,
    loadServerTools,
    handleSyncBridge,
    handleInstall,
    handleDeleteServer,
    handleTogglePauseServer,
    handleProbe,
    handleExecuteToolCall,
    handleSaveConfig,
    handleFormatConfig,
  } = useMcpServers({ workspaceId, searchQuery });

  // role="tablist" obliges the tab pattern: a single tab stop, arrow keys to
  // move between tabs, and panels linked back to their tab. The roles and
  // aria-selected were present but none of that was, so Tab walked both tabs,
  // arrows did nothing, and assistive tech had no panel to associate with
  // either tab.
  const handleSubTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = activeSubTab === 'inspector' ? 'manifest' : 'inspector';
    setActiveSubTab(next);
    document
      .getElementById(next === 'inspector' ? 'mcp-tab-inspector' : 'mcp-tab-manifest')
      ?.focus();
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 bg-background text-text overflow-hidden">
      {/* ── Left column: installed servers + catalogs ── */}
      <div className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0">
        <div className="border-b border-border flex flex-col shrink-0">
          <div className="px-4 py-2.5 border-b border-border bg-surface-elevated/70 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-text font-sans tracking-tight flex items-center gap-2">
              Servers
              <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-surface-elevated text-text-secondary border border-border">
                {installedServers.length}
              </span>
            </h2>
            <Button variant="ghost" size="sm" onClick={onOpenImport}>
              Import
            </Button>
          </div>

          <div className="p-3 space-y-2 max-h-[260px] overflow-y-auto">
            {loadingServers ? (
              <div
                role="status"
                aria-label="Loading MCP servers"
                className="py-4 flex items-center justify-center gap-2 text-xs text-text-muted"
              >
                <Spinner size="sm" />
                <span>Loading workspace servers...</span>
              </div>
            ) : filteredInstalled.length === 0 ? (
              <EmptyState
                title={
                  installedServers.length === 0 ? 'No MCP servers connected' : 'No servers match'
                }
                description={
                  installedServers.length === 0
                    ? 'Add a built-in server from the catalog below, or register a custom one.'
                    : 'Clear the search to see every server in this workspace.'
                }
                action={{ label: 'New server', onClick: onOpenCreateServer }}
              />
            ) : (
              filteredInstalled.map((server) => (
                <McpServerCard
                  key={server.id}
                  server={server}
                  variant="row"
                  isSelected={selectedServerId === server.id}
                  isSyncing={syncingServerId === server.id}
                  onSelect={() => {
                    setSelectedServerId(server.id);
                    setActiveSubTab('inspector');
                  }}
                  onDelete={handleDeleteServer}
                  onTogglePause={handleTogglePauseServer}
                />
              ))
            )}

            {loadError && (
              <p role="alert" className="text-2xs text-error px-1">
                The server list could not be read: {loadError}
              </p>
            )}
          </div>
        </div>

        <McpTemplateGallery
          builtinServers={builtinServers}
          installedNames={installedNames}
          installedCommands={installedCommands}
          searchQuery={searchQuery}
          onInstall={handleInstall}
          installing={installing}
        />
      </div>

      {/* ── Right column: inspector / manifest ── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text overflow-hidden">
        <div className="border-b border-border bg-surface px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div
            className="flex items-center gap-4 min-w-0"
            role="tablist"
            aria-label="MCP pane"
            onKeyDown={handleSubTabKeyDown}
          >
            <button
              type="button"
              role="tab"
              id="mcp-tab-inspector"
              aria-selected={activeSubTab === 'inspector'}
              aria-controls="mcp-panel-inspector"
              tabIndex={activeSubTab === 'inspector' ? 0 : -1}
              onClick={() => setActiveSubTab('inspector')}
              className={`text-xs font-sans font-semibold pb-1 border-b-2 transition-colors flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                activeSubTab === 'inspector'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              Inspector &amp; Tools
              {serverTools.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-2xs bg-primary/10 text-primary border border-primary/20">
                  {serverTools.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              id="mcp-tab-manifest"
              aria-selected={activeSubTab === 'manifest'}
              aria-controls="mcp-panel-manifest"
              tabIndex={activeSubTab === 'manifest' ? 0 : -1}
              onClick={() => {
                setActiveSubTab('manifest');
                if (!isEditorDirty) {
                  // Manifest was refreshed by hook on servers update
                }
              }}
              className={`text-xs font-sans font-semibold pb-1 border-b-2 transition-colors flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                activeSubTab === 'manifest'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              mcp.json Manifest
              <span className="text-2xs font-mono text-text-muted">Claude Desktop / Cursor</span>
            </button>
          </div>

          {activeSubTab === 'manifest' ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleFormatConfig}>
                Format
              </Button>
              <Button size="sm" loading={savingConfig} onClick={() => void handleSaveConfig()}>
                {savingConfig ? 'Applying...' : 'Apply to Workspace'}
              </Button>
            </div>
          ) : selectedServer ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/workspace/${workspaceId}/capabilities/mcp/${encodeURIComponent(selectedServer.id)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-elevated hover:bg-surface text-text font-medium text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <span>Open Full Page ↗</span>
              </Link>
              <Tooltip content="The server declared this many tools when it was last listed">
                <Button
                  variant="outline"
                  size="sm"
                  loading={refreshingTools}
                  onClick={() => void loadServerTools(selectedServer.id, true)}
                >
                  Refresh Tools
                </Button>
              </Tooltip>
              <Button
                size="sm"
                loading={syncingServerId === selectedServer.id}
                onClick={() => void handleSyncBridge(selectedServer)}
              >
                Sync Bridge
              </Button>
            </div>
          ) : null}
        </div>

        <h2 className="sr-only">{paneTitle}</h2>

        {activeSubTab === 'inspector' ? (
          <div
            role="tabpanel"
            id="mcp-panel-inspector"
            aria-labelledby="mcp-tab-inspector"
            className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain pb-16"
          >
            <McpToolInspectPanel
              selectedServer={selectedServer}
              serverTools={serverTools}
              loadingTools={loadingTools}
              probeCapabilityId={probeCapabilityId}
              probing={probing}
              probeResult={probeResult}
              onProbe={handleProbe}
              onSyncBridge={handleSyncBridge}
              onRefreshTools={loadServerTools}
              onExecuteToolCall={handleExecuteToolCall}
              onDeleteServer={handleDeleteServer}
              onTogglePause={handleTogglePauseServer}
              builtinServers={builtinServers}
              onAddBuiltin={(server) => void handleInstall({ kind: 'builtin', server })}
            />
          </div>
        ) : (
          <div role="tabpanel" id="mcp-panel-manifest" aria-labelledby="mcp-tab-manifest">
            <McpManifestTab
              configText={mcpConfigText}
              onChangeText={(val) => {
                setMcpConfigText(val);
                setIsEditorDirty(true);
              }}
              manifestOmissions={manifestOmissions}
            />
          </div>
        )}

        <McpActivityLog
          logs={logs}
          installedServers={installedServers}
          logFilter={logFilter}
          onLogFilterChange={setLogFilter}
          onClearLogs={() => setLogs([])}
        />
      </div>
    </div>
  );
};

export { MCP_CATALOG_TEMPLATES } from './mcp';
export type { McpCatalogTemplate, McpToolCallResult, McpProbeResult };
