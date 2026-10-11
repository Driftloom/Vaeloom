'use client';

import React, { useState } from 'react';
import { Badge, Button, Spinner } from '@vaeloom/ui-kit';
import { type BuiltinMcpServer, type ConnectorItem, type McpToolInfo } from '@/lib/api-client';
import { McpServerCard } from './McpServerCard';
import {
  builtinCommandLine,
  safeStringify,
  type McpProbeResult,
  type McpToolCallResult,
} from './types';

export interface McpToolInspectPanelProps {
  selectedServer: ConnectorItem | null;
  serverTools: McpToolInfo[];
  loadingTools: boolean;
  probeCapabilityId: string | null;
  probing: boolean;
  probeResult: McpProbeResult | null;
  onProbe: () => Promise<void>;
  onSyncBridge: (server: ConnectorItem) => Promise<void>;
  onRefreshTools?: (serverId: string) => Promise<void>;
  onExecuteToolCall: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<{
    result: McpToolCallResult;
    latencyMs: number;
  }>;
  onDeleteServer?: (server: ConnectorItem) => Promise<void> | void;
  onTogglePause?: (server: ConnectorItem) => Promise<void> | void;
  builtinServers?: BuiltinMcpServer[];
  onAddBuiltin?: (server: BuiltinMcpServer) => void;
}

const PROBE_STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  connected: 'success',
  skipped: 'warning',
  timeout: 'error',
  error: 'error',
  request_failed: 'error',
};

export const McpToolInspectPanel: React.FC<McpToolInspectPanelProps> = ({
  selectedServer,
  serverTools,
  loadingTools,
  probeCapabilityId,
  probing,
  probeResult,
  onProbe,
  onSyncBridge,
  onExecuteToolCall,
  onDeleteServer,
  onTogglePause,
  builtinServers = [],
  onAddBuiltin,
}) => {
  const [testingTool, setTestingTool] = useState<McpToolInfo | null>(null);
  const [testArgsJson, setTestArgsJson] = useState('{}');
  const [testCalling, setTestCalling] = useState(false);
  const [testResult, setTestResult] = useState<McpToolCallResult | null>(null);
  const [testLatencyMs, setTestLatencyMs] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleRunTool = async () => {
    if (!testingTool) return;
    setTestCalling(true);
    setTestError(null);
    setTestResult(null);

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(testArgsJson || '{}') as Record<string, unknown>;
    } catch {
      setTestError('Arguments must be a valid JSON object.');
      setTestCalling(false);
      return;
    }

    try {
      const outcome = await onExecuteToolCall(testingTool.name, parsedArgs);
      setTestResult(outcome.result);
      setTestLatencyMs(outcome.latencyMs);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setTestCalling(false);
    }
  };

  if (!selectedServer) {
    return (
      <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="text-center py-6 space-y-2 border-b border-border">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans">
            Model Context Protocol (MCP v2) Runtime
          </h3>
          <p className="text-xs text-text-secondary max-w-lg mx-auto leading-relaxed font-sans">
            Connect external tools, local filesystems and databases to this workspace&apos;s agents
            over sandboxed stdio subprocesses or streamable-HTTP endpoints. Select a server to
            inspect it.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
            Built-in servers available in this workspace
          </h3>
          {builtinServers.length === 0 ? (
            <p className="text-xs text-text-muted">The API returned no built-in definitions.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {builtinServers.map((server) => (
                <div
                  key={server.id}
                  className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-text font-sans">
                        {server.name}
                      </span>
                      <Badge variant="mono" size="sm">
                        {server.transport}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {server.description}
                    </p>
                    <p className="text-2xs font-mono text-text-muted break-all">
                      {builtinCommandLine(server)}
                    </p>
                  </div>
                  {onAddBuiltin && (
                    <Button size="sm" variant="secondary" onClick={() => onAddBuiltin(server)}>
                      Add to workspace
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <McpServerCard
        server={selectedServer}
        variant="detail"
        toolCount={serverTools.length}
        onDelete={onDeleteServer}
        onTogglePause={onTogglePause}
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text border-b border-border pb-2">
          Endpoint probe
        </h3>
        <div className="p-3 rounded-lg border border-border bg-surface-elevated/40 space-y-3">
          {probeCapabilityId ? (
            <>
              <p className="text-xs text-text-secondary">
                Contacts the server for real: it validates the config, opens the transport, and runs
                one bounded <code className="font-mono">tools/list</code> round trip. It reports
                &quot;skipped&quot; and contacts nothing when no endpoint is configured.
              </p>
              <Button size="sm" loading={probing} onClick={() => void onProbe()}>
                Probe endpoint
              </Button>
            </>
          ) : (
            <p className="text-xs text-warning">
              The probe endpoint reads a workspace capability row, and this workspace has no{' '}
              <code className="font-mono">mcp</code> capability named{' '}
              <span className="font-mono">{selectedServer.name}</span>. Register one to enable a
              real probe for this connector.
            </p>
          )}

          {probeResult && (
            <div className="space-y-2 border-t border-border pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={PROBE_STATUS_TONE[probeResult.status] ?? 'default'} size="sm">
                  {probeResult.status}
                </Badge>
                <span className="text-2xs text-text-muted">
                  executed: {String(probeResult.executed)}
                </span>
                {probeResult.latencyMs !== null && (
                  <span className="text-2xs text-text-muted font-mono">
                    {probeResult.latencyMs}ms round trip
                  </span>
                )}
                {probeResult.transport && (
                  <Badge variant="mono" size="sm">
                    {probeResult.transport}
                  </Badge>
                )}
              </div>
              {probeResult.detail && (
                <p className="text-xs text-text-secondary">{probeResult.detail}</p>
              )}
              {probeResult.error && (
                <p role="alert" className="text-xs text-error">
                  {probeResult.error}
                </p>
              )}
              {probeResult.status === 'connected' && probeResult.toolsCount !== null && (
                <p className="text-xs text-text-secondary">
                  {probeResult.toolsCount} tool{probeResult.toolsCount === 1 ? '' : 's'} reported by
                  the server
                  {probeResult.tools.length > 0 ? ':' : ' (no names returned).'}
                </p>
              )}
              {probeResult.tools.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {probeResult.tools.map((tool) => (
                    <li key={tool}>
                      <Badge variant="mono" size="sm">
                        {tool}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2 gap-3">
          <h3 className="text-sm font-semibold text-text">
            Discovered Protocol Tools ({serverTools.length})
          </h3>
          <span className="text-2xs text-text-muted text-right">
            The tools endpoint declares no per-tool scope, so none is shown.
          </span>
        </div>

        {loadingTools ? (
          <div
            role="status"
            aria-label="Listing MCP tools"
            className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted"
          >
            <Spinner size="sm" />
            <span>Querying MCP tools/list protocol...</span>
          </div>
        ) : serverTools.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border bg-surface text-center space-y-2">
            <p className="text-xs font-medium text-text">No tools listed</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Either the server exposes none or the last{' '}
              <code className="font-mono">tools/list</code> call failed. Use &quot;Sync Bridge&quot;
              or &quot;Refresh Tools&quot; to ask again.
            </p>
            <Button size="sm" onClick={() => void onSyncBridge(selectedServer)} className="mt-1">
              Sync Bridge Now
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {serverTools.map((tool) => {
              const isTestingThis = testingTool?.name === tool.name;
              return (
                <div
                  key={tool.name}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isTestingThis
                      ? 'bg-primary/5 border-primary/50'
                      : 'bg-surface border-border hover:border-border-subtle'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-text">
                          {tool.name}
                        </span>
                        {tool.readOnlyHint ? (
                          <Badge variant="success" size="sm">
                            Read-Only
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Approval Gated
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-1.5 leading-relaxed font-sans">
                        {tool.description || 'The server sent no description for this tool.'}
                      </p>
                    </div>

                    <Button
                      variant={isTestingThis ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (isTestingThis) {
                          setTestingTool(null);
                        } else {
                          setTestingTool(tool);
                          setTestArgsJson('{}');
                          setTestResult(null);
                          setTestError(null);
                          setTestLatencyMs(null);
                        }
                      }}
                    >
                      {isTestingThis ? 'Close Test' : 'Test Tool'}
                    </Button>
                  </div>

                  {isTestingThis && (
                    <div className="mt-4 pt-3 border-t border-border space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-xs font-semibold text-text font-sans">
                          Tool Execution Playground
                        </span>
                        <code className="text-2xs font-mono text-text-muted break-all">
                          POST /connectors/{selectedServer.id}/mcp/call
                        </code>
                      </div>

                      <div>
                        <label
                          htmlFor="mcp-tool-args"
                          className="block text-2xs font-mono text-text-secondary mb-1"
                        >
                          Arguments (JSON)
                        </label>
                        <textarea
                          id="mcp-tool-args"
                          value={testArgsJson}
                          onChange={(event) => setTestArgsJson(event.target.value)}
                          rows={3}
                          spellCheck={false}
                          className="w-full p-2 rounded bg-surface-elevated border border-border font-mono text-xs text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent placeholder:text-text-muted"
                          placeholder='{ "query": "test" }'
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          loading={testCalling}
                          onClick={() => void handleRunTool()}
                        >
                          Run Tool
                        </Button>
                        {testLatencyMs !== null && (
                          <span className="text-2xs font-mono text-text-muted">
                            {testLatencyMs}ms (measured in this browser)
                          </span>
                        )}
                      </div>

                      {testError && (
                        <p
                          role="alert"
                          className="p-2.5 rounded bg-error/10 border border-error/30 text-xs font-mono text-error"
                        >
                          {testError}
                        </p>
                      )}

                      {testResult && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-2xs font-mono text-text-secondary">Result</span>
                            <Badge variant={testResult.isError ? 'error' : 'success'} size="sm">
                              {testResult.isError ? 'MCP error result' : 'returned'}
                            </Badge>
                          </div>
                          {testResult.tool && (
                            <p className="text-2xs font-mono text-text-muted break-all">
                              tool: {testResult.tool}
                            </p>
                          )}
                          {testResult.text !== null && (
                            <pre className="p-2.5 rounded bg-surface-elevated border border-border font-mono text-2xs text-text max-h-48 overflow-auto whitespace-pre-wrap break-all">
                              {testResult.text === '' ? '(empty text content)' : testResult.text}
                            </pre>
                          )}
                          {testResult.structured !== undefined && (
                            <div>
                              <span className="text-2xs font-mono text-text-secondary">
                                structuredContent
                                {testResult.structuredTruncated ? ' (truncated by the server)' : ''}
                              </span>
                              <pre className="p-2.5 rounded bg-surface-elevated border border-border font-mono text-2xs text-text max-h-48 overflow-auto">
                                {safeStringify(testResult.structured)}
                              </pre>
                            </div>
                          )}
                          {testResult.text === null && testResult.structured === undefined && (
                            <p className="text-2xs text-text-muted">
                              The server returned no content blocks.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
