'use client';

import React from 'react';
import { Button, Modal } from '@vaeloom/ui-kit';

export interface CustomProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
  customType: 'mcp' | 'rest' | 'graphql';
  onCustomTypeChange: (type: 'mcp' | 'rest' | 'graphql') => void;
  customName: string;
  onCustomNameChange: (name: string) => void;
  customUrl: string;
  onCustomUrlChange: (url: string) => void;
  customApiKey: string;
  onCustomApiKeyChange: (key: string) => void;
  customMcpTransport: 'stdio' | 'http';
  onCustomMcpTransportChange: (transport: 'stdio' | 'http') => void;
  customCommand: string;
  onCustomCommandChange: (command: string) => void;
  customArgs: string;
  onCustomArgsChange: (args: string) => void;
  submittingCustom: boolean;
  onSubmit: (event: React.FormEvent) => void;
}

export function CustomProtocolModal({
  isOpen,
  onClose,
  customType,
  onCustomTypeChange,
  customName,
  onCustomNameChange,
  customUrl,
  onCustomUrlChange,
  customApiKey,
  onCustomApiKeyChange,
  customMcpTransport,
  onCustomMcpTransportChange,
  customCommand,
  onCustomCommandChange,
  customArgs,
  onCustomArgsChange,
  submittingCustom,
  onSubmit,
}: CustomProtocolModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} title="Add custom connector" size="md">
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        <div role="group" aria-label="Connector protocol">
          <span className="block text-text-secondary mb-1 font-medium">Connector protocol</span>
          <div className="grid grid-cols-3 gap-2">
            {(['mcp', 'rest', 'graphql'] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={customType === type}
                onClick={() => onCustomTypeChange(type)}
                className={`py-1.5 px-2 rounded border text-center font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  customType === type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface text-text-secondary hover:text-text hover:bg-surface-hover'
                }`}
              >
                {type === 'mcp' ? 'MCP server' : type === 'rest' ? 'REST API' : 'GraphQL API'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="custom-connector-name"
            className="block text-text-secondary mb-1 font-medium"
          >
            Connector name
          </label>
          <input
            id="custom-connector-name"
            type="text"
            required
            value={customName}
            onChange={(event) => onCustomNameChange(event.target.value)}
            placeholder="Internal analytics MCP"
            className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        {customType === 'mcp' && (
          <>
            <fieldset>
              <legend className="block text-text-secondary mb-1 font-medium">MCP transport</legend>
              <div className="flex gap-3">
                {(
                  [
                    ['stdio', 'stdio (local process)'],
                    ['http', 'streamable HTTP (remote)'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5 cursor-pointer text-text">
                    <input
                      type="radio"
                      name="mcpTransport"
                      checked={customMcpTransport === value}
                      onChange={() => onCustomMcpTransportChange(value)}
                      className="accent-primary"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {customMcpTransport === 'stdio' ? (
              <>
                <div>
                  <label
                    htmlFor="custom-command"
                    className="block text-text-secondary mb-1 font-medium"
                  >
                    Executable to run
                  </label>
                  <input
                    id="custom-command"
                    type="text"
                    required
                    value={customCommand}
                    onChange={(event) => onCustomCommandChange(event.target.value)}
                    placeholder="npx"
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-args"
                    className="block text-text-secondary mb-1 font-medium"
                  >
                    Arguments (space separated)
                  </label>
                  <input
                    id="custom-args"
                    type="text"
                    value={customArgs}
                    onChange={(event) => onCustomArgsChange(event.target.value)}
                    placeholder="-y @modelcontextprotocol/server-postgres"
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
              </>
            ) : (
              <div>
                <label
                  htmlFor="custom-mcp-url"
                  className="block text-text-secondary mb-1 font-medium"
                >
                  Server URL (https)
                </label>
                <input
                  id="custom-mcp-url"
                  type="url"
                  required
                  value={customUrl}
                  onChange={(event) => onCustomUrlChange(event.target.value)}
                  placeholder="https://mcp.internal.company.com/sse"
                  className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>
            )}
          </>
        )}

        {(customType === 'rest' || customType === 'graphql') && (
          <>
            <div>
              <label
                htmlFor="custom-base-url"
                className="block text-text-secondary mb-1 font-medium"
              >
                Endpoint base URL
              </label>
              <input
                id="custom-base-url"
                type="url"
                required
                value={customUrl}
                onChange={(event) => onCustomUrlChange(event.target.value)}
                placeholder="https://api.company.com/v1"
                className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="custom-api-key"
                className="block text-text-secondary mb-1 font-medium"
              >
                API key or bearer token (optional)
              </label>
              <input
                id="custom-api-key"
                type="password"
                value={customApiKey}
                onChange={(event) => onCustomApiKeyChange(event.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submittingCustom}>
            Register Connector
          </Button>
        </div>
      </form>
    </Modal>
  );
}
