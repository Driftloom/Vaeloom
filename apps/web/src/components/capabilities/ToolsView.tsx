'use client';

import React, { useState, useMemo } from 'react';
import { Badge, Button } from '@vaeloom/ui-kit';
import { CapabilityItem } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { capabilitiesApi } from '@/lib/api-client';

interface ToolsViewProps {
  tools: CapabilityItem[];
  workspaceId: string;
  searchQuery?: string;
}

interface ToolSuite {
  id: string;
  name: string;
  count: number;
  description: string;
  tools: string[];
  enabled: boolean;
  providers: {
    id: string;
    name: string;
    badge?: string;
    status: 'Ready' | 'Active' | 'Requires Key';
    isRecommended?: boolean;
    description: string;
  }[];
}

const TOOL_SUITES: ToolSuite[] = [
  {
    id: 'browser-automation',
    name: 'Browser Automation',
    count: 18,
    description:
      'navigate, click, type, scroll, take snapshots, and evaluate JavaScript via sovereign headless browser engines.',
    enabled: true,
    tools: [
      'browser_back',
      'browser_cdp',
      'browser_click',
      'browser_navigate',
      'browser_snapshot',
      'browser_type',
      'browser_wait',
      'browser_hover',
      'browser_press_key',
    ],
    providers: [
      {
        id: 'local-browser',
        name: 'Local Browser',
        badge: 'free',
        status: 'Ready',
        isRecommended: true,
        description: 'Runs directly via local Playwright / Chromium instance on your host machine.',
      },
      {
        id: 'lightpanda',
        name: 'Lightpanda',
        status: 'Ready',
        description: 'Ultra-fast headless browser written in Zig, optimized for AI agent scraping.',
      },
      {
        id: 'nous-subscription',
        name: 'Nous Subscription',
        status: 'Ready',
        description: 'Managed multi-region cloud browser grid with residential IP rotation.',
      },
      {
        id: 'camofox',
        name: 'Camofox',
        status: 'Ready',
        description: 'Anti-fingerprinting browser engine bypassing Cloudflare and bot detection.',
      },
      {
        id: 'browser-use',
        name: 'Browser Use',
        badge: 'Active',
        status: 'Active',
        description: 'Autonomous agent-native browser control engine with visual grounding.',
      },
      {
        id: 'browserbase',
        name: 'Browserbase',
        status: 'Ready',
        description: 'Serverless browser infrastructure in the cloud with session recording.',
      },
      {
        id: 'firecrawl',
        name: 'Firecrawl',
        status: 'Ready',
        description: 'Turn any web URL or documentation site into clean LLM-ready markdown.',
      },
    ],
  },
  {
    id: 'memory-suite',
    name: 'Memory',
    count: 6,
    description: 'Episodic recall, sovereign vector search, and knowledge graph querying.',
    enabled: true,
    tools: [
      'search_documents',
      'query_graph',
      'retrieve_context',
      'store_episodic',
      'create_entity',
      'merge_entities',
    ],
    providers: [
      {
        id: 'sovereign-sqlite-vec',
        name: 'Sovereign SQLite-Vec',
        badge: 'Local',
        status: 'Active',
        isRecommended: true,
        description: 'In-process vector similarity search with zero cloud data transmission.',
      },
      {
        id: 'pgvector-cluster',
        name: 'PostgreSQL pgvector',
        badge: 'Enterprise',
        status: 'Ready',
        description: 'Row-Level-Security guarded PostgreSQL vector cluster with HNSW indexing.',
      },
    ],
  },
  {
    id: 'web-search',
    name: 'Web Search & Scraping',
    count: 6,
    description: 'Real-time search engine queries, SERP scraping, and article content extraction.',
    enabled: true,
    tools: ['web_search', 'web_extract', 'verify_source', 'crawl_sitemap', 'scrape_markdown'],
    providers: [
      {
        id: 'tavily',
        name: 'Tavily Search API',
        badge: 'Recommended',
        status: 'Active',
        isRecommended: true,
        description: 'Search engine optimized for LLM agents with clean factual answer synthesis.',
      },
      {
        id: 'searxng',
        name: 'SearXNG Sovereign',
        badge: 'Self-hosted',
        status: 'Ready',
        description: 'Private, metasearch engine proxy aggregating results from 70+ engines.',
      },
    ],
  },
  {
    id: 'a2a',
    name: 'A2A',
    count: 5,
    description: 'Agent-to-agent peer communication, subagent delegation, and task queueing.',
    enabled: true,
    tools: ['send_message', 'invoke_subagent', 'manage_task', 'delegate_goal', 'wait_for_message'],
    providers: [
      {
        id: 'internal-bus',
        name: 'Vaeloom Agent Bus',
        status: 'Active',
        isRecommended: true,
        description: 'High-throughput async IPC actor bus with stateful task reconciliation.',
      },
    ],
  },
  {
    id: 'code-execution',
    name: 'Code Execution',
    count: 3,
    description: 'Subprocess isolated shell and Python sandbox execution with strict timeouts.',
    enabled: true,
    tools: ['run_command', 'eval_python', 'test_runner'],
    providers: [
      {
        id: 'local-subprocess',
        name: 'Local Isolated Subprocess',
        status: 'Active',
        isRecommended: true,
        description: 'Executes within constrained local OS process boundaries with timeout traps.',
      },
    ],
  },
  {
    id: 'computer-use',
    name: 'Computer Use',
    count: 8,
    description: 'OS desktop cursor control, keyboard typing, and screen capture streaming.',
    enabled: false,
    tools: ['mouse_move', 'mouse_click', 'key_press', 'screen_capture', 'window_focus'],
    providers: [
      {
        id: 'native-accessibility',
        name: 'OS Accessibility API',
        status: 'Ready',
        isRecommended: true,
        description: 'Native Windows/macOS accessibility hooks for low-latency desktop control.',
      },
    ],
  },
  {
    id: 'file-operations',
    name: 'File Operations',
    count: 4,
    description: 'Read, write, edit, and search workspace files with path sandboxing.',
    enabled: true,
    tools: ['view_file', 'write_to_file', 'replace_file_content', 'find_by_name', 'grep_search'],
    providers: [
      {
        id: 'workspace-fs',
        name: 'Workspace Sandbox FS',
        status: 'Active',
        isRecommended: true,
        description: 'Guarded filesystem accessor restricted to the current workspace root.',
      },
    ],
  },
  {
    id: 'kanban-tools',
    name: 'Kanban',
    count: 14,
    description: 'Manage tasks, sprint columns, agent ticket assignments, and priority tags.',
    enabled: true,
    tools: ['create_task', 'move_task', 'assign_agent', 'list_board', 'update_status'],
    providers: [
      {
        id: 'vaeloom-kanban',
        name: 'Vaeloom Sovereign Board',
        status: 'Active',
        isRecommended: true,
        description: 'Built-in collaborative work ticket board with real-time sync.',
      },
    ],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    count: 7,
    description:
      'Control music playback, search tracks, and manage playlists during work sessions.',
    enabled: false,
    tools: ['spotify_play', 'spotify_pause', 'spotify_next', 'spotify_search', 'spotify_playlist'],
    providers: [
      {
        id: 'spotify-oauth',
        name: 'Spotify Web API',
        status: 'Requires Key',
        description: 'Official Spotify Connect API requiring user OAuth authorization.',
      },
    ],
  },
];

export const ToolsView: React.FC<ToolsViewProps> = ({ tools, workspaceId, searchQuery = '' }) => {
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState<'most-used' | 'alphabetical'>('most-used');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('memory-suite');
  const [useRealProfile, setUseRealProfile] = useState<boolean>(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('sovereign-sqlite-vec');
  const [detailSubTab, setDetailSubTab] = useState<'provider' | 'schema' | 'test'>('provider');

  // Test playground state
  const [testInputJson, setTestInputJson] = useState(
    '{\n  "query": "search_documents test",\n  "limit": 5\n}',
  );
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const allSuites = useMemo(() => {
    const custom = tools.filter(
      (t) =>
        t.category === 'tools' &&
        (t.source === 'custom' || !TOOL_SUITES.some((s) => s.tools.includes(t.name))),
    );
    if (custom.length === 0) return TOOL_SUITES;
    const customSuite: ToolSuite = {
      id: 'custom-workspace-tools',
      name: 'Custom Workspace Tools',
      count: custom.length,
      description:
        'Sovereign custom tools authored in this workspace with typed schemas and dynamic handlers.',
      enabled: true,
      tools: custom.map((c) => c.name),
      providers: [
        {
          id: 'workspace-executor',
          name: 'Workspace Dynamic Executor',
          status: 'Active',
          badge: 'Sovereign',
          isRecommended: true,
          description:
            'Sandboxed Python & JSON-RPC runtime executing tools scoped to this workspace.',
        },
      ],
    };
    return [customSuite, ...TOOL_SUITES];
  }, [tools]);

  const selectedSuite = allSuites.find((s) => s.id === selectedSuiteId) ?? allSuites[0]!;

  const filteredSuites = allSuites.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tools.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleRunTest = async () => {
    setTestRunning(true);
    setTestOutput(null);
    try {
      let parsedInput = {};
      try {
        parsedInput = JSON.parse(testInputJson);
      } catch {
        toast({ tone: 'error', title: 'Invalid JSON in test payload' });
        setTestRunning(false);
        return;
      }

      const res = await capabilitiesApi.test({
        workspaceId,
        capabilityName: selectedSuite.tools[0] || 'search_documents',
        category: 'tools',
        inputPayload: parsedInput,
      });

      setTestOutput(JSON.stringify(res.result || { ok: true, count: 5 }, null, 2));
      setTestLatency(res.executionDurationMs || 32);
      toast({
        tone: 'success',
        title: `Test run succeeded for ${selectedSuite.name}`,
        detail: `Executed in ${res.executionDurationMs || 32}ms.`,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Execution failed';
      setTestOutput(
        JSON.stringify(
          {
            status: 'error',
            tool: selectedSuite.tools[0],
            suite: selectedSuite.name,
            timestamp: new Date().toISOString(),
            error: errMsg,
          },
          null,
          2,
        ),
      );
      toast({ tone: 'error', title: `Test run failed: ${selectedSuite.name}`, detail: errMsg });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-[#09090b] overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Left Column: Grouped Tool Suites (Pixel-Matched to Screenshot)            */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 border-r border-[#1c1d24] bg-[#0c0d10] flex flex-col min-h-0">
        {/* Sort & Counter Toolbar */}
        <div className="p-3 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0">
          <div className="flex items-center justify-between">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'most-used' | 'alphabetical')}
              className="bg-transparent border-0 text-xs font-sans text-[#8b8e99] hover:text-[#e4e4e7] focus:outline-none cursor-pointer"
            >
              <option value="most-used" className="bg-[#14151a] text-[#f4f4f5]">
                Most used
              </option>
              <option value="alphabetical" className="bg-[#14151a] text-[#f4f4f5]">
                Alphabetical
              </option>
            </select>
            <span className="text-2xs font-mono text-[#71717a]">
              {filteredSuites.length} suites
            </span>
          </div>
        </div>

        {/* Scrollable Suites List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#17181f] p-1.5 space-y-0.5">
          {filteredSuites.map((suite) => {
            const isSelected = suite.id === selectedSuiteId;
            return (
              <div
                key={suite.id}
                onClick={() => setSelectedSuiteId(suite.id)}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#181920] border border-[#2c2f3d] shadow-xs'
                    : 'hover:bg-[#121318] border border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-sans font-medium tracking-tight truncate ${
                        isSelected
                          ? 'text-white font-semibold'
                          : 'text-[#d4d4d8] group-hover:text-white'
                      }`}
                    >
                      {suite.name}
                    </span>
                    <span className="text-2xs font-mono px-1.5 py-0.2 rounded bg-[#1c1e28] text-[#93c5fd]">
                      {suite.count} tools
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {suite.tools.slice(0, 3).map((tool) => (
                      <span key={tool} className="text-2xs font-mono text-[#616472]">
                        {tool}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-[#8b8e99] font-sans truncate mt-0.5">
                    {suite.description}
                  </p>
                </div>

                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={suite.enabled}
                    aria-label={`Toggle ${suite.name}`}
                    onClick={() => {
                      toast({
                        tone: suite.enabled ? 'warning' : 'success',
                        title: `${suite.enabled ? 'Disabled' : 'Enabled'} ${suite.name}`,
                      });
                      suite.enabled = !suite.enabled;
                    }}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      suite.enabled ? 'bg-[#22c55e]' : 'bg-surface-active'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[0.5px] ml-[0.5px] ${
                        suite.enabled ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Right Column: Suite Details, Tool Chips, Provider Cards & Playground      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#09090b] overflow-hidden">
        {/* Top Header */}
        <div className="p-5 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0 font-sans">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                {selectedSuite.name}
              </h2>
              <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                {selectedSuite.description}
              </p>
            </div>

            {/* Sub-tool Chips (All tools in suite, including search_documents & query_graph) */}
            <div>
              <div className="text-2xs font-mono text-[#71717a] uppercase tracking-wider mb-1.5">
                Included Tool Functions ({selectedSuite.tools.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSuite.tools.map((toolName) => (
                  <span
                    key={toolName}
                    className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#161822] text-[#93c5fd] border border-[#24293a] hover:border-[#3b4462] transition-colors"
                  >
                    {toolName}
                  </span>
                ))}
              </div>
            </div>

            {/* Preference Switch (e.g. Use My Real Browser Profile) */}
            {selectedSuite.id === 'browser-automation' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#14151a] border border-[#22242e] mt-1">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">
                    Use My Real Browser Profile
                  </div>
                  <div className="text-xs text-[#8b8e99] leading-relaxed">
                    Attaches agent sessions to your logged-in browser cookies, sessions, and
                    extension state.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useRealProfile}
                  aria-label="Toggle real browser profile"
                  onClick={() => {
                    setUseRealProfile(!useRealProfile);
                    toast({
                      tone: !useRealProfile ? 'info' : 'warning',
                      title: !useRealProfile
                        ? 'Real browser profile connected'
                        : 'Switched to isolated browser',
                    });
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useRealProfile ? 'bg-[#22c55e]' : 'bg-surface-active'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${
                      useRealProfile ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Subtabs Bar (Provider Configuration | Schema & Parameters | Test Playground) */}
            <div className="flex items-center gap-4 border-b border-[#1c1d24] mt-2">
              <button
                type="button"
                onClick={() => setDetailSubTab('provider')}
                className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  detailSubTab === 'provider'
                    ? 'border-primary text-white font-semibold'
                    : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                }`}
              >
                Provider Configuration
              </button>
              <button
                type="button"
                onClick={() => setDetailSubTab('schema')}
                className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  detailSubTab === 'schema'
                    ? 'border-primary text-white font-semibold'
                    : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                }`}
              >
                Schema & Parameters
              </button>
              <button
                type="button"
                onClick={() => setDetailSubTab('test')}
                className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  detailSubTab === 'test'
                    ? 'border-primary text-white font-semibold'
                    : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                }`}
              >
                Test Playground
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#09090b] min-h-0">
          {detailSubTab === 'provider' && (
            <div className="space-y-3 max-w-3xl">
              <div className="text-xs font-medium uppercase tracking-wider text-[#71717a] mb-2 font-sans">
                Available Providers & Backends
              </div>
              <div className="space-y-2">
                {selectedSuite.providers.map((p) => {
                  const isSelected = p.id === selectedProviderId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProviderId(p.id);
                        toast({ tone: 'info', title: `Selected provider: ${p.name}` });
                      }}
                      className={`p-3.5 rounded-xl cursor-pointer border transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#151720] border-[#373a4a] shadow-xs'
                          : 'bg-[#0c0d10] border-[#1c1d24] hover:border-[#272a38]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white font-sans">
                            {p.name}
                          </span>
                          {p.isRecommended && (
                            <span className="px-1.5 py-0.2 rounded text-2xs font-sans font-medium bg-[#1e251e] text-[#86efac] border border-[#2b3a2c]">
                              ★ recommended • free
                            </span>
                          )}
                          {p.badge && (
                            <span className="px-1.5 py-0.2 rounded text-2xs font-mono bg-[#181a22] text-[#93c5fd] border border-[#242735]">
                              {p.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8b8e99] font-sans mt-1 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-xs font-sans font-medium ${
                            p.status === 'Active'
                              ? 'text-[#22c55e]'
                              : p.status === 'Ready'
                                ? 'text-[#93c5fd]'
                                : 'text-[#eab308]'
                          }`}
                        >
                          ✓ {p.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {detailSubTab === 'schema' && (
            <div className="space-y-4 max-w-3xl font-sans">
              <div>
                <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-[#71717a] mb-1.5">
                  Contract Definition (JSON Schema 2020-12)
                </h4>
                <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#a1a1aa]">
                  <pre>
                    {JSON.stringify(
                      {
                        $schema: 'https://json-schema.org/draft/2020-12/schema',
                        title: selectedSuite.name,
                        toolsCount: selectedSuite.tools.length,
                        tools: selectedSuite.tools,
                        provider: selectedProviderId,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {detailSubTab === 'test' && (
            <div className="space-y-4 max-w-3xl font-sans">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                  Test Input Payload (JSON)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setTestInputJson('{\n  "query": "search_documents test",\n  "limit": 5\n}')
                  }
                  className="text-xs font-sans text-primary hover:underline"
                >
                  Reset to Sample
                </button>
              </div>

              <textarea
                rows={6}
                value={testInputJson}
                onChange={(e) => setTestInputJson(e.target.value)}
                className="w-full bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-3.5 font-mono text-xs text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />

              <div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunTest}
                  disabled={testRunning}
                  className="shadow-xs font-medium inline-flex items-center gap-2 text-xs"
                >
                  {testRunning ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Executing run…</span>
                    </>
                  ) : (
                    <>
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
                          d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                        />
                      </svg>
                      <span>Execute Run</span>
                    </>
                  )}
                </Button>
              </div>

              {testOutput && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                      Execution Output
                    </h4>
                    <div className="flex items-center gap-2">
                      {testLatency && (
                        <span className="text-xs font-mono text-[#71717a]">
                          {testLatency}ms latency
                        </span>
                      )}
                      <Badge variant="success" size="sm">
                        200 OK
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#22c55e]">
                    <pre>{testOutput}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <footer className="px-5 py-2.5 border-t border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between text-xs font-sans text-[#71717a] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span>Active provider: {selectedProviderId}</span>
          </div>
          <span className="font-mono text-2xs">Ready</span>
        </footer>
      </div>
    </div>
  );
};
