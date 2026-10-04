'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Modal,
  SearchField,
  Spinner,
  StatusDot,
  Tooltip,
} from '@vaeloom/ui-kit';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useWorkspaceConnectors } from '../../hooks/useWorkspace';
import { api } from '../../lib/api';
import {
  temporalApi,
  connectorsApi,
  type BuiltinMcpServer,
  type ComposioAppInfo,
  type ComposioAppsResponse,
  type ComposioStatusResponse,
  type ConnectorHealthResponse,
  type ConnectorItem,
  type McpToolInfo,
} from '../../lib/api-client';
import { useToast } from '@/components/shared/Toast';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';
import {
  AUTHORITATIVE_CATALOG,
  renderCatalogIcon,
  PlusIcon,
  type ConnectorDefinition,
  type ConnectorCategory,
} from '@/lib/connectors-catalog';

interface ConnectorsViewProps {
  workspaceId: string;
  searchQuery?: string;
  openAddTrigger?: number;
}

// ─── Provider copy ───────────────────────────────────────────────────────────
//
// `scopes` used to live here and the OAuth modal rendered it under the heading
// "Requested Scopes". Those strings were written by hand; the scopes a provider
// will actually ask for are decided on its own consent screen from its own
// app registration, which this client has never read. Only the display name and
// a description of intent are real, so only those are kept.
const PROVIDER_META: Record<string, { name: string; intent: string }> = {
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

// ─── Category vocabulary ─────────────────────────────────────────────────────
//
// One table drives the dropdown, the chips and the predicate. The previous
// implementation was a 60-branch `if/else` ladder over category substrings that
// never grew a `Marketing` branch, so Marketing fell through to a generic
// `cat.includes(sel)` and silently matched a different set than every other chip.
interface CategoryFilter {
  id: ConnectorCategory;
  label: string;
  /** Matched against the row's category text, lowercased. */
  terms: readonly string[];
  /** Matched against the row's provider / id / protocol instead of its category. */
  providerTerms?: readonly string[];
  idIncludes?: readonly string[];
  protocolIncludes?: readonly string[];
}

const CATEGORY_FILTERS: readonly CategoryFilter[] = [
  { id: 'All', label: 'All Purposes & Sectors', terms: [] },
  {
    id: 'Education',
    label: 'Education & Learning',
    terms: ['education', 'learning', 'course', 'academy', 'training'],
  },
  { id: 'Sales', label: 'Sales & CRM', terms: ['sales', 'crm', 'lead', 'revenue'] },
  {
    id: 'Productivity',
    label: 'Productivity & Tasks',
    terms: ['productivity', 'task', 'project', 'workspace'],
  },
  {
    id: 'Engineering',
    label: 'Engineering & DevOps',
    terms: ['engineering', 'devops', 'developer', 'infrastructure', 'database'],
  },
  {
    id: 'Financial',
    label: 'Finance & Accounting',
    terms: ['finance', 'financial', 'accounting', 'banking', 'tax', 'payments'],
  },
  { id: 'Legal', label: 'Legal & Contracts', terms: ['legal', 'contract', 'compliance'] },
  {
    id: 'HR',
    label: 'HR, Recruiting & Talent',
    terms: ['hr', 'talent', 'recruit', 'hiring', 'people', 'payroll'],
  },
  { id: 'AI & ML', label: 'AI, Agents & ML', terms: ['ai', 'machine learning', 'intelligence'] },
  {
    id: 'Data & Analytics',
    label: 'Data, Analytics & BI',
    terms: ['analytics', 'data', 'bi', 'warehouse'],
  },
  {
    id: 'Communication',
    label: 'Communication & Messaging',
    terms: ['communication', 'messaging', 'email', 'chat', 'social'],
  },
  {
    id: 'Marketing',
    label: 'Marketing & Social',
    terms: ['marketing', 'social', 'campaign', 'seo', 'brand', 'advertis', 'content'],
  },
  { id: 'Support', label: 'Customer Support', terms: ['support', 'helpdesk', 'ticket', 'service'] },
  {
    id: 'E-Commerce',
    label: 'E-Commerce & Retail',
    terms: ['commerce', 'retail', 'store', 'ecommerce', 'marketplace'],
  },
  {
    id: 'Google',
    label: 'Google Workspace',
    terms: ['google', 'gmail', 'drive', 'calendar', 'workspace'],
    idIncludes: ['google', 'gmail'],
  },
  { id: 'Native', label: 'Native Sovereign', terms: [], providerTerms: ['native'] },
  {
    id: 'MCP',
    label: 'Model Context Protocol (MCP)',
    terms: [],
    protocolIncludes: ['MCP'],
    providerTerms: ['mcp'],
  },
];

const ALL_CATEGORY_FILTER: CategoryFilter = CATEGORY_FILTERS[0] as CategoryFilter;

// ─── Catalog rows ────────────────────────────────────────────────────────────
//
// A row is either a definition from the catalog shipped in this build, or an app
// the Composio catalog returned at runtime. They are kept as a discriminated
// union rather than merged into a synthetic `ConnectorDefinition`, because the
// merge is what let invented values (`scopes: ['api:execute']`,
// `assignedAgents: ['ApplicationAgent', 'ExecutiveStrategyAgent']`) be rendered
// beside a real app name as though the server had declared them.
type CatalogRow =
  | { kind: 'definition'; def: ConnectorDefinition }
  | { kind: 'app'; app: ComposioAppInfo; slug: string };

function rowId(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.id : `composio-${row.slug}`;
}

function rowName(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.name : row.app.name;
}

function rowDescription(row: CatalogRow): string {
  if (row.kind === 'definition') return row.def.description;
  return (
    row.app.description?.trim() || 'The Composio catalog returned no description for this app.'
  );
}

function rowProvider(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.provider : 'composio';
}

function rowProtocol(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.protocol : 'OAuth 2.0';
}

function rowCategoryText(row: CatalogRow): string {
  return row.kind === 'definition' ? row.def.category : (row.app.category ?? '');
}

function rowScopes(row: CatalogRow): string[] {
  return row.kind === 'definition' ? row.def.scopes : [];
}

function rowAssignedAgents(row: CatalogRow): string[] {
  return row.kind === 'definition' ? row.def.assignedAgents : [];
}

function rowComposioApp(row: CatalogRow): string | null {
  if (row.kind === 'app') return row.app.id || row.app.name;
  return row.def.composioApp ?? null;
}

/** The real action count Composio reported, or null when it reported none. */
function rowActionCount(row: CatalogRow): number | null {
  if (row.kind === 'app') {
    const raw = row.app.action_count;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }
  return null;
}

function rowIsTop(row: CatalogRow): boolean {
  return row.kind === 'definition' && row.def.isTop === true;
}

function rowIcon(row: CatalogRow): React.ReactNode {
  if (row.kind === 'definition') return renderCatalogIcon(row.def);
  // `AppBrandIcon` only reads `id` / `name` / `category` for its hue, so an
  // unrecognised server category string is not forced into the closed
  // `ConnectorCategory` union here.
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

function rowSearchText(row: CatalogRow): string {
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

function matchesCategory(row: CatalogRow, filter: CategoryFilter): boolean {
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

const CATEGORY_ICONS: Partial<Record<ConnectorCategory, React.ReactNode>> = {
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

type ConfiguredStatus = 'active' | 'syncing' | 'error' | 'paused' | 'disconnected';

/**
 * `paused` and `disconnected` are operator states, not failures, so they render
 * with the disabled dot rather than the error colour.
 */
const CONFIGURED_STATUS_META: Record<
  ConfiguredStatus,
  { dot: 'active' | 'warning' | 'error' | 'disabled'; label: string }
> = {
  active: { dot: 'active', label: 'Active' },
  syncing: { dot: 'warning', label: 'Syncing' },
  error: { dot: 'error', label: 'Error' },
  paused: { dot: 'disabled', label: 'Paused' },
  disconnected: { dot: 'disabled', label: 'Disconnected' },
};

const CONNECTOR_STATUS_LABEL: Record<ConnectorItem['status'], string> = {
  active: 'Active',
  syncing: 'Syncing',
  error: 'Error',
  paused: 'Paused',
  disconnected: 'Disconnected',
  synced: 'Synced',
};

const CONNECTOR_BADGE_VARIANT: Record<
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

const CONNECTOR_DOT_STATUS: Record<
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

const CUSTOM_TYPES = ['mcp', 'rest', 'graphql'] as const;

function isCustomConnector(connector: ConnectorItem): boolean {
  return (CUSTOM_TYPES as readonly string[]).includes(connector.type?.toLowerCase() ?? '');
}

function formatDate(iso?: string | null): string {
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

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * `GET /connectors/mcp/builtin` answers `builtin_servers`, which `transformKeys()`
 * delivers as `builtinServers`. Both spellings are read so the two views of this
 * data cannot disagree about whether the list is empty.
 */
function readBuiltinServers(res: {
  builtinServers?: BuiltinMcpServer[];
  builtin_servers?: BuiltinMcpServer[];
}): BuiltinMcpServer[] {
  const servers = res.builtinServers ?? res.builtin_servers;
  return Array.isArray(servers) ? servers : [];
}

// ─── Catalog card ────────────────────────────────────────────────────────────

interface CatalogCardProps {
  row: CatalogRow;
  connected: boolean;
  /** A capability that is part of the runtime and has no connector row. */
  builtIn: boolean;
  connectBusy: boolean;
  onSelect: () => void;
  onConnect: () => void;
}

/**
 * A card is a list item, not a clickable div. The name region is a real button so
 * a keyboard can reach it, and the Connect control is a sibling of that button
 * rather than nested inside it: the previous markup put a `<button>` inside a
 * `<div onClick>` and relied on `stopPropagation` to keep the card from also
 * opening, which is invalid composite semantics and unreachable by keyboard.
 */
function CatalogCard({
  row,
  connected,
  builtIn,
  connectBusy,
  onSelect,
  onConnect,
}: CatalogCardProps) {
  const scopes = rowScopes(row);
  const actionCount = rowActionCount(row);

  return (
    <li className="group relative flex flex-col justify-between rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 shadow-xs hover:shadow-md">
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 w-full text-left p-4 pb-2 rounded-t-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <span className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center p-2 shrink-0 group-hover:border-primary/40 transition-colors">
            {rowIcon(row)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                {rowName(row)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="mono" size="sm">
                {rowProtocol(row)}
              </Badge>
              {row.kind === 'definition' && row.def.isTrending && (
                <Badge variant="warning" size="sm">
                  Trending
                </Badge>
              )}
              {row.kind === 'definition' && row.def.isNew && (
                <Badge variant="primary" size="sm">
                  New
                </Badge>
              )}
              {row.kind === 'app' && (
                <Badge variant="default" size="sm">
                  from Composio
                </Badge>
              )}
            </span>
          </span>
        </span>
        <span className="block text-xs text-text-secondary line-clamp-2 mt-2.5 leading-relaxed font-sans">
          {rowDescription(row)}
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border text-2xs">
        <span className="font-mono text-text-secondary truncate">
          {rowCategoryText(row) || 'Category not declared'}
        </span>
        {actionCount !== null ? (
          <span className="text-text-muted font-mono">
            {actionCount} action{actionCount === 1 ? '' : 's'} reported
          </span>
        ) : scopes.length > 0 ? (
          <span className="text-text-muted font-mono truncate max-w-[150px]">{scopes[0]}</span>
        ) : (
          <span className="text-text-muted">Scope not declared</span>
        )}
      </div>

      <div className="px-4 pb-3 flex items-center justify-end">
        {connected ? (
          <Tooltip content="A connector row for this service exists in this workspace">
            <Badge variant="success" size="sm">
              <StatusDot status="active" size="sm" />
              Connected
            </Badge>
          </Tooltip>
        ) : builtIn ? (
          <p className="text-2xs text-text-muted text-left">
            Part of the runtime. There is no connector row to connect.
          </p>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={connectBusy}
            onClick={onConnect}
            // Without this every card contributes a button named "Connect", which
            // is unusable with a screen reader once the list has more than one
            // row. The visible label stays "Connect".
            aria-label={`Connect ${rowName(row)}`}
            className="items-center"
          >
            <PlusIcon />
            Connect
          </Button>
        )}
      </div>
    </li>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConnectorsView({
  workspaceId,
  searchQuery = '',
  openAddTrigger,
}: ConnectorsViewProps) {
  const { toast } = useToast();
  const { connectors, isLoading: workspaceLoading, mutate } = useWorkspaceConnectors(workspaceId);

  const [activeSubTab, setActiveSubTab] = useState<'discover' | 'yours' | 'studio'>('discover');

  const [internalSearch, setInternalSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ConnectorCategory>('All');
  const [showAllConnectors, setShowAllConnectors] = useState(false);

  const [dynamicConnectors, setDynamicConnectors] = useState<ConnectorItem[]>([]);
  const [dynamicError, setDynamicError] = useState<string | null>(null);
  const [composioCatalogApps, setComposioCatalogApps] = useState<ComposioAppInfo[]>([]);
  const [composioAppsError, setComposioAppsError] = useState<string | null>(null);
  /**
   * Null until a response actually supplies a number. The previous default of
   * 1553 was rendered in the tab switcher as a live directory size and appeared
   * in every screenshot, including the ones taken with Composio switched off.
   */
  const [composioTotalCount, setComposioTotalCount] = useState<number | null>(null);
  const [composioEnabled, setComposioEnabled] = useState<boolean | null>(null);
  const [builtinServers, setBuiltinServers] = useState<BuiltinMcpServer[]>([]);
  const [builtinError, setBuiltinError] = useState<string | null>(null);
  const [composioSyncing, setComposioSyncing] = useState(false);
  const [loadingDynamic, setLoadingDynamic] = useState(true);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [syncBusyId, setSyncBusyId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  useEffect(() => {
    if (openAddTrigger && openAddTrigger > 0) setIsAddModalOpen(true);
  }, [openAddTrigger]);

  const [selectedItemDetails, setSelectedItemDetails] = useState<CatalogRow | null>(null);
  const [pendingProvider, setPendingProvider] = useState<ConnectorProvider | null>(null);
  const [healthTarget, setHealthTarget] = useState<ConnectorHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState<{
    id: string;
    name: string;
    isWorkspaceIntegration: boolean;
  } | null>(null);

  const [toolsModalTarget, setToolsModalTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [toolsList, setToolsList] = useState<McpToolInfo[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  const [customType, setCustomType] = useState<'mcp' | 'rest' | 'graphql'>('mcp');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customMcpTransport, setCustomMcpTransport] = useState<'stdio' | 'http'>('stdio');
  const [customCommand, setCustomCommand] = useState('');
  const [customArgs, setCustomArgs] = useState('');
  const [submittingCustom, setSubmittingCustom] = useState(false);

  const effectiveQuery = (searchQuery || internalSearch).trim().toLowerCase();

  // A real cancellation channel for the Composio completion poll, and nothing
  // else. The old `isMountedRef` duplicated what React 18 already guarantees and
  // was reset to `true` on every effect run, so cleanup ordering decided whether
  // a late resolution wrote state.
  const oauthPollRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (oauthPollRef.current !== null) window.clearTimeout(oauthPollRef.current);
    },
    [],
  );

  const loadDynamicData = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingDynamic(true);
    try {
      const [connectorsResult, composioStatusResult, composioAppsResult, builtinResult] =
        await Promise.allSettled([
          connectorsApi.list(workspaceId),
          connectorsApi.composio.status(),
          connectorsApi.composio.apps({ limit: 500 }),
          connectorsApi.mcp.builtin(),
        ]);

      if (connectorsResult.status === 'fulfilled') {
        setDynamicConnectors(Array.isArray(connectorsResult.value) ? connectorsResult.value : []);
        setDynamicError(null);
      } else {
        setDynamicConnectors([]);
        setDynamicError(
          errorText(connectorsResult.reason, 'The connector list could not be read.'),
        );
      }

      if (composioStatusResult.status === 'fulfilled') {
        const status: ComposioStatusResponse = composioStatusResult.value;
        setComposioEnabled(status.enabled === true);
        const total = status.totalApps ?? status.total_apps;
        setComposioTotalCount(typeof total === 'number' && Number.isFinite(total) ? total : null);
      } else {
        setComposioEnabled(null);
        setComposioTotalCount(null);
      }

      if (composioAppsResult.status === 'fulfilled') {
        const payload: ComposioAppsResponse = composioAppsResult.value;
        setComposioCatalogApps(Array.isArray(payload?.apps) ? payload.apps : []);
        setComposioAppsError(null);
        const total = payload?.total;
        if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
          setComposioTotalCount(total);
        }
      } else {
        setComposioCatalogApps([]);
        setComposioAppsError(
          errorText(composioAppsResult.reason, 'The Composio app catalog could not be read.'),
        );
      }

      if (builtinResult.status === 'fulfilled') {
        setBuiltinServers(readBuiltinServers(builtinResult.value));
        setBuiltinError(null);
      } else {
        setBuiltinServers([]);
        setBuiltinError(
          errorText(builtinResult.reason, 'The built-in MCP catalog could not be read.'),
        );
      }
    } finally {
      setLoadingDynamic(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadDynamicData();
  }, [loadDynamicData]);

  const byProvider = useMemo(
    () =>
      new Map<string, Connector>(connectors.map((connector) => [connector.provider, connector])),
    [connectors],
  );

  /**
   * "Connected" means a connector row exists. The previous implementation
   * returned `true` for every `provider === 'native'` row with a comment
   * claiming sovereign services are embedded, which painted a hardcoded
   * "Connected" pill on a capability the connectors table says nothing about.
   */
  const isRowConnected = useCallback(
    (row: CatalogRow): boolean => {
      const provider = rowProvider(row);
      if (provider === 'native') return false;

      if (provider === 'mcp') {
        if (row.kind === 'definition' && row.def.mcpServerId === 'job-search-mcp') {
          return dynamicConnectors.some(
            (connector) =>
              connector.type === 'mcp' &&
              (connector.name?.toLowerCase().includes('job-search') === true ||
                connector.name?.toLowerCase().includes('ats') === true),
          );
        }
        return dynamicConnectors.some(
          (connector) =>
            connector.type === 'mcp' &&
            connector.name?.toLowerCase() === rowName(row).toLowerCase(),
        );
      }

      if (provider === 'composio') {
        const appName = (rowComposioApp(row) ?? rowId(row).replace('composio-', '')).toLowerCase();
        return dynamicConnectors.some(
          (connector) =>
            (connector.name && connector.name.toLowerCase() === appName) ||
            connector.config?.['app'] === appName,
        );
      }

      const existing = byProvider.get(provider);
      return Boolean(existing && existing.status === 'connected');
    },
    [byProvider, dynamicConnectors],
  );

  /**
   * The bundled catalog plus whatever the Composio catalog returned at runtime,
   * each row keeping only the fields its own source supplied.
   */
  const fullCatalogList = useMemo<CatalogRow[]>(() => {
    const rows: CatalogRow[] = [];
    const seen = new Set<string>();
    for (const def of AUTHORITATIVE_CATALOG) {
      const key = def.id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ kind: 'definition', def });
    }

    for (const app of composioCatalogApps) {
      const label = (app.name || app.id || '').toLowerCase();
      if (!label) continue;
      const slug = (app.id || app.name || '').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      if (!slug || seen.has(slug) || seen.has(`composio-${slug}`) || seen.has(label)) continue;
      seen.add(slug);
      seen.add(`composio-${slug}`);
      seen.add(label);
      rows.push({ kind: 'app', app, slug });
    }

    return rows;
  }, [composioCatalogApps]);

  const activeCategoryFilter = useMemo<CategoryFilter>(
    () => CATEGORY_FILTERS.find((filter) => filter.id === selectedFilter) ?? ALL_CATEGORY_FILTER,
    [selectedFilter],
  );

  const filteredCatalog = useMemo(() => {
    return fullCatalogList.filter((row) => {
      if (!matchesCategory(row, activeCategoryFilter)) return false;
      if (!effectiveQuery) return true;
      return rowSearchText(row).includes(effectiveQuery);
    });
  }, [activeCategoryFilter, effectiveQuery, fullCatalogList]);

  const topConnectors = useMemo(() => fullCatalogList.filter(rowIsTop), [fullCatalogList]);
  const otherConnectors = useMemo(
    () => fullCatalogList.filter((row) => !rowIsTop(row)),
    [fullCatalogList],
  );

  const handleInitiateConnect = useCallback(
    (row: CatalogRow) => {
      const provider = rowProvider(row);

      if (provider === 'native') {
        toast({
          tone: 'info',
          title: 'No connector needed',
          detail: `${rowName(row)} runs inside the Vaeloom runtime. The connectors table holds no row for it, so there is nothing to connect.`,
        });
        return;
      }

      if (provider === 'mcp') {
        if (row.kind === 'definition' && row.def.mcpServerId === 'job-search-mcp') {
          void handleAttachAtsMcp();
          return;
        }
        setCustomType('mcp');
        setCustomName(rowName(row));
        setIsAddModalOpen(true);
        return;
      }

      if (provider === 'composio') {
        const appName = rowComposioApp(row);
        if (!appName) {
          toast({
            tone: 'error',
            title: 'No app id from the catalog',
            detail: `${rowName(row)} came back without an app id, so an OAuth request cannot be built for it.`,
          });
          return;
        }
        void handleComposioOAuth(appName, rowName(row));
        return;
      }

      setPendingProvider(provider as ConnectorProvider);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  const handleExecuteConnect = useCallback(
    async (provider: ConnectorProvider) => {
      const meta = PROVIDER_META[provider];
      setBusyAction(`connect-${provider}`);
      try {
        const composioApp = COMPOSIO_EQUIVALENTS[provider];
        if (
          composioApp &&
          composioCatalogApps.some(
            (app) => (app.id || app.name || '').toLowerCase() === composioApp,
          )
        ) {
          await handleComposioOAuth(composioApp, meta?.name ?? provider);
          setPendingProvider(null);
          return;
        }
        await api.integrations.create({ name: meta?.name ?? provider, provider });
        await mutate();
        toast({
          tone: 'info',
          title: 'Connector registered',
          detail: `${meta?.name ?? provider} registered. The provider's own consent screen decides the scopes; add credentials before agents can use it.`,
        });
        setPendingProvider(null);
        void loadDynamicData();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Connect failed',
          detail: errorText(err, 'The registration request failed.'),
        });
      } finally {
        setBusyAction(null);
      }
    },
    // handleComposioOAuth is declared below and only reached after render, so it
    // is a legitimate forward reference (same pattern as handleOpenOrConnect).
    // Listing it here would be a temporal-dead-zone use-before-declaration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [composioCatalogApps, loadDynamicData, mutate, toast],
  );

  const handleAttachAtsMcp = useCallback(async () => {
    if (!workspaceId) return;
    setBusyAction('attach-ats-mcp');
    try {
      const builtinRes = await connectorsApi.mcp.builtin();
      const servers = readBuiltinServers(builtinRes);
      const server = servers.find((entry) => entry.id === 'job-search-mcp') ?? servers[0];
      if (!server) throw new Error('GET /connectors/mcp/builtin returned no server definitions.');

      const created = await connectorsApi.create({
        name: server.name,
        type: 'mcp',
        workspace_id: workspaceId,
        config: server.config,
      });

      try {
        const res = await connectorsApi.mcp.sync(created.id, workspaceId);
        const bridged = res?.registered?.length ?? 0;
        toast({
          tone: 'success',
          title: 'ATS MCP attached',
          detail: `${server.name} created and ${bridged} tool(s) bridged.`,
        });
      } catch (syncErr) {
        toast({
          tone: 'warning',
          title: 'ATS MCP created, not bridged',
          detail: `The connector row exists but tool registration failed: ${errorText(syncErr, 'unknown error')}`,
        });
      }

      void loadDynamicData();
      await mutate();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Attachment Failed',
        detail: errorText(err, 'Could not attach the MCP server.'),
      });
    } finally {
      setBusyAction(null);
    }
  }, [loadDynamicData, mutate, toast, workspaceId]);

  /**
   * Composio hands the consent screen to the provider, so the browser window is
   * the only way to complete it. The previous version opened the window and
   * immediately told the user the connection was in progress, and nothing ever
   * checked again, so "Connected" could never appear on its own. This polls the
   * connector list the view already depends on and reports what it actually saw.
   */
  const handleComposioOAuth = useCallback(
    async (appId: string, appName: string) => {
      if (!workspaceId) return;
      setBusyAction(`composio-${appId}`);
      try {
        const res = await connectorsApi.composio.authUrl(appId, workspaceId);
        const url = res.auth_url || res.authUrl || res.url;
        if (res.status === 'error' || !url) {
          toast({
            tone: 'error',
            title:
              res.error_code === 'COMPOSIO_INVALID_API_KEY' ||
              res.errorCode === 'COMPOSIO_INVALID_API_KEY'
                ? 'Invalid Composio key'
                : res.error_code === 'COMPOSIO_INSUFFICIENT_PERMISSIONS' ||
                    res.errorCode === 'COMPOSIO_INSUFFICIENT_PERMISSIONS'
                  ? 'Key is missing write permission'
                  : 'Could not start authorization',
            detail:
              res.message ||
              'Composio did not return an authorization URL. Check COMPOSIO_API_KEY in the API environment.',
          });
          return;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
        toast({
          tone: 'info',
          title: 'Authorization opened',
          detail: `Finish the consent screen for ${appName} in the other window. This tab checks for the resulting connector for about a minute.`,
        });

        if (oauthPollRef.current !== null) window.clearTimeout(oauthPollRef.current);
        const appKey = appId.toLowerCase();
        let attemptsLeft = 12;
        const poll = async (): Promise<void> => {
          attemptsLeft -= 1;
          try {
            const rows = await connectorsApi.list(workspaceId);
            const landed = (Array.isArray(rows) ? rows : []).some(
              (connector) =>
                (connector.name ?? '').toLowerCase() === appKey ||
                (connector.config?.['app'] ?? '').toString().toLowerCase() === appKey,
            );
            if (landed) {
              await loadDynamicData();
              toast({
                tone: 'success',
                title: `${appName} connected`,
                detail: 'A connector row for this app now exists in this workspace.',
              });
              return;
            }
          } catch {
            // A failed poll is not a failed connection; the loop keeps trying
            // until it runs out and then says the state is unconfirmed.
          }
          if (attemptsLeft <= 0) {
            toast({
              tone: 'warning',
              title: 'Connection not confirmed',
              detail: `No connector row for ${appName} appeared within a minute. If you finished the consent screen, reload this tab to pick it up.`,
            });
            return;
          }
          oauthPollRef.current = window.setTimeout(() => void poll(), 5000);
        };
        oauthPollRef.current = window.setTimeout(() => void poll(), 5000);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Auth failed',
          detail: errorText(err, 'Could not generate an OAuth authorization URL.'),
        });
      } finally {
        setBusyAction(null);
      }
    },
    [loadDynamicData, toast, workspaceId],
  );

  const handleSyncAllComposio = useCallback(async () => {
    if (!workspaceId) return;
    setComposioSyncing(true);
    try {
      const res = await connectorsApi.composio.sync(workspaceId);
      const count = res?.count ?? res?.registered?.length ?? 0;
      toast({
        tone: 'success',
        title: 'Composio tools synced',
        detail: `The server registered ${count} tool(s) into the dynamic agent router.`,
      });
      void loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync Failed',
        detail: errorText(err, 'Composio sync failed.'),
      });
    } finally {
      setComposioSyncing(false);
    }
  }, [loadDynamicData, toast, workspaceId]);

  const handleSyncWorkspace = useCallback(
    async (connector: Connector) => {
      if (!workspaceId) return;
      setSyncBusyId(connector.id);
      setBusyAction(`sync-${connector.id}`);
      try {
        try {
          await temporalApi.startConnectorSync({
            workspace_id: workspaceId,
            connector_id: connector.id,
            sync_token: connector.id.slice(0, 8),
          });
          toast({
            tone: 'success',
            title: 'Durable sync started',
            detail: 'A Temporal workflow is running for this connector.',
          });
        } catch (err) {
          const status = (err as { status?: number } | null)?.status;
          if (status !== 503 && !errorText(err, '').includes('503')) throw err;
          const res = (await api.integrations.sync(connector.id)) as { message?: string };
          toast({
            tone: 'success',
            title: 'Sync started',
            detail: res?.message ?? 'Sync requested.',
          });
        }
        await mutate();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Sync failed',
          detail: errorText(err, 'The sync did not start.'),
        });
      } finally {
        setBusyAction(null);
        setSyncBusyId(null);
      }
    },
    [mutate, toast, workspaceId],
  );

  const handleDynamicSync = useCallback(
    async (connId: string) => {
      setBusyAction(`dyn-sync-${connId}`);
      try {
        const res = await connectorsApi.sync(connId);
        if (res.status === 'syncing' && res.error?.includes('in progress')) {
          toast({
            tone: 'info',
            title: 'Sync in Progress',
            detail: 'A sync task is already running.',
          });
        } else {
          toast({
            tone: 'success',
            title: 'Sync Completed',
            detail: res.synced_at ? `Synced at ${res.synced_at}` : 'Sync completed successfully.',
          });
        }
        void loadDynamicData();
      } catch (err) {
        toast({ tone: 'error', title: 'Sync Failed', detail: errorText(err, 'The sync failed.') });
      } finally {
        setBusyAction(null);
      }
    },
    [loadDynamicData, toast],
  );

  const handleTestConnection = useCallback(
    async (connId: string) => {
      setBusyAction(`test-${connId}`);
      try {
        // POST /connectors/{id}/test. This is the real diagnostic; the previous
        // "Ping" on a workspace integration skipped it and toasted a hardcoded
        // "Health 200 OK" for a request that was never made.
        const res = await connectorsApi.test(connId);
        if (res.status === 'success') {
          toast({
            tone: 'success',
            title: 'Connection Healthy',
            detail: res.message || `The endpoint answered ${res.code ?? 200}.`,
          });
        } else {
          toast({
            tone: 'warning',
            title: 'Connection Issue',
            detail: res.error || `The endpoint answered ${res.code ?? 'a non-success status'}.`,
          });
        }
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Diagnostic Test Failed',
          detail: errorText(err, 'The connector endpoint was unreachable.'),
        });
      } finally {
        setBusyAction(null);
      }
    },
    [toast],
  );

  const handleOpenHealthModal = useCallback(
    async (connId: string) => {
      setHealthLoading(true);
      setHealthTarget(null);
      try {
        setHealthTarget(await connectorsApi.health(connId));
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Health Check Failed',
          detail: errorText(err, 'Could not read connector health.'),
        });
      } finally {
        setHealthLoading(false);
      }
    },
    [toast],
  );

  const handleInspectTools = useCallback(
    async (connId: string, name: string) => {
      setToolsModalTarget({ id: connId, name });
      setToolsLoading(true);
      try {
        const res = await connectorsApi.mcp.listTools(connId);
        setToolsList(Array.isArray(res) ? res : []);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Failed to inspect tools',
          detail: errorText(err, 'Could not list MCP tools.'),
        });
        setToolsList([]);
      } finally {
        setToolsLoading(false);
      }
    },
    [toast],
  );

  const confirmDisconnect = useCallback(async () => {
    if (!pendingDisconnect) return;
    const target = pendingDisconnect;
    setBusyAction(`disconnect-${target.id}`);
    try {
      if (target.isWorkspaceIntegration) {
        await api.integrations.delete(target.id);
        await mutate();
      } else {
        await connectorsApi.delete(target.id);
        void loadDynamicData();
      }
      toast({ tone: 'success', title: 'Disconnected', detail: `${target.name} was unlinked.` });
      setPendingDisconnect(null);
      setSelectedItemDetails(null);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Disconnect Failed',
        detail: errorText(err, 'The connector was not removed.'),
      });
    } finally {
      setBusyAction(null);
    }
  }, [loadDynamicData, mutate, pendingDisconnect, toast]);

  const handleCreateCustomConnector = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!customName.trim() || !workspaceId) return;

      setSubmittingCustom(true);
      const config: Record<string, unknown> = {};
      try {
        if (customType === 'mcp') {
          config['transport'] = customMcpTransport;
          if (customMcpTransport === 'stdio') {
            const command = customCommand.trim();
            if (!command) throw new Error('A stdio MCP server needs the executable to run.');
            config['command'] = command;
            config['args'] = customArgs
              .split(/\s+/)
              .map((part) => part.trim())
              .filter(Boolean);
          } else {
            const url = customUrl.trim();
            if (!url) throw new Error('A streamable-HTTP MCP server needs a URL.');
            config['url'] = url;
          }
        } else {
          const url = customUrl.trim();
          if (!url) throw new Error('A REST or GraphQL connector needs a base URL.');
          config['base_url'] = url;
          if (customApiKey.trim()) config['api_key'] = customApiKey.trim();
        }

        const created = await connectorsApi.create({
          name: customName.trim(),
          type: customType,
          workspace_id: workspaceId,
          config,
        });

        if (customType === 'mcp') {
          try {
            await connectorsApi.mcp.sync(created.id, workspaceId);
          } catch (syncErr) {
            toast({
              tone: 'warning',
              title: 'Connector created, tools not registered',
              detail: `The row exists but the MCP bridge failed: ${errorText(syncErr, 'unknown error')}`,
            });
          }
        }

        toast({
          tone: 'success',
          title: 'Connector Registered',
          detail: `${customName.trim()} was written to this workspace.`,
        });

        setIsAddModalOpen(false);
        setCustomName('');
        setCustomUrl('');
        setCustomApiKey('');
        setCustomCommand('');
        setCustomArgs('');
        void loadDynamicData();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Registration Failed',
          detail: errorText(err, 'The connector was not written.'),
        });
      } finally {
        setSubmittingCustom(false);
      }
    },
    [
      customApiKey,
      customArgs,
      customCommand,
      customMcpTransport,
      customName,
      customType,
      customUrl,
      loadDynamicData,
      toast,
      workspaceId,
    ],
  );

  const configuredItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      provider?: string;
      type: string;
      status: ConfiguredStatus;
      lastSync?: string;
      isWorkspaceIntegration: boolean;
      originalConnector?: Connector;
      config?: Record<string, unknown>;
    }> = [];

    connectors.forEach((connector) => {
      const providerKey = (connector.provider || '').toLowerCase();
      const meta = PROVIDER_META[providerKey];
      const resolvedName =
        (connector as unknown as { name?: string }).name?.trim() ||
        meta?.name ||
        (connector.provider
          ? connector.provider.charAt(0).toUpperCase() + connector.provider.slice(1)
          : 'Connected Service');
      const status: ConfiguredStatus =
        connector.status === 'connected'
          ? 'active'
          : connector.status === 'syncing'
            ? 'syncing'
            : connector.status === 'disconnected'
              ? 'disconnected'
              : 'error';
      list.push({
        id: connector.id,
        name: resolvedName,
        provider: connector.provider,
        type: 'OAuth 2.0',
        status,
        lastSync: connector.lastSyncAt,
        isWorkspaceIntegration: true,
        originalConnector: connector,
        config: (connector as unknown as { config?: Record<string, unknown> })?.config,
      });
    });

    dynamicConnectors.forEach((dynamic) => {
      const status: ConfiguredStatus =
        dynamic.status === 'syncing'
          ? 'syncing'
          : dynamic.status === 'paused'
            ? 'paused'
            : dynamic.status === 'error'
              ? 'error'
              : 'active';
      list.push({
        id: dynamic.id,
        name: dynamic.name,
        provider: dynamic.type,
        type: dynamic.type.toUpperCase(),
        status,
        lastSync: dynamic.updatedAt,
        isWorkspaceIntegration: false,
        config: dynamic.config,
      });
    });

    return list;
  }, [connectors, dynamicConnectors]);

  const customConnectors = useMemo(
    () => dynamicConnectors.filter(isCustomConnector),
    [dynamicConnectors],
  );

  if (workspaceLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text antialiased overflow-hidden">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans px-4 sm:px-6 py-2.5 shrink-0">
          Connectors Studio
        </h2>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner text="Loading connectors..." />
        </div>
      </div>
    );
  }

  const discoverFilterActive =
    showAllConnectors || Boolean(effectiveQuery) || selectedFilter !== 'All';

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text antialiased overflow-hidden">
      <div className="border-b border-border bg-surface px-4 sm:px-6 py-2.5 shrink-0 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans">
            Connectors Studio
          </h2>

          <div
            role="tablist"
            aria-label="Connector view"
            className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-elevated border border-border overflow-x-auto no-scrollbar shrink-0"
          >
            {(
              [
                { id: 'discover', label: 'Explore Directory', badge: composioTotalCount },
                { id: 'yours', label: 'Installed', badge: configuredItems.length || null },
                { id: 'studio', label: 'Custom Protocols', badge: null },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeSubTab === tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeSubTab === tab.id
                    ? 'bg-action text-action-fg font-semibold shadow-xs'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
                {tab.badge !== null && tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-2xs font-mono border ${
                      activeSubTab === tab.id
                        ? 'bg-black/30 text-white border-white/20'
                        : tab.id === 'yours'
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-surface-elevated text-text-secondary border-border'
                    }`}
                  >
                    {tab.id === 'discover' && composioEnabled === false
                      ? 'Composio off'
                      : tab.badge.toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              loading={composioSyncing}
              onClick={() => void handleSyncAllComposio()}
            >
              {composioSyncing ? 'Syncing SaaS...' : 'Sync SaaS Tools'}
            </Button>
            <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
              <PlusIcon />
              Add Custom Connector
            </Button>
          </div>
        </div>
      </div>

      <div
        aria-label="Connector workspace"
        aria-busy={loadingDynamic}
        className="flex-1 overflow-y-auto overscroll-y-contain px-4 sm:px-6 lg:px-8 py-5 pb-16 min-h-0 min-w-0 bg-background"
      >
        {activeSubTab === 'discover' ? (
          <div className="max-w-7xl mx-auto space-y-6 min-w-0">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-border pb-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Curated catalog
                </span>
                <span className="text-xs text-text-secondary">
                  Showing {filteredCatalog.length} of {fullCatalogList.length}
                </span>
                {composioEnabled === false && (
                  <Badge variant="warning" size="sm">
                    Composio is switched off on the server
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="w-full sm:w-64">
                  <SearchField
                    value={internalSearch}
                    onChange={setInternalSearch}
                    onClear={() => setInternalSearch('')}
                    placeholder="Search this directory"
                    aria-label="Search connectors in this directory"
                    className="text-xs"
                  />
                </div>
                <div className="relative shrink-0">
                  <label htmlFor="connector-category" className="sr-only">
                    Filter connectors by sector
                  </label>
                  <select
                    id="connector-category"
                    value={selectedFilter}
                    onChange={(event) => setSelectedFilter(event.target.value as ConnectorCategory)}
                    className="appearance-none bg-surface-elevated border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer font-sans"
                  >
                    {CATEGORY_FILTERS.map((filter) => (
                      <option key={filter.id} value={filter.id}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    aria-hidden="true"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
            </div>

            <div
              role="group"
              aria-label="Quick sector filters"
              className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs min-w-0 w-full"
            >
              {CATEGORY_FILTERS.filter((filter) => CATEGORY_ICONS[filter.id]).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={selectedFilter === filter.id}
                  onClick={() => setSelectedFilter(filter.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    selectedFilter === filter.id
                      ? 'bg-action text-action-fg shadow-xs font-semibold'
                      : 'bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text border border-border'
                  }`}
                >
                  <span
                    className={selectedFilter === filter.id ? 'text-action-fg' : 'text-text-muted'}
                  >
                    {CATEGORY_ICONS[filter.id]}
                  </span>
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>

            {composioAppsError && (
              <ErrorState
                title="Composio catalog unavailable"
                message={composioAppsError}
                onRetry={() => void loadDynamicData()}
                actionText="Try again"
              />
            )}

            {discoverFilterActive ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2 gap-3">
                  <h3 className="text-sm font-semibold text-text">
                    {effectiveQuery
                      ? `Search results (${filteredCatalog.length})`
                      : selectedFilter !== 'All'
                        ? `${activeCategoryFilter.label} (${filteredCatalog.length})`
                        : `All connectors (${filteredCatalog.length})`}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAllConnectors(false);
                      setInternalSearch('');
                      setSelectedFilter('All');
                    }}
                  >
                    Back to featured
                  </Button>
                </div>

                {filteredCatalog.length === 0 ? (
                  <EmptyState
                    title="Nothing matches"
                    description="No connector in the catalog matches this sector and search. Clear the filters to see the full list."
                    action={{
                      label: 'Clear filters',
                      onClick: () => {
                        setInternalSearch('');
                        setSelectedFilter('All');
                      },
                    }}
                  />
                ) : (
                  <ul
                    role="list"
                    className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5"
                  >
                    {filteredCatalog.map((row) => (
                      <CatalogCard
                        key={rowId(row)}
                        row={row}
                        connected={isRowConnected(row)}
                        builtIn={rowProvider(row) === 'native'}
                        connectBusy={busyAction === `composio-${rowComposioApp(row) ?? ''}`}
                        onSelect={() => setSelectedItemDetails(row)}
                        onConnect={() => handleInitiateConnect(row)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-sm font-semibold text-text">
                      Top connectors ({topConnectors.length})
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowAllConnectors(true)}>
                      Show all ({fullCatalogList.length})
                    </Button>
                  </div>
                  <ul
                    role="list"
                    className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5"
                  >
                    {topConnectors.map((row) => (
                      <CatalogCard
                        key={rowId(row)}
                        row={row}
                        connected={isRowConnected(row)}
                        builtIn={rowProvider(row) === 'native'}
                        connectBusy={busyAction === `composio-${rowComposioApp(row) ?? ''}`}
                        onSelect={() => setSelectedItemDetails(row)}
                        onConnect={() => handleInitiateConnect(row)}
                      />
                    ))}
                  </ul>
                </div>

                {otherConnectors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h3 className="text-sm font-semibold text-text">
                        More integrations &amp; dynamic toolkits ({otherConnectors.length})
                      </h3>
                    </div>
                    <ul
                      role="list"
                      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5"
                    >
                      {otherConnectors.map((row) => (
                        <CatalogCard
                          key={rowId(row)}
                          row={row}
                          connected={isRowConnected(row)}
                          builtIn={rowProvider(row) === 'native'}
                          connectBusy={busyAction === `composio-${rowComposioApp(row) ?? ''}`}
                          onSelect={() => setSelectedItemDetails(row)}
                          onConnect={() => handleInitiateConnect(row)}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeSubTab === 'studio' ? (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-base font-semibold text-text tracking-tight">
                  Custom protocol builder
                </h3>
                <p className="text-xs text-text-secondary max-w-2xl mt-1 leading-relaxed">
                  Register Model Context Protocol servers over stdio or streamable HTTP, plus
                  enterprise REST and GraphQL endpoints. The command or URL you enter here is
                  exactly what will be executed or contacted.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                <PlusIcon />
                Add Custom Connector
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  {
                    type: 'mcp' as const,
                    title: 'Model Context Protocol (MCP)',
                    body: 'Connect a local subprocess over stdio, or a remote streamable-HTTP endpoint. Tools are discovered from the server itself.',
                  },
                  {
                    type: 'rest' as const,
                    title: 'Enterprise REST API',
                    body: 'Point agents at an internal HTTP API. A base URL is required; a key is optional.',
                  },
                  {
                    type: 'graphql' as const,
                    title: 'GraphQL endpoint',
                    body: 'Point agents at a GraphQL endpoint by URL. Schemas are not introspected from here.',
                  },
                ] as const
              ).map((card) => (
                <div
                  key={card.type}
                  className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-text">{card.title}</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{card.body}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomType(card.type);
                      setIsAddModalOpen(true);
                    }}
                  >
                    Add{' '}
                    {card.type === 'mcp'
                      ? 'MCP server'
                      : card.type === 'rest'
                        ? 'REST connector'
                        : 'GraphQL endpoint'}
                  </Button>
                </div>
              ))}
            </div>

            <section aria-labelledby="builtin-mcp-heading" className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2 gap-3 flex-wrap">
                <div>
                  <h3 id="builtin-mcp-heading" className="text-sm font-semibold text-text">
                    Built-in MCP servers
                  </h3>
                  <p className="text-xs text-text-muted">
                    Served by this API from{' '}
                    <code className="font-mono">GET /connectors/mcp/builtin</code>. Each entry runs
                    this deployment&apos;s own interpreter; nothing is downloaded.
                  </p>
                </div>
                <span className="text-xs font-mono text-text-secondary">
                  {builtinServers.length} declared
                </span>
              </div>

              {builtinError ? (
                <ErrorState
                  title="Built-in catalog unavailable"
                  message={builtinError}
                  onRetry={() => void loadDynamicData()}
                  actionText="Try again"
                />
              ) : builtinServers.length === 0 ? (
                <EmptyState
                  title="No built-in servers declared"
                  description="The API answered with an empty built-in MCP catalog."
                />
              ) : (
                <div
                  role="table"
                  aria-label="Built-in MCP servers"
                  className="rounded-xl border border-border overflow-hidden"
                >
                  <div role="rowgroup">
                    <div
                      role="row"
                      className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2 bg-surface-elevated border-b border-border text-2xs font-mono uppercase tracking-wider text-text-muted"
                    >
                      <span role="columnheader">Server</span>
                      <span role="columnheader">Transport</span>
                      <span role="columnheader">Declared tools</span>
                      <span role="columnheader" className="md:text-right">
                        Action
                      </span>
                    </div>
                  </div>
                  <div role="rowgroup">
                    {builtinServers.map((server) => (
                      <div
                        key={server.id}
                        role="row"
                        className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2.5 border-b border-border-subtle last:border-b-0"
                      >
                        <span role="cell" className="min-w-0">
                          <span className="block text-xs font-semibold text-text">
                            {server.name}
                          </span>
                          <span className="block text-2xs text-text-muted line-clamp-2">
                            {server.description}
                          </span>
                        </span>
                        <span role="cell">
                          <Badge variant="mono" size="sm">
                            {server.transport}
                          </Badge>
                        </span>
                        <span role="cell" className="text-2xs text-text-secondary">
                          {Array.isArray(server.tools) && server.tools.length > 0
                            ? server.tools.join(', ')
                            : 'None declared'}
                        </span>
                        <span role="cell" className="md:text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busyAction === `composio-${server.id}`}
                            onClick={() => {
                              setBusyAction(`composio-${server.id}`);
                              setCustomType('mcp');
                              setCustomName(server.name);
                              setCustomMcpTransport('stdio');
                              setCustomCommand(String(server.config?.['command'] ?? ''));
                              setCustomArgs(
                                Array.isArray(server.config?.['args'])
                                  ? server.config['args'].map((arg) => String(arg)).join(' ')
                                  : '',
                              );
                              setIsAddModalOpen(true);
                              setBusyAction(null);
                            }}
                          >
                            Configure
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section aria-labelledby="custom-connectors-heading" className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 id="custom-connectors-heading" className="text-sm font-semibold text-text">
                  Custom connectors in this workspace
                </h3>
                <span className="text-xs text-text-muted font-mono">
                  {customConnectors.length} registered
                </span>
              </div>

              {dynamicError ? (
                <ErrorState
                  title="Connector list unavailable"
                  message={dynamicError}
                  onRetry={() => void loadDynamicData()}
                  actionText="Try again"
                />
              ) : customConnectors.length === 0 ? (
                <EmptyState
                  title="No custom connectors yet"
                  description="This workspace has no MCP, REST or GraphQL connector registered."
                  action={{ label: 'Add the first one', onClick: () => setIsAddModalOpen(true) }}
                />
              ) : (
                <div
                  role="table"
                  aria-label="Custom connectors in this workspace"
                  className="rounded-xl border border-border overflow-hidden"
                >
                  <div role="rowgroup">
                    <div
                      role="row"
                      className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2 bg-surface-elevated border-b border-border text-2xs font-mono uppercase tracking-wider text-text-muted"
                    >
                      <span role="columnheader">Connector</span>
                      <span role="columnheader">Protocol</span>
                      <span role="columnheader">Status</span>
                      <span role="columnheader" className="md:text-right">
                        Actions
                      </span>
                    </div>
                  </div>
                  <div role="rowgroup">
                    {customConnectors.map((conn) => (
                      <div
                        key={conn.id}
                        role="row"
                        className="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 py-2.5 border-b border-border-subtle last:border-b-0"
                      >
                        <span role="cell" className="min-w-0">
                          <span className="block text-xs font-semibold text-text">{conn.name}</span>
                          <span className="block text-2xs font-mono text-text-muted truncate">
                            {conn.id}
                          </span>
                        </span>
                        <span role="cell">
                          <Badge variant="mono" size="sm">
                            {conn.type.toUpperCase()}
                          </Badge>
                        </span>
                        <span role="cell">
                          <Badge variant={CONNECTOR_BADGE_VARIANT[conn.status]} size="sm">
                            <StatusDot status={CONNECTOR_DOT_STATUS[conn.status]} size="sm" />
                            {CONNECTOR_STATUS_LABEL[conn.status] ?? conn.status}
                          </Badge>
                        </span>
                        <span
                          role="cell"
                          className="md:text-right flex flex-wrap gap-1.5 justify-end"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            loading={busyAction === `test-${conn.id}`}
                            onClick={() => void handleTestConnection(conn.id)}
                          >
                            Ping Health
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={healthLoading}
                            onClick={() => void handleOpenHealthModal(conn.id)}
                          >
                            Details
                          </Button>
                          {conn.type?.toLowerCase() === 'mcp' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleInspectTools(conn.id, conn.name)}
                            >
                              Tools
                            </Button>
                          )}
                          <IconButton
                            aria-label={`Remove ${conn.name}`}
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger/80"
                            onClick={() =>
                              setPendingDisconnect({
                                id: conn.id,
                                name: conn.name,
                                isWorkspaceIntegration: false,
                              })
                            }
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </IconButton>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3 gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-text font-sans flex items-center gap-2">
                Configured in this workspace
                <Badge variant="success" size="sm">
                  {configuredItems.length} row{configuredItems.length === 1 ? '' : 's'}
                </Badge>
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveSubTab('discover')}>
                Browse Directory
              </Button>
            </div>

            {configuredItems.length === 0 ? (
              <EmptyState
                title="No connectors configured"
                description="Nothing is registered in this workspace yet. Start from the directory, or build a custom protocol."
                action={{
                  label: 'Discover connectors',
                  onClick: () => setActiveSubTab('discover'),
                }}
              />
            ) : (
              <ul role="list" className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
                {configuredItems.map((item) => {
                  const isSyncing = syncBusyId === item.id || busyAction === `sync-${item.id}`;
                  const displayName =
                    item.name?.trim() || item.provider?.toUpperCase() || 'Custom Connector';
                  return (
                    <li
                      key={item.id}
                      className="group relative flex flex-col justify-between rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 shadow-xs hover:shadow-md space-y-3.5 p-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                              {displayName}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Badge variant="mono" size="sm">
                                {item.type}
                              </Badge>
                            </div>
                          </div>
                          <Tooltip
                            content={`Reported status: ${CONFIGURED_STATUS_META[item.status].label}`}
                          >
                            <Badge
                              variant={
                                item.status === 'active'
                                  ? 'success'
                                  : item.status === 'syncing'
                                    ? 'warning'
                                    : item.status === 'error'
                                      ? 'error'
                                      : 'default'
                              }
                              size="sm"
                            >
                              <StatusDot
                                status={CONFIGURED_STATUS_META[item.status].dot}
                                pulse={isSyncing}
                                size="sm"
                              />
                              {CONFIGURED_STATUS_META[item.status].label}
                            </Badge>
                          </Tooltip>
                        </div>

                        <div className="flex items-center justify-between text-2xs text-text-muted font-mono pt-2">
                          <span>Last synced</span>
                          <span className="text-text-secondary">{formatDate(item.lastSync)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-border gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            loading={isSyncing}
                            onClick={() => {
                              if (item.isWorkspaceIntegration && item.originalConnector) {
                                void handleSyncWorkspace(item.originalConnector);
                              } else {
                                void handleDynamicSync(item.id);
                              }
                            }}
                          >
                            Sync Now
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={busyAction === `test-${item.id}`}
                            onClick={() => void handleTestConnection(item.id)}
                          >
                            Ping
                          </Button>
                          {item.type.includes('MCP') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleInspectTools(item.id, item.name)}
                            >
                              Tools
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger/80"
                          onClick={() =>
                            setPendingDisconnect({
                              id: item.id,
                              name: item.name,
                              isWorkspaceIntegration: item.isWorkspaceIntegration,
                            })
                          }
                        >
                          Disconnect
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Connector detail ───────────────────────────────────────────────── */}
      {selectedItemDetails && (
        <Modal
          isOpen
          onClose={() => setSelectedItemDetails(null)}
          title={`Connector: ${rowName(selectedItemDetails)}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated border border-border">
              <div className="shrink-0">{rowIcon(selectedItemDetails)}</div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-text">
                  {rowName(selectedItemDetails)}
                </span>
                <p className="text-text-muted mt-0.5">{rowDescription(selectedItemDetails)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-text block">Permissions</h4>
              {rowScopes(selectedItemDetails).length > 0 ? (
                <>
                  <p className="text-2xs text-text-muted">
                    Notes shipped with this build&apos;s catalog. They are not read from the
                    provider, and they are not what an OAuth consent screen will display.
                  </p>
                  <ul className="space-y-1.5 font-mono text-2xs text-text-secondary bg-surface p-3 rounded border border-border">
                    {rowScopes(selectedItemDetails).map((scope) => (
                      <li key={scope} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span>{scope}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-2xs text-text-muted bg-surface p-3 rounded border border-border">
                  This catalog entry declares no scope list. The provider&apos;s consent screen is
                  the only authority on what will be requested.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-text block">Agent assignment</h4>
              {rowAssignedAgents(selectedItemDetails).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rowAssignedAgents(selectedItemDetails).map((agent) => (
                    <Badge key={agent} variant="primary" size="sm">
                      {agent}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-2xs text-text-muted">
                  No agent assignment is declared for this entry. Nothing on this row came from a
                  server response.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setSelectedItemDetails(null)}>
                Close
              </Button>
              {isRowConnected(selectedItemDetails) ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setPendingDisconnect({
                      id: rowId(selectedItemDetails),
                      name: rowName(selectedItemDetails),
                      isWorkspaceIntegration: false,
                    });
                  }}
                >
                  Disconnect
                </Button>
              ) : rowProvider(selectedItemDetails) === 'native' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleInitiateConnect(selectedItemDetails);
                    setSelectedItemDetails(null);
                  }}
                >
                  What this means
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedItemDetails(null);
                    handleInitiateConnect(selectedItemDetails);
                  }}
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── OAuth confirmation ─────────────────────────────────────────────── */}
      {pendingProvider && (
        <Modal
          isOpen
          onClose={() => setPendingProvider(null)}
          title={`Connect ${PROVIDER_META[pendingProvider]?.name ?? pendingProvider}`}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-secondary">
              {PROVIDER_META[pendingProvider]?.intent ??
                'Authorizing this connector lets Vaeloom agents read the data you grant, and nothing more.'}
            </p>
            <div className="bg-surface-elevated p-2.5 rounded border border-border">
              <span className="text-2xs font-semibold text-text block mb-1">Scopes</span>
              <p className="text-2xs text-text-muted">
                Not known ahead of time. The provider&apos;s own consent screen decides which scopes
                are requested, and this client has not read its app registration. Read the consent
                screen before approving.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setPendingProvider(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                loading={busyAction === `connect-${pendingProvider}`}
                onClick={() => void handleExecuteConnect(pendingProvider)}
              >
                Continue to OAuth
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Health details (the endpoint the old "Ping" button never called) ── */}
      <Modal
        isOpen={healthLoading || healthTarget !== null}
        onClose={() => setHealthTarget(null)}
        title="Connector health"
        size="sm"
      >
        {healthLoading ? (
          <div
            role="status"
            aria-label="Reading connector health"
            className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted"
          >
            <Spinner size="sm" />
            <span>Reading GET /connectors/&#123;id&#125;/health...</span>
          </div>
        ) : healthTarget ? (
          <dl className="space-y-2 text-xs">
            {(
              [
                ['Connector', healthTarget.name],
                ['ID', healthTarget.connectorId],
                ['Protocol', healthTarget.type],
                ['Status', healthTarget.status],
                ['Last sync', formatDate(healthTarget.lastSyncedAt)],
                ['Auth', healthTarget.authState],
                ['Connectivity', healthTarget.connectivity],
                ['Details', healthTarget.details],
              ] as const
            ).map(([term, value]) => (
              <div
                key={term}
                className="grid grid-cols-3 gap-2 border-b border-border-subtle pb-1.5"
              >
                <dt className="text-text-muted">{term}</dt>
                <dd className="col-span-2 font-mono text-text break-all">{value}</dd>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setHealthTarget(null)}>
                Close
              </Button>
            </div>
          </dl>
        ) : null}
      </Modal>

      {/* ── Add custom connector ───────────────────────────────────────────── */}
      {isAddModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsAddModalOpen(false)}
          title="Add custom connector"
          size="md"
        >
          <form onSubmit={handleCreateCustomConnector} className="space-y-4 text-xs">
            <div role="group" aria-label="Connector protocol">
              <span className="block text-text-secondary mb-1 font-medium">Connector protocol</span>
              <div className="grid grid-cols-3 gap-2">
                {(['mcp', 'rest', 'graphql'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={customType === type}
                    onClick={() => setCustomType(type)}
                    className={`py-1.5 px-2 rounded border text-center font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      customType === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-text-muted hover:text-text hover:bg-surface-hover'
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
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Internal analytics MCP"
                className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            {customType === 'mcp' && (
              <>
                <fieldset>
                  <legend className="block text-text-secondary mb-1 font-medium">
                    MCP transport
                  </legend>
                  <div className="flex gap-3">
                    {(
                      [
                        ['stdio', 'stdio (local process)'],
                        ['http', 'streamable HTTP (remote)'],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className="flex items-center gap-1.5 cursor-pointer text-text"
                      >
                        <input
                          type="radio"
                          name="mcpTransport"
                          checked={customMcpTransport === value}
                          onChange={() => setCustomMcpTransport(value)}
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
                        onChange={(event) => setCustomCommand(event.target.value)}
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
                        onChange={(event) => setCustomArgs(event.target.value)}
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
                      onChange={(event) => setCustomUrl(event.target.value)}
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
                    onChange={(event) => setCustomUrl(event.target.value)}
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
                    onChange={(event) => setCustomApiKey(event.target.value)}
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submittingCustom}>
                Register Connector
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MCP tool inspector ─────────────────────────────────────────────── */}
      {toolsModalTarget && (
        <Modal
          isOpen
          onClose={() => setToolsModalTarget(null)}
          title={`MCP tools: ${toolsModalTarget.name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {toolsLoading ? (
              <div
                role="status"
                aria-label="Listing MCP tools"
                className="flex items-center justify-center gap-2 py-8 text-text-muted"
              >
                <Spinner size="sm" />
                <span>Listing MCP tools...</span>
              </div>
            ) : toolsList.length === 0 ? (
              <EmptyState
                title="No tools listed"
                description="The server returned an empty tool list, or the last tools/list call failed."
              />
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {toolsList.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3 rounded-lg bg-surface-elevated border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-primary">{tool.name}</span>
                      <Badge variant={tool.readOnlyHint ? 'success' : 'warning'} size="sm">
                        {tool.readOnlyHint ? 'Read-only' : 'Approval gated'}
                      </Badge>
                    </div>
                    <p className="text-text-secondary">
                      {tool.description || 'The server sent no description for this tool.'}
                    </p>
                    {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                      <pre className="p-2 rounded bg-surface border border-border text-2xs text-text-muted font-mono overflow-x-auto">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setToolsModalTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmationDialog
        isOpen={pendingDisconnect !== null}
        onClose={() => setPendingDisconnect(null)}
        onConfirm={() => void confirmDisconnect()}
        loading={busyAction === `disconnect-${pendingDisconnect?.id ?? ''}`}
        variant="destructive"
        title="Disconnect connector?"
        message={
          pendingDisconnect
            ? `${pendingDisconnect.name} will be unlinked from this workspace. Any agent bridged to its data stops receiving it, and credentials held for it are removed with the row.`
            : ''
        }
        confirmLabel="Disconnect"
        cancelLabel="Keep it"
      />
    </div>
  );
}

const COMPOSIO_EQUIVALENTS: Record<string, string> = {
  github: 'github',
  drive: 'googledrive',
  gmail: 'gmail',
  slack: 'slack',
  notion: 'notion',
  calendar: 'googlecalendar',
};
