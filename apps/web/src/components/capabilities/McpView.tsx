'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/shared/Toast';

interface McpViewProps {
  onOpenCreateServer: () => void;
  onOpenImport: () => void;
}

interface McpCatalogServer {
  id: string;
  name: string;
  transports: ('http' | 'stdio')[];
  authType?: string;
  description: string;
  defaultConfig: Record<string, unknown>;
}

const MCP_CATALOG_SERVERS: McpCatalogServer[] = [
  {
    id: 'airtable',
    name: 'Airtable',
    transports: ['http'],
    authType: 'OAuth',
    description:
      'Query Airtable databases, schema definitions, and table records directly in agent loops.',
    defaultConfig: {
      type: 'http',
      url: 'https://api.airtable.com/v0/mcp',
      auth: 'oauth2',
    },
  },
  {
    id: 'algolia',
    name: 'Algolia',
    transports: ['http'],
    authType: 'OAuth',
    description: 'Search and query Algolia indices, facets, and customer search telemetry.',
    defaultConfig: {
      type: 'http',
      url: 'https://mcp.algolia.com/v1',
      auth: 'oauth2',
    },
  },
  {
    id: 'alltrails',
    name: 'Alltrails',
    transports: ['http'],
    description: 'Explore trails, elevation maps, and curated national park route metadata.',
    defaultConfig: {
      type: 'http',
      url: 'https://mcp.alltrails.com',
    },
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    transports: ['http'],
    authType: 'OAuth',
    description:
      'User behavioral event analytics, conversion cohorts, and retention funnel queries.',
    defaultConfig: {
      type: 'http',
      url: 'https://analytics.amplitude.com/mcp',
      auth: 'oauth2',
    },
  },
  {
    id: 'asana',
    name: 'Asana',
    transports: ['http'],
    authType: 'OAuth',
    description: 'Work graph management: projects, tasks, custom fields, and workspace members.',
    defaultConfig: {
      type: 'http',
      url: 'https://app.asana.com/api/1.0/mcp',
      auth: 'oauth2',
    },
  },
  {
    id: 'atlassian',
    name: 'Atlassian',
    transports: ['http'],
    authType: 'OAuth',
    description: 'Jira issues, agile boards, and Confluence enterprise knowledge documentation.',
    defaultConfig: {
      type: 'http',
      url: 'https://api.atlassian.com/mcp/v1',
      auth: 'oauth2',
    },
  },
  {
    id: 'attio',
    name: 'Attio',
    transports: ['http'],
    authType: 'OAuth',
    description:
      'Next-generation relationship CRM data, company records, and deal stage timelines.',
    defaultConfig: {
      type: 'http',
      url: 'https://api.attio.com/mcp',
      auth: 'oauth2',
    },
  },
  {
    id: 'aws-knowledge',
    name: 'AWS-Knowledge',
    transports: ['stdio'],
    description:
      'Amazon Bedrock sovereign knowledge bases, OpenSearch vector indexes, and S3 retrieval.',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws-kb'],
    },
  },
  {
    id: 'betterstack',
    name: 'Betterstack',
    transports: ['http'],
    description: 'Uptime heartbeat monitors, live status page incidents, and distributed traces.',
    defaultConfig: {
      type: 'http',
      url: 'https://betterstack.com/api/v2/mcp',
    },
  },
];

const INITIAL_MCP_JSON = `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "./data"
      ]
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "\${GITHUB_TOKEN}"
      }
    }
  }
}`;

export const McpView: React.FC<McpViewProps> = ({ onOpenCreateServer, onOpenImport }) => {
  const { toast } = useToast();
  const [mcpConfigText, setMcpConfigText] = useState(INITIAL_MCP_JSON);
  const [installedServers, setInstalledServers] = useState<string[]>(['filesystem', 'github']);
  const [logFilter, setLogFilter] = useState('all');
  const [logs, setLogs] = useState<string[]>([
    '[mcp.discovery] Initialized Model Context Protocol client v2.1.0 (Python 3.12 bridge)',
    '[filesystem] stdio transport spawned (PID 4892) -> registered 4 tools: read_file, write_file, list_dir, move_file',
    '[github] stdio transport spawned (PID 4893) -> authenticated via token -> registered 12 tools',
    '[ready] Sovereign IPC pipe active. 16 tools exposed to Agent Orchestrator.',
  ]);

  const handleInstallCatalogServer = (server: McpCatalogServer) => {
    if (installedServers.includes(server.id)) {
      toast({ tone: 'info', title: `${server.name} is already installed` });
      return;
    }

    try {
      const parsed = JSON.parse(mcpConfigText);
      if (!parsed.mcpServers) parsed.mcpServers = {};
      parsed.mcpServers[server.id] = server.defaultConfig;
      const formatted = JSON.stringify(parsed, null, 2);
      setMcpConfigText(formatted);
      setInstalledServers((prev) => [...prev, server.id]);
      setLogs((prev) => [
        ...prev,
        `[mcp.catalog] Installed ${server.name} -> added to mcp.json`,
        `[${server.id}] Handshake queued for next session restart`,
      ]);
      toast({
        tone: 'success',
        title: `Installed ${server.name}`,
        detail: 'Server definition appended to mcp.json configuration.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Failed to update mcp.json',
        detail: 'Check for JSON syntax errors before installing.',
      });
    }
  };

  const handleSaveConfig = () => {
    try {
      JSON.parse(mcpConfigText);
      toast({
        tone: 'success',
        title: 'Saved mcp.json',
        detail: 'MCP server manifest updated. Changes will take effect in new agent sessions.',
      });
      setLogs((prev) => [
        ...prev,
        `[mcp.config] User saved mcp.json at ${new Date().toLocaleTimeString()} -> parsed 0 errors`,
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      toast({
        tone: 'error',
        title: 'JSON Syntax Error',
        detail: msg,
      });
    }
  };

  const handleFormatConfig = () => {
    try {
      const parsed = JSON.parse(mcpConfigText);
      setMcpConfigText(JSON.stringify(parsed, null, 2));
      toast({ tone: 'info', title: 'Formatted mcp.json' });
    } catch {
      toast({ tone: 'error', title: 'Cannot format: Invalid JSON syntax' });
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-[#09090b] overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Left Column: Servers + Catalog (Pixel-Matched to Screenshot)             */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 border-r border-[#1c1d24] bg-[#0c0d10] flex flex-col min-h-0">
        {/* Section 1: Servers */}
        <div className="border-b border-[#1c1d24] flex flex-col shrink-0">
          <div className="px-4 py-2.5 border-b border-[#1c1d24] bg-[#101116] flex items-center justify-between">
            <span className="text-xs font-semibold text-white font-sans tracking-tight">
              Servers
            </span>
            <button
              type="button"
              onClick={onOpenImport}
              className="inline-flex items-center gap-1 text-xs font-sans font-medium text-[#8b8e99] hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <span>Import</span>
            </button>
          </div>

          {/* Active Configured Servers or Empty State */}
          <div className="p-3 space-y-2">
            {installedServers.map((serverName) => (
              <div
                key={serverName}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#14151a] border border-[#22242e] hover:border-[#2f3240] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                  <span className="text-xs font-mono font-medium text-white truncate">
                    {serverName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#1c1e28] text-[#93c5fd] border border-[#272b3b]">
                    stdio
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-sans text-[#71717a]">connected</span>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={onOpenCreateServer}
              className="w-full py-2 px-3 rounded-lg border border-dashed border-[#262835] hover:border-[#3b3e52] text-xs font-sans font-medium text-[#8b8e99] hover:text-white flex items-center justify-center gap-1.5 transition-colors bg-[#111217]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <span>New server</span>
            </button>
          </div>
        </div>

        {/* Section 2: Catalog (1-click installable servers) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-[#1c1d24] bg-[#101116] flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-white font-sans tracking-tight">
              Catalog
            </span>
            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded-full bg-[#181a22] text-[#8b8e99] border border-[#252734]">
              {MCP_CATALOG_SERVERS.length} available
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#17181f] p-2 space-y-1">
            {MCP_CATALOG_SERVERS.map((server) => {
              const isInstalled = installedServers.includes(server.id);
              return (
                <div
                  key={server.id}
                  className="p-3 rounded-lg hover:bg-[#121319] transition-colors flex items-start justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-white font-sans">
                        {server.name}
                      </span>
                      {server.transports.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#181a22] text-[#8b8e99] border border-[#242633]"
                        >
                          {t}
                        </span>
                      ))}
                      {server.authType && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#1b2233] text-[#93c5fd] border border-[#25324c]">
                          {server.authType}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8b8e99] font-sans leading-relaxed mt-1 line-clamp-2">
                      {server.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isInstalled}
                    onClick={() => handleInstallCatalogServer(server)}
                    className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors shrink-0 ${
                      isInstalled
                        ? 'bg-[#181a22] text-[#52525b] border border-[#232530] cursor-default'
                        : 'bg-[#1a1c25] hover:bg-[#232634] text-white border border-[#2d3040] shadow-xs'
                    }`}
                  >
                    {isInstalled ? 'Installed' : 'Install'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Right Column: mcp.json Editor + Terminal Console Logs                     */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
        {/* Top Half: mcp.json Live Editor */}
        <div className="flex-1 flex flex-col min-h-[300px] border-b border-[#1c1d24]">
          {/* Header */}
          <div className="px-4 py-2 border-b border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[#8b8e99]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                />
              </svg>
              <span className="text-xs font-mono font-medium text-white">mcp.json</span>
              <span className="text-[10px] font-mono text-[#71717a]">
                (~/.config/vaeloom/mcp.json)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFormatConfig}
                title="Format JSON"
                className="px-2 py-0.5 rounded text-xs font-mono text-[#8b8e99] hover:text-white bg-[#14151a] border border-[#232530] hover:bg-[#1a1c24] transition-colors"
              >
                {`{}`}
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-3 py-1 rounded bg-[#22c55e] hover:bg-[#16a34a] text-xs font-sans font-medium text-black transition-colors shadow-xs"
              >
                Save
              </button>
            </div>
          </div>

          {/* Editor Area with Line Numbers */}
          <div className="flex-1 flex overflow-hidden bg-[#09090b] font-mono text-xs">
            {/* Line numbers gutter */}
            <div className="w-10 py-3 bg-[#0a0b0e] border-r border-[#171820] text-right pr-2 text-[#4b4e5c] select-none text-[11px] leading-5 shrink-0">
              {mcpConfigText.split('\n').map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              value={mcpConfigText}
              onChange={(e) => setMcpConfigText(e.target.value)}
              spellCheck={false}
              className="flex-1 p-3 bg-transparent text-[#e4e4e7] focus:outline-none resize-none leading-5 overflow-auto selection:bg-[#28324f]"
            />
          </div>
        </div>

        {/* Bottom Half: Execution Console Logs */}
        <div className="h-[240px] flex flex-col shrink-0 bg-[#07080a]">
          {/* Console Header */}
          <div className="px-4 py-2 border-b border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5 text-[#22c55e]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 6v12A2.25 2.25 0 004.5 18.25z"
                />
              </svg>
              <span className="text-xs font-sans font-medium text-white">Console & Logs</span>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="bg-[#14151a] border border-[#23242e] rounded px-2 py-0.5 text-[11px] font-sans text-[#a1a1aa] focus:outline-none cursor-pointer"
              >
                <option value="all">All servers (stdio, agent)</option>
                <option value="filesystem">filesystem</option>
                <option value="github">github</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-[11px] font-sans text-[#71717a] hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Console Output Window */}
          <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-5 space-y-1">
            {logs.length === 0 ? (
              <div className="text-[#52525b] italic">No output yet.</div>
            ) : (
              logs.map((log, index) => {
                const isError = log.includes('error') || log.includes('ERR');
                const isSuccess =
                  log.includes('registered') || log.includes('active') || log.includes('Ready');
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-2 ${
                      isError ? 'text-[#ef4444]' : isSuccess ? 'text-[#86efac]' : 'text-[#a1a1aa]'
                    }`}
                  >
                    <span className="text-[#4b4e5c] select-none">{'>'}</span>
                    <span className="break-all">{log}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
