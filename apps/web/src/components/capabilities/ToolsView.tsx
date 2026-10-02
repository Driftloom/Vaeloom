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

/**
 * One tool's server-side gate: the `workspace_capabilities` row that decides
 * whether `execute_tool` will run it.
 *
 * Keyed by tool NAME, because that is what the executor matches on —
 * `_query_disabled_tools` selects rows with `category='tool'` and
 * `enabled=false` and `execute_tool` denies when `tool.name` is in that set. A
 * row named after a suite would never be consulted, which is why the suite
 * switch writes one row per tool rather than one row per suite.
 *
 * ABSENT ROW MEANS ENABLED. Every existing workspace has zero tool rows, so
 * treating a missing row as "not enabled" would switch off the whole built-in
 * surface. Only an explicit `enabled=false` blocks a call.
 */
interface ToolGateRow {
  id: string;
  enabled: boolean;
}

interface SuiteGate {
  total: number;
  /** Tools in this suite that carry an explicit `enabled=false` row. */
  disabled: string[];
}

function suiteGate(suite: ToolSuite, rows: ReadonlyMap<string, ToolGateRow>): SuiteGate {
  const disabled: string[] = [];
  for (const row of suite.rows) {
    const gate = rows.get(row.name);
    if (gate && !gate.enabled) disabled.push(row.name);
  }
  return { total: suite.rows.length, disabled };
}

interface ToolGateState {
  denied: boolean;
  /** Short form for the fact grid; the three cases are genuinely different. */
  label: string;
  detail: string;
}

/**
 * One tool's gate, spelled out.
 *
 * Three states rather than a boolean, because "no row" and "an enabled row" are
 * different facts about the server even though both let the tool run, and
 * collapsing them hides the row an operator would have to look for.
 */
function activeGateState(row: ToolRow, rows: ReadonlyMap<string, ToolGateRow>): ToolGateState {
  const gate = rows.get(row.name);
  if (!gate) {
    return {
      denied: false,
      label: 'no row — enabled',
      detail: `This workspace holds no capability row for ${row.name}, and no row means enabled: execute_tool will run it. Turning the switch off creates one with enabled=false.`,
    };
  }
  if (!gate.enabled) {
    return {
      denied: true,
      label: 'no — enabled=false row',
      detail: `A capability row for ${row.name} carries enabled=false, so execute_tool raises PermissionDeniedError for it before the handler runs.`,
    };
  }
  return {
    denied: false,
    label: 'yes — enabled row',
    detail: `A capability row for ${row.name} carries enabled=true. The tool runs; the row exists only to record the decision.`,
  };
}

/**
 * Where the switch is enforced, in one sentence.
 *
 * The previous Tooltip said the flag lived in this browser and that no endpoint
 * stored it. That is no longer true: the flag is a `workspace_capabilities` row
 * with `category='tool'` and `enabled=false`, and `execute_tool` raises
 * `PermissionDeniedError` on it before any handler runs.
 */
const GATE_ENFORCEMENT =
  'Enforced server-side: a workspace capability row with category=tool and enabled=false, read by execute_tool at call time. No row means enabled.';

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

  const [gateRows, setGateRows] = useState<ReadonlyMap<string, ToolGateRow>>(() => new Map());
  const [gateStatus, setGateStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [gateError, setGateError] = useState<string | null>(null);
  const [pendingTools, setPendingTools] = useState<ReadonlySet<string>>(() => new Set());

  const [testInputJson, setTestInputJson] = useState('{}');
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testExecuted, setTestExecuted] = useState<boolean | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testValidationErrors, setTestValidationErrors] = useState<string[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  /**
   * The workspace's own `category='tool'` rows.
   *
   * Read from `GET /capabilities?category=tool` rather than from the `tools` prop,
   * because that prop merges workspace rows with seeded entries and a seeded entry
   * has no row to point at. A gate control driven by the merge would offer to
   * PATCH an id that was never minted.
   */
  useEffect(() => {
    let cancelled = false;
    setGateStatus('loading');
    setGateError(null);
    capabilitiesApi
      .list('tool', workspaceId)
      .then((rows) => {
        if (cancelled) return;
        const next = new Map<string, ToolGateRow>();
        for (const row of rows) next.set(row.name, { id: row.id, enabled: row.enabled });
        setGateRows(next);
        setGateStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGateError(err instanceof Error ? err.message : 'The tool rows could not be read.');
        setGateStatus('failed');
      });
    return () => {
      cancelled = true;
    };
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

  /**
   * Move one tool's gate to `enabled`, creating the row when there is none.
   *
   * Two calls for the create case, because `POST /capabilities` has no `enabled`
   * field and writes `enabled=true` unconditionally: a tool with no row cannot be
   * disabled in one request. The gap is harmless in the direction that matters —
   * an absent row already means enabled, so the tool is running before and after
   * the create; the PATCH is what actually installs the gate.
   *
   * Local state is updated only from a response the server returned. A rejected
   * write leaves the map untouched, which is the point: a tool whose row write
   * failed is still enabled server-side and the switch has to keep saying so.
   */
  const writeToolEnabled = useCallback(
    async (row: ToolRow, enabled: boolean): Promise<void> => {
      const existing = gateRows.get(row.name);
      let id = existing?.id;
      if (!id) {
        const created = await capabilitiesApi.create({
          name: row.name,
          category: 'tool',
          description:
            row.definition?.description ?? `Execution-gate row for the built-in tool ${row.name}.`,
          config: {
            ...(row.definition ? { parameters: row.definition.inputSchema } : {}),
            ...(row.requiredScope ? { required_scope: row.requiredScope } : {}),
          },
        });
        id = created.id;
      }
      const updated = await capabilitiesApi.update(id, { enabled });
      setGateRows((previous) => {
        const next = new Map(previous);
        next.set(row.name, { id: updated.id, enabled: updated.enabled });
        return next;
      });
    },
    [gateRows],
  );

  const handleSetToolEnabled = useCallback(
    async (row: ToolRow, enabled: boolean) => {
      setPendingTools((previous) => new Set(previous).add(row.name));
      try {
        await writeToolEnabled(row, enabled);
        toast({
          tone: enabled ? 'success' : 'info',
          title: `${row.name} ${enabled ? 'enabled' : 'disabled'} for this workspace`,
          detail: enabled
            ? 'The capability row no longer blocks it; execute_tool will run it.'
            : 'A capability row with enabled=false now denies execute_tool for this tool.',
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `${row.name} was not ${enabled ? 'enabled' : 'disabled'}`,
          detail: `${err instanceof Error ? err.message : 'The server write failed.'} The server still has this tool enabled, so the switch has been left where it was.`,
        });
      } finally {
        setPendingTools((previous) => {
          const next = new Set(previous);
          next.delete(row.name);
          return next;
        });
      }
    },
    [toast, writeToolEnabled],
  );

  /**
   * One write per tool, because the executor keys on the individual tool name.
   *
   * A single row named after the suite would be a row nothing reads: the gate is
   * `tool.name IN {names with enabled=false rows}`, and `memory-graph` is not a
   * tool name. So the switch means "every tool in this suite" and is implemented
   * as N writes.
   *
   * Failures are per tool and are not rolled back: the writes that landed are
   * real, and reporting the whole switch as either on or off would be a claim
   * about rows that do not exist. The toast names the tools that did not move.
   */
  const handleToggleSuite = useCallback(
    async (suite: ToolSuite, enabled: boolean) => {
      setPendingTools((previous) => {
        const next = new Set(previous);
        for (const row of suite.rows) next.add(row.name);
        return next;
      });
      const results = await Promise.allSettled(
        suite.rows.map((row) => writeToolEnabled(row, enabled)),
      );
      const failures = suite.rows.flatMap((row, index) => {
        const result = results[index];
        if (result?.status !== 'rejected') return [];
        return [
          {
            name: row.name,
            reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
        ];
      });
      setPendingTools((previous) => {
        const next = new Set(previous);
        for (const row of suite.rows) next.delete(row.name);
        return next;
      });

      const moved = suite.rows.length - failures.length;
      if (failures.length === 0) {
        toast({
          tone: 'success',
          title: `${moved} tool${moved === 1 ? '' : 's'} in ${suite.name} marked ${
            enabled ? 'enabled' : 'disabled'
          }`,
          detail: enabled
            ? 'Every tool in this suite now has a capability row with enabled=true.'
            : `Each of the ${moved} tool${moved === 1 ? '' : 's'} now has a capability row with enabled=false, so execute_tool raises PermissionDeniedError for it.`,
        });
        return;
      }
      toast({
        tone: 'error',
        title: `${failures.length} of ${suite.rows.length} row writes failed`,
        detail: `${failures.map((failure) => failure.name).join(', ')}: ${failures[0]?.reason ?? 'The server write failed.'} Those tools are still enabled server-side because no enabled=false row was written. The other ${moved} did change.`,
      });
    },
    [toast, writeToolEnabled],
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

        {/*
          The gate banner is unconditional about what it does and does not know.
          While the rows are loading or after a failure the switches are disabled,
          because a switch showing "on" from an empty map would be indistinguishable
          from a verified "no row means enabled".
        */}
        <div className="px-3 py-2 border-b border-border bg-surface-elevated shrink-0 space-y-1.5">
          <p className="text-2xs text-text-muted leading-relaxed">{GATE_ENFORCEMENT}</p>
          {gateStatus === 'loading' && (
            <p role="status" className="text-2xs font-mono text-text-muted">
              Reading this workspace&apos;s tool rows…
            </p>
          )}
          {gateStatus === 'failed' && (
            <p role="alert" className="text-2xs font-mono text-error leading-relaxed">
              The tool rows could not be read: {gateError}. The switches are disabled because
              nothing here can tell an enabled tool from a denied one.
            </p>
          )}
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
            const gate = suiteGate(suite, gateRows);
            const allDisabled = gate.disabled.length === gate.total;
            // The switch means "no tool in this suite is denied". A partially
            // denied suite therefore reads as ON, because the alternative — an
            // unchecked switch — claims the suite is disabled while most of it
            // still runs. The count beside it is what stops ON from being read as
            // "everything is fine".
            const checked = !allDisabled;
            const partial = gate.disabled.length > 0 && !allDisabled;
            const busy = suite.rows.some((row) => pendingTools.has(row.name));
            const gateTooltip = allDisabled
              ? `All ${gate.total} tools in ${suite.name} have an enabled=false capability row. execute_tool raises PermissionDeniedError before any handler runs.`
              : partial
                ? `${gate.disabled.length} of ${gate.total} tools have an enabled=false row and are denied at execution (${gate.disabled.join(', ')}). The rest have no such row, and no row means enabled.`
                : `No tool in ${suite.name} has an enabled=false row, so execute_tool runs all ${gate.total}. Turning this off writes one capability row per tool, because the gate keys on the individual tool name.`;
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
                          {allDisabled && (
                            <Badge variant="error" size="sm">
                              all {gate.total} denied
                            </Badge>
                          )}
                          {partial && (
                            <Badge variant="warning" size="sm">
                              {gate.disabled.length} of {gate.total} denied
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
                            gateRows.get(row.name)?.enabled === false
                              ? 'bg-error/10 text-error border-error/30 line-through'
                              : row.definition
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

                  <div className="shrink-0 pt-1 flex flex-col items-end gap-1">
                    <Tooltip content={gateTooltip} side="left">
                      <div>
                        <Switch
                          checked={checked}
                          disabled={gateStatus !== 'ready' || busy}
                          onChange={(next) => void handleToggleSuite(suite, next)}
                          label={
                            <span className="sr-only">
                              {partial
                                ? `Partially disabled: ${gate.disabled.length} of ${gate.total} tools in ${suite.name} are denied at execution`
                                : `Allow all ${gate.total} tools in ${suite.name} in this workspace`}
                            </span>
                          }
                        />
                      </div>
                    </Tooltip>
                    {busy && <span className="text-2xs font-mono text-text-muted">writing…</span>}
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
                      term="Execution gate"
                      value={activeGateState(activeRow, gateRows).label}
                      emptyText=""
                    />
                  </dl>

                  {/*
                    Per-tool control, because a suite that is partially denied
                    cannot be repaired from the suite switch: that switch means
                    "every tool", so it can only take the suite to all-on or
                    all-off. This is the control that moves one tool.
                  */}
                  <div className="p-4 rounded-xl border border-border bg-surface space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Allow {activeRow.name} in this workspace
                      </h4>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            activeGateState(activeRow, gateRows).denied ? 'error' : 'success'
                          }
                          size="sm"
                        >
                          {activeGateState(activeRow, gateRows).denied
                            ? 'denied at execution'
                            : 'runs at execution'}
                        </Badge>
                        <Switch
                          checked={!activeGateState(activeRow, gateRows).denied}
                          disabled={gateStatus !== 'ready' || pendingTools.has(activeRow.name)}
                          onChange={(next) => void handleSetToolEnabled(activeRow, next)}
                          label={
                            <span className="sr-only">{`Allow ${activeRow.name} in this workspace`}</span>
                          }
                        />
                      </div>
                    </div>
                    <p className="text-2xs text-text-muted leading-relaxed">
                      {activeGateState(activeRow, gateRows).detail}
                    </p>
                    {pendingTools.has(activeRow.name) && (
                      <p role="status" className="text-2xs font-mono text-text-muted">
                        Writing the capability row…
                      </p>
                    )}
                  </div>

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
