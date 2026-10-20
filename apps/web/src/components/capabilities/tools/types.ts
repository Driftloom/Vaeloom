import type { CapabilityItem } from '@/lib/capabilities-data';
import type { ToolDefinitionItem } from '@/lib/tool-definitions-catalog';

export type ToolSort = 'most-used' | 'alphabetical';
export type DetailSubTab = 'contract' | 'schema' | 'validate';

/**
 * One row in the suite list.
 */
export interface ToolRow {
  name: string;
  definition: ToolDefinitionItem | null;
  workspaceItem: CapabilityItem | null;
  requiredScope: string | null;
  approvalGated: boolean | null;
}

/**
 * State of the server-side gate read. `stale` means the last fetch failed but
 * previously fetched rows are still on screen: the view is honest about the
 * refresh having failed, yet the rows and switches keep working, because a
 * write re-reads the server anyway.
 */
export type GateStatus = 'loading' | 'ready' | 'failed' | 'stale';

export interface ToolSuite {
  id: string;
  name: string;
  description: string;
  origin: 'built-in' | 'workspace';
  rows: ToolRow[];
}

/**
 * One tool's server-side gate: the `workspace_capabilities` row that decides
 * whether `execute_tool` will run it.
 */
export interface ToolGateRow {
  id: string;
  enabled: boolean;
}

export interface SuiteGate {
  total: number;
  /** Tools in this suite that carry an explicit `enabled=false` row. */
  disabled: string[];
}

export function suiteGate(suite: ToolSuite, rows: ReadonlyMap<string, ToolGateRow>): SuiteGate {
  const disabled: string[] = [];
  for (const row of suite.rows) {
    const gate = rows.get(row.name);
    if (gate && !gate.enabled) disabled.push(row.name);
  }
  return { total: suite.rows.length, disabled };
}

export interface ToolGateState {
  denied: boolean;
  /** Short form for the fact grid; the three cases are genuinely different. */
  label: string;
  detail: string;
}

/**
 * One tool's gate, spelled out.
 */
export function activeGateState(
  row: ToolRow,
  rows: ReadonlyMap<string, ToolGateRow>,
): ToolGateState {
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

export const GATE_ENFORCEMENT =
  'Enforced server-side: a workspace capability row with category=tool and enabled=false, read by execute_tool at call time. No row means enabled.';

export function formatSuiteName(suiteId: string): string {
  return suiteId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export const CUSTOM_SUITE_ID = 'workspace-tools';

export function buildRow(
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
