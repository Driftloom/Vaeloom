import React from 'react';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';
import type { BuiltinMcpServer, ComposioAppInfo, ConnectorItem } from '@/lib/api-client';
import {
  renderCatalogIcon,
  CATEGORY_FILTERS,
  type ConnectorDefinition,
  type ConnectorCategory,
  type CategoryFilter,
} from '@/lib/connectors-catalog';

export interface ConnectorsViewProps {
  workspaceId: string;
  searchQuery?: string;
  openAddTrigger?: number;
}

// ─── Provider copy ───────────────────────────────────────────────────────────
export const PROVIDER_META: Record<string, { name: string; intent: string }> = {
  drive: {
    name: 'Google Drive',
    intent:
      'Lets agents read the files and documents you choose to open with Vaeloom. Anything that writes or deletes stays behind an approval gate.',
  },
  github: {
    name: 'GitHub',
    intent:
      'Lets agents inspect repositories, pull requests and branches. Writes require an explicit approval.',
  },
  gmail: {
    name: 'Gmail',
    intent:
      'Lets agents read mail for career and alert ingestion. Creating a draft is approval-gated.',
  },
  notion: {
    name: 'Notion',
    intent: 'Lets agents read the pages and databases shared with the integration.',
  },
  calendar: {
    name: 'Google Calendar',
    intent: 'Lets agents read events to extract interview dates and deadlines.',
  },
  slack: {
    name: 'Slack',
    intent: 'Lets agents read the channels you authorise. Outbound messages are approval-gated.',
  },
};

export const ALL_CATEGORY_FILTER: CategoryFilter = CATEGORY_FILTERS[0] as CategoryFilter;

export type CatalogRow =
  | { kind: 'definition'; def: ConnectorDefinition }
  | { kind: 'app'; app: ComposioAppInfo; slug: string };

export function rowId(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.id : `composio-${row.slug}`;
}

export function rowName(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.name : row.app.name;
}

export function rowDescription(row: CatalogRow): string {
  if (row.kind === 'definition') return row.def.description;
  return (
    row.app.description?.trim() || 'The Composio catalog returned no description for this app.'
  );
}

export function rowProvider(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.provider : 'composio';
}

export function rowProtocol(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.protocol : 'OAuth 2.0';
}

export function rowCategoryText(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.category : (row.app.category ?? '');
}

export function rowScopes(row: CatalogRow): string[] {
  return row.kind === 'definition' ? row.def.scopes : [];
}

export function rowAssignedAgents(row: CatalogRow): string[] {
  return row.kind === 'definition' ? row.def.assignedAgents : [];
}

export function rowComposioApp(row: CatalogRow): string | null {
  if (row.kind === 'app') return row.app.id || row.app.name;
  return row.def.composioApp ?? null;
}

/** The real action count Composio reported, or null when it reported none. */
export function rowActionCount(row: CatalogRow): number | null {
  if (row.kind === 'app') {
    const raw = row.app.action_count;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }
  return null;
}

export function rowIsTop(row: CatalogRow): boolean {
  return row.kind === 'definition' && row.def.isTop === true;
}

export function rowIcon(row: CatalogRow): React.ReactNode {
  if (row.kind === 'definition') return renderCatalogIcon(row.def);
  return renderCatalogIcon({
    id: `composio-${row.slug}`,
    name: row.app.name,
    provider: 'composio',
    composioApp: row.app.id || row.app.name,
    category: 'All',
    protocol: 'OAuth 2.0',
    description: '',
    scopes: [],
    assignedAgents: [],
  });
}

export function rowSearchText(row: CatalogRow): string {
  return [
    rowName(row),
    rowDescription(row),
    rowCategoryText(row),
    rowProtocol(row),
    rowProvider(row),
    ...rowScopes(row),
    ...rowAssignedAgents(row),
  ]
    .join(' ')
    .toLowerCase();
}

export function matchesCategory(row: CatalogRow, filter: CategoryFilter): boolean {
  if (filter.id === 'All') return true;
  const category = rowCategoryText(row).toLowerCase();
  const provider = rowProvider(row).toLowerCase();
  const id = rowId(row).toLowerCase();
  const protocol = rowProtocol(row).toLowerCase();

  if (filter.terms.some((term) => category.includes(term))) return true;
  if (filter.providerTerms?.some((term) => provider === term || provider.includes(term)))
    return true;
  if (filter.idIncludes?.some((term) => id.includes(term))) return true;
  if (filter.protocolIncludes?.some((term) => protocol.includes(term))) return true;
  return false;
}

export const CATEGORY_ICONS: Partial<Record<ConnectorCategory, React.ReactNode>> = {
  All: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  'Career & ATS': (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  'Startup & Business': (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  'Productivity & Study': (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  'Developer Tools & Cloud': (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  Productivity: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Engineering: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  Sales: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Communication: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  'AI & ML': (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
    </svg>
  ),
  Financial: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  HR: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'Data & Analytics': (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Legal: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c6 8 8 10 8 10z" />
    </svg>
  ),
  Support: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  ),
  Education: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  Marketing: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M3 11l15-7v14L3 11z" />
      <path d="M3 11v4a2 2 0 0 0 2 2h2" />
      <path d="M15 12v3a2 2 0 0 1-2 2" />
    </svg>
  ),
  MCP: (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

export type ConfiguredStatus = 'active' | 'syncing' | 'error' | 'paused' | 'disconnected';

export interface ConfiguredItem {
  id: string;
  name: string;
  provider?: string;
  type: string;
  status: ConfiguredStatus;
  lastSync?: string | null;
  isWorkspaceIntegration: boolean;
  originalConnector?: Connector;
  config?: Record<string, unknown>;
}

export const CONFIGURED_STATUS_META: Record<
  ConfiguredStatus,
  { dot: 'active' | 'warning' | 'error' | 'disabled'; label: string }
> = {
  active: { dot: 'active', label: 'Active' },
  syncing: { dot: 'warning', label: 'Syncing' },
  error: { dot: 'error', label: 'Error' },
  paused: { dot: 'disabled', label: 'Paused' },
  disconnected: { dot: 'disabled', label: 'Disconnected' },
};

export const CONNECTOR_STATUS_LABEL: Record<ConnectorItem['status'], string> = {
  active: 'Active',
  syncing: 'Syncing',
  error: 'Error',
  paused: 'Paused',
  disconnected: 'Disconnected',
  synced: 'Synced',
};

export const CONNECTOR_BADGE_VARIANT: Record<
  ConnectorItem['status'],
  'success' | 'warning' | 'error' | 'default'
> = {
  active: 'success',
  syncing: 'warning',
  error: 'error',
  paused: 'default',
  disconnected: 'default',
  synced: 'success',
};

export const CONNECTOR_DOT_STATUS: Record<
  ConnectorItem['status'],
  'active' | 'warning' | 'error' | 'disabled'
> = {
  active: 'active',
  syncing: 'warning',
  error: 'error',
  paused: 'disabled',
  disconnected: 'disabled',
  synced: 'active',
};

export const CUSTOM_TYPES = ['mcp', 'rest', 'graphql'] as const;

export function isCustomConnector(connector: ConnectorItem): boolean {
  return (CUSTOM_TYPES as readonly string[]).includes(connector.type?.toLowerCase() ?? '');
}

export function formatDate(iso?: string | null): string {
  if (!iso) return 'Never';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 'Unknown';
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function readBuiltinServers(res: {
  builtinServers?: BuiltinMcpServer[];
  builtin_servers?: BuiltinMcpServer[];
}): BuiltinMcpServer[] {
  const servers = res.builtinServers ?? res.builtin_servers;
  return Array.isArray(servers) ? servers : [];
}

/**
 * Characters rejected anywhere in an argv entry before it is handed to a
 * subprocess.
 *
 * This was previously a second, weaker definition (`/[;&|`$><\n\r]/`) living
 * beside `MCP_SHELL_METACHARS` in `AddCapabilityModal`. Two answers to the
 * same question, and the weaker one guarded the connector-create path --
 * which is the path that actually spawns an MCP stdio subprocess. One
 * definition now, and it is the stricter of the two: it adds `^`, `%` and
 * `!`, which are all shell metacharacters with expansion or substitution
 * behaviour depending on the shell the child happens to inherit.
 */
export const SHELL_METACHARACTERS = /[;&|`$><\r\n^%!]/;

export type CommandParseResult = { ok: true; argv: string[] } | { ok: false; error: string };

export function parseCommandLineArgs(input: string): CommandParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, argv: [] };

  const argv: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i] as string;
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      if (quote === '"' && ch === '\\' && i + 1 < trimmed.length) {
        i += 1;
        current += trimmed[i] as string;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started) {
        argv.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += ch;
    started = true;
  }

  if (quote) return { ok: false, error: 'Unbalanced quote in the arguments.' };
  if (started) argv.push(current);

  for (const arg of argv) {
    if (SHELL_METACHARACTERS.test(arg)) {
      return {
        ok: false,
        error: 'Shell metacharacters (; & | ` $ > <) are not allowed in arguments.',
      };
    }
  }

  return { ok: true, argv };
}

export const COMPOSIO_EQUIVALENTS: Record<string, string> = {
  github: 'github',
  drive: 'googledrive',
  gmail: 'gmail',
  slack: 'slack',
  notion: 'notion',
  calendar: 'googlecalendar',
};
