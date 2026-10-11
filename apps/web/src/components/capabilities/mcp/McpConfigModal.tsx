'use client';

import React, { useState } from 'react';
import { Button, FormField, IconButton, Input, Select, Textarea } from '@vaeloom/ui-kit';
import { connectorsApi, type ConnectorItem } from '@/lib/api-client';
import { findPlaceholder } from './mcpManifest';

export interface McpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSuccess?: (server: ConnectorItem) => void;
  initialTransport?: 'stdio' | 'http';
}

interface EnvVarRow {
  id: string;
  key: string;
  value: string;
}

export const McpConfigModal: React.FC<McpConfigModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  onSuccess,
  initialTransport = 'stdio',
}) => {
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<'stdio' | 'http'>(initialTransport);
  const [command, setCommand] = useState('');
  const [argsText, setArgsText] = useState('');
  const [url, setUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [envVars, setEnvVars] = useState<EnvVarRow[]>([]);
  const [headers, setHeaders] = useState<EnvVarRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddEnvVar = () => {
    setEnvVars((prev) => [
      ...prev,
      { id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: '', value: '' },
    ]);
  };

  const handleRemoveEnvVar = (id: string) => {
    setEnvVars((prev) => prev.filter((row) => row.id !== id));
  };

  const handleUpdateEnvVar = (id: string, field: 'key' | 'value', value: string) => {
    setEnvVars((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleAddHeader = () => {
    setHeaders((prev) => [
      ...prev,
      { id: `hdr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: '', value: '' },
    ]);
  };

  const handleRemoveHeader = (id: string) => {
    setHeaders((prev) => prev.filter((row) => row.id !== id));
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value', value: string) => {
    setHeaders((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Server name is required.');
      return;
    }

    const config: Record<string, unknown> = { transport };

    if (transport === 'stdio') {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) {
        setErrorMessage('Command is required for stdio transport.');
        return;
      }
      config['command'] = trimmedCommand;
      const parsedArgs = argsText
        .split('\n')
        .flatMap((line) => line.split(/\s+/))
        .map((arg) => arg.trim())
        .filter(Boolean);
      if (parsedArgs.length > 0) {
        config['args'] = parsedArgs;
      }

      if (envVars.length > 0) {
        const envRecord: Record<string, string> = {};
        for (const { key, value } of envVars) {
          if (key.trim()) {
            envRecord[key.trim()] = value;
          }
        }
        if (Object.keys(envRecord).length > 0) {
          config['env'] = envRecord;
        }
      }
    } else {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setErrorMessage('Endpoint URL is required for HTTP transport.');
        return;
      }
      try {
        new URL(trimmedUrl);
      } catch {
        setErrorMessage(
          'Endpoint URL must be a valid absolute URL (e.g., https://example.com/sse).',
        );
        return;
      }
      config['url'] = trimmedUrl;
      if (authToken.trim()) {
        config['auth_token'] = authToken.trim();
      }

      if (headers.length > 0) {
        const headerRecord: Record<string, string> = {};
        for (const { key, value } of headers) {
          if (key.trim()) {
            headerRecord[key.trim()] = value;
          }
        }
        if (Object.keys(headerRecord).length > 0) {
          config['headers'] = headerRecord;
        }
      }
    }

    const placeholder = findPlaceholder(config, trimmedName);
    if (placeholder) {
      setErrorMessage(
        `"${placeholder}" contains an unresolved template placeholder \${...}. Provide a real value.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await connectorsApi.create({
        name: trimmedName,
        type: 'mcp',
        workspace_id: workspaceId,
        config,
      });

      try {
        await connectorsApi.mcp.sync(created.id, workspaceId);
      } catch {
        // bridge sync failure doesn't block server creation
      }

      onSuccess?.(created);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create MCP server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-config-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs"
    >
      <div className="w-full max-w-xl rounded-2xl bg-surface border border-border shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-surface-elevated/70 flex items-center justify-between">
          <div>
            <h2 id="mcp-config-modal-title" className="text-base font-semibold text-text font-sans">
              Configure MCP Server
            </h2>
            <p className="text-2xs text-text-muted mt-0.5">
              Register an external Model Context Protocol server in this workspace.
            </p>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close configuration modal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </IconButton>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-error/10 border border-error/30 text-xs font-sans text-error"
            >
              {errorMessage}
            </div>
          )}

          <FormField label="Server Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., local-filesystem, sqlite-db"
              required
            />
          </FormField>

          <FormField label="Transport Protocol">
            <Select
              value={transport}
              onChange={(val: string) => setTransport(val as 'stdio' | 'http')}
              options={[
                { value: 'stdio', label: 'Standard I/O Subprocess (stdio)' },
                { value: 'http', label: 'Streamable HTTP / SSE Endpoint (http)' },
              ]}
            />
          </FormField>

          {transport === 'stdio' ? (
            <>
              <FormField
                label="Executable Command"
                required
                hint="The binary or interpreter to launch (e.g., npx, python3, node)"
              >
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g., npx, python3"
                  required
                />
              </FormField>

              <FormField
                label="Command Arguments"
                hint="Arguments passed to the command, separated by spaces or newlines"
              >
                <Textarea
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem ./data"
                  rows={2}
                />
              </FormField>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">Environment Variables</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddEnvVar}>
                    Add Variable
                  </Button>
                </div>
                {envVars.length === 0 ? (
                  <p className="text-2xs text-text-muted italic">
                    No environment variables configured.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {envVars.map((env) => (
                      <div key={env.id} className="flex items-center gap-2">
                        <Input
                          placeholder="KEY"
                          value={env.key}
                          onChange={(e) => handleUpdateEnvVar(env.id, 'key', e.target.value)}
                          className="w-1/3"
                        />
                        <Input
                          placeholder="VALUE"
                          value={env.value}
                          onChange={(e) => handleUpdateEnvVar(env.id, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEnvVar(env.id)}
                          aria-label="Remove variable"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <FormField
                label="Endpoint URL"
                required
                hint="URL of the streamable MCP server or SSE gateway"
              >
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mcp.internal.example/sse"
                  required
                />
              </FormField>

              <FormField label="Authentication Token" hint="Optional bearer or API token">
                <Input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="secret token"
                />
              </FormField>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">Custom HTTP Headers</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddHeader}>
                    Add Header
                  </Button>
                </div>
                {headers.length === 0 ? (
                  <p className="text-2xs text-text-muted italic">No custom headers configured.</p>
                ) : (
                  <div className="space-y-2">
                    {headers.map((hdr) => (
                      <div key={hdr.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Header-Name"
                          value={hdr.key}
                          onChange={(e) => handleUpdateHeader(hdr.id, 'key', e.target.value)}
                          className="w-1/3"
                        />
                        <Input
                          placeholder="Value"
                          value={hdr.value}
                          onChange={(e) => handleUpdateHeader(hdr.id, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveHeader(hdr.id)}
                          aria-label="Remove header"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Create Server
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
