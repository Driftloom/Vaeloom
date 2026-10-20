/**
 * Tool-suite grouping for the Capabilities workbench Tools tab.
 *
 * The tool rows themselves are no longer copied here. Every fabricated entry in
 * the old client catalog eventually drifted from the backend registry it
 * claimed to mirror, so the rows now come from the server:
 * `GET /capabilities/tools/definitions` (`apps/api/src/api/tools/definitions.py`)
 * is the only source of truth. What lives in this file is only what the backend
 * does not define:
 *
 *   - the shared SWR key the Tools tab and the `[toolName]` subpage both fetch
 *     under;
 *   - how the first dotted segment of a tool's required scope maps to a
 *     readable suite label;
 *   - the one adapter that turns a served `ToolDefinitionRecord` into the
 *     `ToolDefinitionItem` view shape the drawer and subpage render.
 */

import type { ToolDefinitionRecord } from '@/lib/api-client';

export interface ToolParameter {
  name: string;
  /** Declared type of the parameter, verbatim from the JSON Schema property. */
  type: string;
  required: boolean;
  description: string;
  /** Declared default value, verbatim from the JSON Schema property. */
  default?: unknown;
}

export interface ToolDefinitionItem {
  name: string;
  description: string;
  requiredScope: string;
  /** Free text on the server side (`definitions.py`); the client does not narrow it. */
  category: string;
  /** Free text on the server side (`definitions.py`); the client does not narrow it. */
  trustClass: string;
  /**
   * The backend emits no approval-gating signal on a `ToolDefinition`, so this
   * is `null` for every served row — the drawer renders it as unknown rather
   * than asserting a gate the registry does not enforce.
   */
  approvalGated: boolean | null;
  parameters: ToolParameter[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  /** The declared defaults only — the client refuses to invent sample values. */
  samplePayload: Record<string, unknown>;
}

/**
 * Suite labels for scope-prefix groups.
 *
 * The suite key is the first dotted segment of the tool's `required_scope`
 * (e.g. `system.browser.read` → `system`). Only segments where the old catalog
 * had a suite whose real backend tools all carried that prefix are labeled —
 * `memory` tools are the memory-graph suite, and the `agent` spawn tools are
 * the agent-bus suite. The remaining segments span several catalog suites or
 * only ever existed through fabricated tools, so naming them would invent a
 * claim the backend does not make; everything unlabeled groups under
 * `OTHER_SUITE_KEY`.
 */
export const TOOL_SUITE_LABELS: Record<string, string> = {
  memory: 'Memory Graph',
  agent: 'Agent Bus',
};

/** All scope prefixes without a label share this one catch-all suite. */
export const OTHER_SUITE_KEY = 'other';
export const OTHER_SUITE_LABEL = 'Other';

export function suiteKeyForScope(scope: string): string {
  return scope.split('.')[0] ?? '';
}

export function suiteLabelForKey(key: string): string {
  return TOOL_SUITE_LABELS[key] ?? OTHER_SUITE_LABEL;
}

function parametersFromInputSchema(schema: Record<string, unknown>): ToolParameter[] {
  const properties = (schema['properties'] ?? {}) as Record<string, Record<string, unknown>>;
  const required = Array.isArray(schema['required']) ? (schema['required'] as string[]) : [];
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: typeof prop['type'] === 'string' ? prop['type'] : 'unknown',
    required: required.includes(name),
    description: typeof prop['description'] === 'string' ? prop['description'] : '',
    ...(prop['default'] !== undefined ? { default: prop['default'] } : {}),
  }));
}

function samplePayloadFromParameters(parameters: ToolParameter[]): Record<string, unknown> {
  const sample: Record<string, unknown> = {};
  for (const param of parameters) {
    if (param.default !== undefined) sample[param.name] = param.default;
  }
  return sample;
}

/**
 * Derive the `ToolDefinitionItem` view shape from a served registry row.
 *
 * Single shared derivation for the two consumers (ToolsView and the
 * `[toolName]` subpage); both render the same drawer-style detail, so one
 * adapter keeps their data identical. The schemas pass through verbatim so the
 * raw JSON remains the server's, not the client's.
 */
export function definitionFromRecord(record: ToolDefinitionRecord): ToolDefinitionItem {
  const parameters = parametersFromInputSchema(record.inputSchema);
  return {
    name: record.name,
    description: record.description,
    requiredScope: record.requiredScope,
    category: record.category,
    trustClass: record.trustClass,
    approvalGated: null,
    parameters,
    inputSchema: record.inputSchema,
    outputSchema: record.outputSchema,
    samplePayload: samplePayloadFromParameters(parameters),
  };
}

/**
 * Shared SWR cache key for `GET /capabilities/tools/definitions`.
 *
 * `capability-keys.ts` is scoped to workspace capability rows; the registry is
 * workspace-independent and constant per backend revision, so it lives next to
 * the labels it feeds. Global key: the Tools tab and the `[toolName]` subpage
 * share one cache entry.
 */
export const TOOL_DEFINITIONS_SWR_KEY: readonly string[] = ['capabilities', 'tool-definitions'];
