'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CapabilityItem } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { capabilitiesApi } from '@/lib/api-client';
import { TOOL_DEFINITIONS_CATALOG } from '@/lib/tool-definitions-catalog';

import {
  buildRow,
  formatSuiteName,
  CUSTOM_SUITE_ID,
  type DetailSubTab,
  type ToolGateRow,
  type ToolRow,
  type ToolSort,
  type ToolSuite,
} from './tools/types';
import { ToolSuiteAccordion } from './tools/ToolSuiteAccordion';
import { ToolDetailDrawer } from './tools/ToolDetailDrawer';

export type { ToolSort } from './tools/types';

export interface ToolsViewProps {
  tools: CapabilityItem[];
  workspaceId: string;
  searchQuery?: string;
  sortBy?: ToolSort;
  onSortChange?: (sort: ToolSort) => void;
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

  const handleSelectSuite = useCallback((suite: ToolSuite) => {
    setSelectedSuiteId(suite.id);
    setSelectedToolName(suite.rows[0]?.name ?? null);
  }, []);

  const handleSelectTool = useCallback((name: string) => {
    setSelectedToolName(name);
  }, []);

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

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 bg-background text-text overflow-hidden">
      <ToolSuiteAccordion
        filteredSuites={filteredSuites}
        selectedSuite={selectedSuite}
        gateRows={gateRows}
        gateStatus={gateStatus}
        gateError={gateError}
        pendingTools={pendingTools}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        searchQuery={searchQuery}
        onSelectSuite={handleSelectSuite}
        onToggleSuite={handleToggleSuite}
      />

      <ToolDetailDrawer
        workspaceId={workspaceId}
        selectedSuite={selectedSuite}
        activeRow={activeRow}
        gateRows={gateRows}
        gateStatus={gateStatus}
        pendingTools={pendingTools}
        detailSubTab={detailSubTab}
        onDetailSubTabChange={setDetailSubTab}
        onSelectTool={handleSelectTool}
        onSetToolEnabled={handleSetToolEnabled}
      />
    </div>
  );
};
