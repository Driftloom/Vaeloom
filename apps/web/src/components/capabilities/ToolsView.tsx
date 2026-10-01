'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Switch,
  Tabs,
  TabPanel,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import { CapabilityItem } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { capabilitiesApi } from '@/lib/api-client';
import { TOOL_DEFINITIONS_CATALOG, type ToolDefinitionItem } from '@/lib/tool-definitions-catalog';

export type ToolSort = 'most-used' | 'alphabetical';

export interface ToolsViewProps {
  tools: CapabilityItem[];
  workspaceId: string;
  searchQuery?: string;
  /**
   * Lifted so the page can own one sorter for the whole workbench. Optional
   * because the page does not pass it yet; when absent the control drives local
   * state so the header is never a dead select. When the page starts passing
   * these, the local state is bypassed entirely rather than shadowing it.
   */
  sortBy?: ToolSort;
  onSortChange?: (sort: ToolSort) => void;
}

type DetailSubTab = 'contract' | 'schema' | 'validate';

/**
 * One row in the suite list.
 *
 * `definition` is only present when the tool exists in the real tool-definition
 * catalog. A workspace tool with no catalog entry gets `definition: null` and is
 * rendered as an explicit "no server definition" state — the previous version
 * substituted a `default_tool` literal, which presented placeholder data under a
 * real tool's name.
 */
interface ToolRow {
  name: string;
  definition: ToolDefinitionItem | null;
  workspaceItem: CapabilityItem | null;
  requiredScope: string | null;
  approvalGated: boolean | null;
}

interface ToolSuite {
  id: string;
  name: string;
  description: string;
  origin: 'built-in' | 'workspace';
  rows: ToolRow[];
}

const SUITE_KEY_PREFIX = 'vaeloom.tools.suites.';

function suiteStorageKey(workspaceId: string): string {
  return `${SUITE_KEY_PREFIX}${workspaceId}`;
}

function readSuiteState(workspaceId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(suiteStorageKey(workspaceId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeSuiteState(workspaceId: string, state: Record<string, boolean>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(suiteStorageKey(workspaceId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function formatSuiteName(suiteId: string): string {
  return suiteId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const SUITE_ICONS: Record<string, string> = {
  'browser-automation':
    'M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  'memory-graph': 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  'web-search': 'M21 21l-4.35-4.35',
  'agent-bus': 'M5 8v3a2 2 0 002 2h10a2 2 0 002-2V8M12 13v3',
  'code-exec':
    'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'computer-use': 'M2 3h20v14H2zM8 21h8m-4-4v4',
  'file-operations': 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  'kanban-workflow': 'M9 3v18M15 3v18M3 3h18v18H3z',
  'spotify-media': 'M8 11.5a6 6 0 018 0m-9 3a8 8 0 0110 0m-11 3a10 10 0 0112 0',
};

function SuiteIcon({ suiteId, className = 'w-4 h-4' }: { suiteId: string; className?: string }) {
  const circle =
    suiteId === 'browser-automation' || suiteId === 'spotify-media' || suiteId === 'web-search';
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      {circle && <circle cx="12" cy="12" r="10" />}
      {suiteId === 'kanban-workflow' && <rect x="3" y="3" width="18" height="18" rx="2" />}
      {suiteId === 'computer-use' && <rect x="2" y="3" width="20" height="14" rx="2" />}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={SUITE_ICONS[suiteId] ?? 'M12 4v16M4 12h16'}
      />
    </svg>
  );
}

const CUSTOM_SUITE_ID = 'workspace-tools';

function buildRow(
  name: string,
  definition: ToolDefinitionItem | null,
  item: CapabilityItem | null,
): ToolRow {
  return {
    name,
    definition,
    workspaceItem: item,
    requiredScope: definition?.requiredScope ?? item?.requiredScope ?? null,
    approvalGated: definition ? definition.approvalGated : null,
  };
}

export const ToolsView: React.FC<ToolsViewProps> = ({
  tools,
  workspaceId,
  searchQuery = '',
  sortBy: sortByProp,
  onSortChange,
}) => {
  const { toast } = useToast();

  const [localSortBy, setLocalSortBy] = useState<ToolSort>('most-used');
  const sortBy = sortByProp ?? localSortBy;
  const handleSortChange = useCallback(
    (next: ToolSort) => {
      if (onSortChange) onSortChange(next);
      else setLocalSortBy(next);
    },
    [onSortChange],
  );

  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('memory-graph');
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('contract');

  const [suiteState, setSuiteState] = useState<Record<string, boolean>>({});

  const [testInputJson, setTestInputJson] = useState('{}');
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testExecuted, setTestExecuted] = useState<boolean | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testValidationErrors, setTestValidationErrors] = useState<string[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    setSuiteState(readSuiteState(workspaceId));
  }, [workspaceId]);

  /**
   * Suites are derived from the real tool-definition catalog plus whatever this
   * workspace has registered. The previous module-level `TOOL_SUITES` table also
   * carried a `providers` array whose `status`, `latencySla` and `storageMode`
   * were literals; no provider registry exists on the server, so there is
   * nothing to derive them from and they are gone rather than relabelled.
   */
  const suites = useMemo<ToolSuite[]>(() => {
    const builtIn: ToolSuite[] = Object.entries(TOOL_DEFINITIONS_CATALOG)
      .filter(([suiteId]) => suiteId !== 'custom-workspace')
      .map(([suiteId, catalog]) => ({
        id: suiteId,
        name: formatSuiteName(suiteId),
        description: catalog.description,
        origin: 'built-in' as const,
        rows: catalog.tools.map((t) => buildRow(t.name, t, null)),
      }));

    const knownNames = new Set(builtIn.flatMap((s) => s.rows.map((r) => r.name)));
    const customRows = tools
      .filter((t) => !knownNames.has(t.name))
      .map((item) => {
        const catalog = TOOL_DEFINITIONS_CATALOG['custom-workspace'];
        const def = catalog?.tools.find((t) => t.name === item.name) ?? null;
        return buildRow(item.name, def, item);
      });

    if (customRows.length === 0) return builtIn;
    return [
      {
        id: CUSTOM_SUITE_ID,
        name: 'Workspace Tools',
        description:
          'Tools registered against this workspace. Definitions shown for these come from the tool catalog, not from the capability row.',
        origin: 'workspace',
        rows: customRows,
      },
      ...builtIn,
    ];
  }, [tools]);

  const filteredSuites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? suites.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.rows.some((r) => r.name.toLowerCase().includes(q)),
        )
      : suites;
    if (sortBy === 'alphabetical') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [suites, searchQuery, sortBy]);

  const selectedSuite = useMemo(
    () => filteredSuites.find((s) => s.id === selectedSuiteId) ?? filteredSuites[0] ?? null,
    [filteredSuites, selectedSuiteId],
  );

  const activeRow = useMemo(() => {
    if (!selectedSuite) return null;
    return (
      selectedSuite.rows.find((r) => r.name === selectedToolName) ?? selectedSuite.rows[0] ?? null
    );
  }, [selectedSuite, selectedToolName]);

  const activeDefinition = activeRow?.definition ?? null;

  // Seed the payload editor from the tool's own declared sample, so what the
  // user validates against is the schema the server published.
  useEffect(() => {
    if (!activeDefinition) return;
    setTestInputJson(JSON.stringify(activeDefinition.samplePayload, null, 2));
  }, [activeDefinition]);

  const handleSelectSuite = useCallback((suite: ToolSuite) => {
    setSelectedSuiteId(suite.id);
    setSelectedToolName(suite.rows[0]?.name ?? null);
    setTestOutput(null);
    setTestError(null);
    setTestStatus(null);
    setTestExecuted(null);
    setTestDurationMs(null);
    setTestValidationErrors([]);
  }, []);

  const handleSelectTool = useCallback((name: string) => {
    setSelectedToolName(name);
    setTestOutput(null);
    setTestError(null);
    setTestStatus(null);
    setTestExecuted(null);
    setTestDurationMs(null);
    setTestValidationErrors([]);
  }, []);

  const handleToggleSuite = useCallback(
    (suite: ToolSuite, enabled: boolean) => {
      const next = { ...suiteState, [suite.id]: enabled };
      if (!writeSuiteState(workspaceId, next)) {
        toast({
          tone: 'error',
          title: 'Suite preference not saved',
          detail: 'Browser storage rejected the write, so nothing was recorded.',
        });
        return;
      }
      setSuiteState(next);
      toast({
        tone: 'info',
        title: `${suite.name} marked ${enabled ? 'available' : 'hidden'}`,
        detail:
          'Stored in this browser only. The server registers every built-in tool unconditionally — no endpoint stores this flag.',
      });
    },
    [suiteState, workspaceId, toast],
  );

  /**
   * Schema validation against the real tool registry.
   *
   * `POST /agents/capabilities/test` checks required parameters and returns
   * `executed: false`. The previous handler substituted a `simulated_success`
   * payload and a 32ms duration when the server sent neither, which rendered a
   * canned object under a "200 OK" badge. Nothing is substituted here: absent
   * duration, status and body stay absent.
   */
  const handleRunValidation = useCallback(async () => {
    if (!activeRow) return;
    let parsed: Record<string, unknown>;
    try {
      const raw = JSON.parse(testInputJson);
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('Payload must be a JSON object.');
      }
      parsed = raw as Record<string, unknown>;
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'The payload is not valid JSON.');
      setTestOutput(null);
      setTestStatus(null);
      setTestExecuted(null);
      setTestDurationMs(null);
      setTestValidationErrors([]);
      return;
    }

    setTestRunning(true);
    setTestError(null);
    try {
      const res = await capabilitiesApi.test({
        workspaceId,
        capabilityName: activeRow.name,
        category: 'tools',
        inputPayload: parsed,
      });
      setTestStatus(res.status);
      setTestExecuted(res.executed);
      setTestDurationMs(res.executionDurationMs);
      setTestValidationErrors(res.validationErrors);
      setTestOutput(JSON.stringify(res.result, null, 2));
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'The request failed.');
      setTestOutput(null);
      setTestStatus(null);
      setTestExecuted(null);
      setTestDurationMs(null);
      setTestValidationErrors([]);
    } finally {
      setTestRunning(false);
    }
  }, [activeRow, testInputJson, workspaceId]);

  const detailTabs = useMemo(
    () => [
      { id: 'contract' as DetailSubTab, label: 'Tool Contract' },
      { id: 'schema' as DetailSubTab, label: 'Schema & Parameters' },
      { id: 'validate' as DetailSubTab, label: 'Parameter Validation' },
    ],
    [],
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 bg-background text-text overflow-hidden">
      <section
        className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[390px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0"
        aria-labelledby="tool-suites-heading"
      >
        <div className="p-3 border-b border-border bg-surface shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2
              id="tool-suites-heading"
              className="text-xs font-semibold text-text uppercase tracking-wider font-sans shrink-0"
            >
              Tool Suites
            </h2>
            <span className="text-2xs font-mono px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">
              {filteredSuites.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="tools-sort-select" className="text-2xs font-sans text-text-muted">
              Sort
            </label>
            <select
              id="tools-sort-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as ToolSort)}
              className="bg-surface-elevated text-text border border-border rounded px-2 py-1 text-xs font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
            >
              <option value="most-used">Catalog order</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto overscroll-y-contain p-2 pb-12 space-y-1.5 min-h-0">
          {filteredSuites.length === 0 && (
            <li className="p-1">
              <EmptyState
                title="No tool suites match"
                description={
                  searchQuery.trim()
                    ? `Nothing in the tool catalog matches “${searchQuery.trim()}”.`
                    : 'The tool catalog is empty.'
                }
              />
            </li>
          )}

          {filteredSuites.map((suite) => {
            const isSelected = selectedSuite?.id === suite.id;
            const hidden = suiteState[suite.id] === false;
            return (
              <li key={suite.id}>
                <div
                  className={`flex items-start gap-2 p-2 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-primary/10 border-primary/30 shadow-xs'
                      : 'bg-surface hover:bg-surface-hover border-transparent'
                  }`}
                >
                  {/* Selection and the suite switch are siblings, not nested: a
                      role="switch" inside a role="button" is an invalid composite
                      for assistive tech and the only reason the old markup needed
                      stopPropagation. */}
                  <button
                    type="button"
                    onClick={() => handleSelectSuite(suite)}
                    aria-current={isSelected ? 'true' : undefined}
                    className="flex-1 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'bg-surface-elevated border-border text-text-muted'
                        }`}
                        aria-hidden="true"
                      >
                        <SuiteIcon suiteId={suite.id} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-xs font-semibold font-sans truncate ${
                              isSelected ? 'text-primary' : 'text-text'
                            }`}
                          >
                            {suite.name}
                          </span>
                          <span className="text-2xs font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-text-secondary border border-border">
                            {suite.rows.length}
                          </span>
                          {suite.origin === 'workspace' && (
                            <Badge variant="default" size="sm">
                              workspace
                            </Badge>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="block text-2xs font-sans text-text-muted line-clamp-2 leading-relaxed mt-1.5">
                      {suite.description}
                    </span>
                    <span className="flex flex-wrap gap-1 mt-1.5">
                      {suite.rows.slice(0, 3).map((row) => (
                        <span
                          key={row.name}
                          className={`text-2xs font-mono px-1.5 py-0.2 rounded border truncate max-w-[130px] ${
                            row.definition
                              ? 'bg-surface-elevated text-text-secondary border-border-subtle'
                              : 'bg-warning/10 text-warning border-warning/30'
                          }`}
                        >
                          {row.name}
                        </span>
                      ))}
                      {suite.rows.length > 3 && (
                        <span className="text-2xs font-mono text-text-muted self-center">
                          +{suite.rows.length - 3}
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="shrink-0 pt-1">
                    <Tooltip
                      content="Browser-local visibility preference. The server registers every built-in tool unconditionally."
                      side="left"
                    >
                      <div>
                        <Switch
                          checked={!hidden}
                          onChange={(next) => handleToggleSuite(suite, next)}
                          label={
                            <span className="sr-only">{`Show ${suite.name} in this browser`}</span>
                          }
                        />
                      </div>
                    </Tooltip>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex-1 flex flex-col min-h-0 min-w-0 bg-background overflow-hidden">
        {selectedSuite && activeRow ? (
          <>
            <div className="p-4 sm:p-5 border-b border-border bg-surface shrink-0 font-sans shadow-xs space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans font-mono">
                    {activeRow.name}
                  </h3>
                  {activeRow.definition ? (
                    <Badge variant="primary" size="sm">
                      {activeRow.definition.category}
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      No server definition
                    </Badge>
                  )}
                  {selectedSuite.origin === 'workspace' && (
                    <Badge variant="default" size="sm">
                      workspace tool
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-1 max-w-3xl leading-relaxed">
                  {activeRow.definition?.description ??
                    activeRow.workspaceItem?.description ??
                    'No description was returned for this tool.'}
                </p>
                <p className="text-2xs font-mono text-text-muted mt-1">
                  {activeRow.definition
                    ? 'definition from the tool catalog'
                    : 'not present in the tool catalog — the fields below come from the workspace capability row, which the server does not validate'}
                </p>
              </div>

              <div
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 border-t border-border-subtle"
                role="group"
                aria-label={`Tools in ${selectedSuite.name}`}
              >
                <span className="text-2xs font-mono uppercase tracking-wider text-text-muted shrink-0 mr-1">
                  {selectedSuite.rows.length} tools
                </span>
                {selectedSuite.rows.map((row) => {
                  const isActive = row.name === activeRow.name;
                  return (
                    <button
                      key={row.name}
                      type="button"
                      onClick={() => handleSelectTool(row.name)}
                      aria-pressed={isActive}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
                        isActive
                          ? 'bg-action text-action-fg shadow-xs font-semibold'
                          : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-surface-hover border border-border'
                      }`}
                    >
                      {row.name}
                    </button>
                  );
                })}
              </div>

              <Tabs
                tabs={detailTabs}
                activeTab={detailSubTab}
                onTabChange={(id) => setDetailSubTab(id as DetailSubTab)}
                variant="underline"
                size="sm"
                ariaLabel={`${activeRow.name} detail`}
              />
            </div>

            <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 pb-16 bg-background min-h-0 font-sans">
              <TabPanel id="contract" activeTab={detailSubTab}>
                <div className="space-y-4 max-w-3xl">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Fact
                      term="Required scope"
                      value={activeRow.requiredScope}
                      emptyText="not declared anywhere for this tool"
                    />
                    <Fact
                      term="Trust class"
                      value={
                        activeRow.definition?.trustClass ??
                        activeRow.workspaceItem?.trustClass ??
                        null
                      }
                      emptyText="not declared for this tool"
                    />
                    <Fact
                      term="Approval gate"
                      value={
                        activeRow.approvalGated === null
                          ? null
                          : activeRow.approvalGated
                            ? 'HITL'
                            : 'Auto'
                      }
                      emptyText="unknown — no server definition for this tool"
                    />
                    <Fact
                      term="Enabled in workspace"
                      value={
                        activeRow.workspaceItem
                          ? activeRow.workspaceItem.enabled
                            ? 'yes'
                            : 'no'
                          : null
                      }
                      emptyText="not a workspace capability row"
                    />
                  </dl>

                  {activeRow.workspaceItem?.markdownDoc && (
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Workspace capability document
                      </h4>
                      <div className="bg-surface-elevated border border-border rounded-xl p-4 overflow-x-auto font-mono text-xs text-text leading-relaxed">
                        <pre className="whitespace-pre-wrap">
                          {activeRow.workspaceItem.markdownDoc}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </TabPanel>

              <TabPanel id="schema" activeTab={detailSubTab}>
                {activeDefinition ? (
                  <div className="space-y-4 max-w-3xl">
                    <div className="rounded-xl border border-border bg-surface overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border bg-surface-elevated flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-text uppercase tracking-wider font-sans">
                          Input Parameters ({activeDefinition.parameters.length})
                        </h4>
                        <span className="text-2xs font-mono text-text-muted">
                          from the tool catalog
                        </span>
                      </div>
                      {activeDefinition.parameters.length === 0 ? (
                        <p className="p-6 text-center text-xs text-text-muted font-sans">
                          This tool declares no input parameters.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-sans">
                            <thead className="border-b border-border text-2xs font-mono uppercase text-text-muted bg-surface">
                              <tr>
                                <th scope="col" className="px-4 py-2">
                                  Parameter
                                </th>
                                <th scope="col" className="px-4 py-2">
                                  Type
                                </th>
                                <th scope="col" className="px-4 py-2">
                                  Status
                                </th>
                                <th scope="col" className="px-4 py-2">
                                  Default
                                </th>
                                <th scope="col" className="px-4 py-2">
                                  Description
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {activeDefinition.parameters.map((param) => (
                                <tr
                                  key={param.name}
                                  className="hover:bg-surface-hover transition-colors"
                                >
                                  <td className="px-4 py-2.5 font-mono text-primary font-semibold">
                                    {param.name}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-text-secondary">
                                    {param.type}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <Badge
                                      variant={param.required ? 'warning' : 'default'}
                                      size="sm"
                                    >
                                      {param.required ? 'Required' : 'Optional'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-text-muted">
                                    {param.default !== undefined ? String(param.default) : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-text-secondary leading-relaxed">
                                    {param.description}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-border bg-surface-elevated p-4">
                      <h4 className="text-xs font-mono font-semibold text-text mb-2">
                        Raw JSON Schema
                      </h4>
                      <pre className="p-3 rounded-lg bg-surface border border-border text-xs font-mono text-text overflow-x-auto">
                        {JSON.stringify(activeDefinition.inputSchema, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No published schema"
                    description={`${activeRow.name} is not in the tool-definition catalog, so the server publishes no input schema for it. Add it under Tools to get one.`}
                  />
                )}
              </TabPanel>

              <TabPanel id="validate" activeTab={detailSubTab}>
                <div className="space-y-4 max-w-3xl">
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-border bg-surface-elevated">
                    <p className="text-xs text-text-secondary font-sans leading-relaxed">
                      This validates the payload above against the tool&apos;s declared required
                      fields. It does not run the tool — the endpoint answers with{' '}
                      <code className="font-mono">executed: false</code> and makes no network or
                      model call. Real execution is{' '}
                      <code className="font-mono">
                        POST /api/v1/capabilities/&#123;id&#125;/test
                      </code>{' '}
                      on an installed capability row.
                    </p>
                  </div>

                  <Textarea
                    label="JSON input payload"
                    rows={6}
                    value={testInputJson}
                    onChange={(e) => setTestInputJson(e.target.value)}
                    className="font-mono text-xs"
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRunValidation}
                      loading={testRunning}
                    >
                      Validate parameters
                    </Button>
                    {activeDefinition && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setTestInputJson(JSON.stringify(activeDefinition.samplePayload, null, 2))
                        }
                      >
                        Load catalog sample
                      </Button>
                    )}
                  </div>

                  {testError && (
                    <ErrorState
                      title="Validation request failed"
                      message={testError}
                      onRetry={handleRunValidation}
                      actionText="Retry validation"
                    />
                  )}

                  {testStatus !== null && (
                    <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle pb-2">
                        <Badge
                          variant={
                            testStatus === 'success'
                              ? 'success'
                              : testStatus === 'error'
                                ? 'error'
                                : 'warning'
                          }
                          size="sm"
                        >
                          {testStatus}
                        </Badge>
                        <Badge variant={testExecuted ? 'success' : 'default'} size="sm">
                          {testExecuted ? 'executed: true' : 'executed: false — nothing was run'}
                        </Badge>
                        {testDurationMs !== null && (
                          <span className="text-2xs font-mono text-text-muted">
                            {testDurationMs}ms server-side
                          </span>
                        )}
                      </div>

                      {testValidationErrors.length > 0 && (
                        <ul className="space-y-1 text-xs text-error font-sans list-disc list-inside">
                          {testValidationErrors.map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                        </ul>
                      )}

                      {testOutput !== null && (
                        <pre className="p-3 rounded-lg bg-surface-elevated border border-border text-xs font-mono text-text overflow-x-auto max-h-72">
                          {testOutput}
                        </pre>
                      )}
                    </div>
                  )}

                  {testStatus === null && !testError && !testRunning && (
                    <p className="text-xs text-text-muted font-sans leading-relaxed">
                      No validation has been run. Nothing is shown until the server responds.
                    </p>
                  )}
                </div>
              </TabPanel>
            </div>

            <footer className="px-5 py-2.5 border-t border-border bg-surface flex flex-wrap items-center justify-between gap-2 text-xs font-sans text-text-muted shrink-0">
              <span className="truncate">
                Suite: <strong className="text-text font-medium">{selectedSuite.name}</strong>
              </span>
              <span className="inline-flex items-center gap-3 text-2xs font-mono">
                <span>scope: {activeRow.requiredScope ?? 'not declared'}</span>
                <span>
                  gate:{' '}
                  {activeRow.approvalGated === null
                    ? 'unknown'
                    : activeRow.approvalGated
                      ? 'HITL'
                      : 'auto'}
                </span>
              </span>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              title="No tool selected"
              description="Pick a suite and a tool to read its contract, schema and parameter validation."
            />
          </div>
        )}
      </section>
    </div>
  );
};

function Fact({
  term,
  value,
  emptyText,
}: {
  term: string;
  value: string | null;
  emptyText: string;
}) {
  return (
    <div className="p-3.5 rounded-xl border border-border bg-surface space-y-1">
      <dt className="text-2xs font-mono uppercase tracking-wider text-text-muted">{term}</dt>
      <dd className="text-sm font-mono text-text break-words">
        {value ?? <span className="text-text-muted font-sans text-xs">{emptyText}</span>}
      </dd>
    </div>
  );
}
