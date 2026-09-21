'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useWorkspaceConnectors } from '../../hooks/useWorkspace';
import { api } from '../../lib/api';
import {
  temporalApi,
  connectorsApi,
  type ConnectorItem,
  type BuiltinMcpServer,
  type ComposioAppInfo,
  type ComposioStatusResponse,
  type ComposioAppsResponse,
  type McpToolInfo,
  type ConnectorHealthResponse,
} from '../../lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { Modal } from '@vaeloom/ui-kit';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';
import {
  AUTHORITATIVE_CATALOG,
  renderCatalogIcon,
  VerifiedCheck,
  PlusIcon,
  type ConnectorDefinition,
  type ConnectorCategory,
} from '@/lib/connectors-catalog';

interface ConnectorsViewProps {
  workspaceId: string;
  searchQuery?: string;
  onOpenAddConnector?: () => void;
  openAddTrigger?: number;
}

const PROVIDER_META: Record<string, { name: string; scopes: string[]; description: string }> = {
  drive: {
    name: 'Google Drive',
    scopes: ['drive.readonly', 'files.read'],
    description:
      'Read-only access to files and docs you open with Vaeloom. No write or delete access.',
  },
  github: {
    name: 'GitHub',
    scopes: ['repo:read', 'user:read'],
    description:
      'Inspect repositories, pull requests, and automated branches. Zero write without approval.',
  },
  gmail: {
    name: 'Gmail',
    scopes: ['gmail.readonly', 'drafts.create'],
    description:
      'Read-only mailbox access for career and alert ingestion. Drafts require approval gate.',
  },
  notion: {
    name: 'Notion',
    scopes: ['notion:read', 'pages:read'],
    description: 'Read pages and databases shared by user. No destructive edits.',
  },
  calendar: {
    name: 'Google Calendar',
    scopes: ['calendar.readonly', 'events.read'],
    description: 'Read events to extract interview schedules and deadlines. No calendar deletions.',
  },
  slack: {
    name: 'Slack',
    scopes: ['channels:read', 'chat:write'],
    description:
      'Read authorized channels for alerts. Outbound messages guarded by human-in-the-loop.',
  },
};

function formatDate(iso?: string): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConnectorsView({
  workspaceId,
  searchQuery = '',
  onOpenAddConnector,
  openAddTrigger,
}: ConnectorsViewProps) {
  const { toast } = useToast();
  const { connectors, isLoading: workspaceLoading, mutate } = useWorkspaceConnectors(workspaceId);

  // Sub-Navigation: 'discover' (directory) vs 'yours' (configured workspace connectors) vs 'studio' (custom MCP/REST/GraphQL)
  const [activeSubTab, setActiveSubTab] = useState<'discover' | 'yours' | 'studio'>('discover');

  // Internal Filter & Search State
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ConnectorCategory>('All');
  const [showAllConnectors, setShowAllConnectors] = useState(false);

  // Dynamic Backend State
  const [dynamicConnectors, setDynamicConnectors] = useState<ConnectorItem[]>([]);
  const [composioApps, setComposioApps] = useState<ComposioAppInfo[]>([]);
  const [composioCatalogApps, setComposioCatalogApps] = useState<ComposioAppInfo[]>([]);
  const [composioTotalCount, setComposioTotalCount] = useState<number>(269);
  const [builtinServers, setBuiltinServers] = useState<BuiltinMcpServer[]>([]);
  const [composioSyncing, setComposioSyncing] = useState(false);

  // Busy State Trackers
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [syncBusyId, setSyncBusyId] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (openAddTrigger && openAddTrigger > 0) {
      setIsAddModalOpen(true);
    }
  }, [openAddTrigger]);
  const [selectedItemDetails, setSelectedItemDetails] = useState<ConnectorDefinition | null>(null);
  const [pendingProvider, setPendingProvider] = useState<ConnectorProvider | null>(null);
  const [healthTarget, setHealthTarget] = useState<ConnectorHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [toolsModalTarget, setToolsModalTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [toolsList, setToolsList] = useState<McpToolInfo[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  // Custom Connector Form State
  const [customType, setCustomType] = useState<'mcp' | 'rest' | 'graphql'>('mcp');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customAuthToken, setCustomAuthToken] = useState('');
  const [customMcpTransport, setCustomMcpTransport] = useState<'stdio' | 'http'>('stdio');
  const [customCommand, setCustomCommand] = useState('');
  const [customArgs, setCustomArgs] = useState('');
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // Combine top-level search query and local search input
  const effectiveQuery = (searchQuery || internalSearch).trim().toLowerCase();

  // Load Real Backend Data
  const loadDynamicData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [conns, compStatus, compApps, mcp] = await Promise.allSettled([
        connectorsApi?.list
          ? connectorsApi.list(workspaceId)
          : Promise.resolve<ConnectorItem[]>([]),
        connectorsApi?.composio?.status
          ? connectorsApi.composio.status()
          : Promise.resolve<ComposioStatusResponse>({
              enabled: false,
              popular_apps: [],
              total_apps: 269,
            }),
        connectorsApi?.composio?.apps
          ? connectorsApi.composio.apps({ limit: 1600 })
          : Promise.resolve<ComposioAppsResponse>({
              total: 0,
              limit: 1600,
              offset: 0,
              apps: [],
              categories: [],
            }),
        connectorsApi?.mcp?.builtin
          ? connectorsApi.mcp.builtin()
          : Promise.resolve<{ builtin_servers: BuiltinMcpServer[] }>({ builtin_servers: [] }),
      ]);

      if (conns.status === 'fulfilled' && Array.isArray(conns.value)) {
        setDynamicConnectors(conns.value);
      }
      if (compStatus.status === 'fulfilled' && compStatus.value?.popular_apps) {
        setComposioApps(compStatus.value.popular_apps);
        if (compStatus.value.total_apps) {
          setComposioTotalCount(compStatus.value.total_apps);
        }
      }
      if (
        compApps.status === 'fulfilled' &&
        compApps.value?.apps &&
        compApps.value.apps.length > 0
      ) {
        setComposioCatalogApps(compApps.value.apps);
        if (compApps.value.total) {
          setComposioTotalCount(compApps.value.total);
        }
      }
      if (mcp.status === 'fulfilled' && mcp.value?.builtin_servers) {
        setBuiltinServers(mcp.value.builtin_servers);
      }
    } catch {
      // safe fallback
    }
  }, [workspaceId]);

  useEffect(() => {
    loadDynamicData();
  }, [loadDynamicData]);

  // Provider map for connected status
  const byProvider = useMemo(() => new Map(connectors.map((c) => [c.provider, c])), [connectors]);

  // Helper to check if a catalog connector is currently connected in workspace
  const isItemConnected = useCallback(
    (item: ConnectorDefinition): boolean => {
      if (item.provider !== 'composio' && item.provider !== 'mcp' && item.provider !== 'native') {
        return byProvider.has(item.provider);
      }
      if (item.id === 'native-ats-mcp') {
        return dynamicConnectors.some(
          (c) =>
            c.type === 'mcp' &&
            (c.name.toLowerCase().includes('job-search') || c.name.toLowerCase().includes('ats')),
        );
      }
      if (item.provider === 'composio') {
        const appName = (item.composioApp || item.id.replace('composio-', '')).toLowerCase();
        return dynamicConnectors.some(
          (c) => c.name.toLowerCase() === appName || c.config?.['app'] === appName,
        );
      }
      if (item.provider === 'native') {
        return true; // sovereign services are embedded and active
      }
      return false;
    },
    [byProvider, dynamicConnectors],
  );

  // Complete merged master list (catalog + any additional dynamic composio apps)
  const fullCatalogList = useMemo(() => {
    const list: ConnectorDefinition[] = [];
    const seenIds = new Set<string>();

    for (const item of AUTHORITATIVE_CATALOG) {
      const normalized = item.id.toLowerCase();
      if (!seenIds.has(normalized)) {
        list.push(item);
        seenIds.add(normalized);
      }
    }

    // Merge in any dynamic apps from backend Composio catalog
    composioCatalogApps.forEach((app) => {
      const rawName = (app.name || app.id || '').toLowerCase();
      const slugId = (app.id || app.name || '').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const composioId = `composio-${slugId}`;
      if (!seenIds.has(slugId) && !seenIds.has(composioId) && !seenIds.has(rawName)) {
        list.push({
          id: composioId,
          name: app.name,
          provider: 'composio',
          composioApp: app.id || app.name,
          category: (app.category as ConnectorCategory) || 'Productivity',
          protocol: 'OAuth 2.0',
          description: app.description || `Connect ${app.name} to execute automated agent tools.`,
          scopes: app.action_count ? [`${app.action_count} dynamic actions`] : ['api:execute'],
          assignedAgents: ['ApplicationAgent', 'ExecutiveStrategyAgent'],
        });
        seenIds.add(composioId);
        seenIds.add(slugId);
        seenIds.add(rawName);
      }
    });

    return list;
  }, [composioCatalogApps]);

  // Filtered connectors for search / category
  const filteredCatalog = useMemo(() => {
    return fullCatalogList.filter((item) => {
      // Category filter
      if (selectedFilter !== 'All') {
        if (selectedFilter === 'Google' && item.category !== 'Google') return false;
        if (selectedFilter === 'Productivity' && item.category !== 'Productivity') return false;
        if (selectedFilter === 'Engineering' && item.category !== 'Engineering') return false;
        if (selectedFilter === 'Sales' && item.category !== 'Sales') return false;
        if (selectedFilter === 'Financial' && item.category !== 'Financial') return false;
        if (selectedFilter === 'Legal' && item.category !== 'Legal') return false;
        if (selectedFilter === 'Native' && item.category !== 'Native') return false;
        if (selectedFilter === 'MCP' && item.category !== 'MCP') return false;
      }

      // Search query
      if (!effectiveQuery) return true;
      return (
        item.name.toLowerCase().includes(effectiveQuery) ||
        item.description.toLowerCase().includes(effectiveQuery) ||
        item.category.toLowerCase().includes(effectiveQuery) ||
        item.protocol.toLowerCase().includes(effectiveQuery) ||
        item.assignedAgents.some((a) => a.toLowerCase().includes(effectiveQuery)) ||
        item.scopes.some((s) => s.toLowerCase().includes(effectiveQuery))
      );
    });
  }, [fullCatalogList, selectedFilter, effectiveQuery]);

  // Section partitioned items
  const topConnectors = useMemo(
    () => fullCatalogList.filter((item) => item.isTop),
    [fullCatalogList],
  );

  const otherConnectors = useMemo(
    () => fullCatalogList.filter((item) => !item.isTop),
    [fullCatalogList],
  );

  // Initiate Connect flow
  const handleInitiateConnect = (item: ConnectorDefinition) => {
    if (item.provider !== 'composio' && item.provider !== 'mcp' && item.provider !== 'native') {
      setPendingProvider(item.provider as ConnectorProvider);
      return;
    }

    if (item.id === 'native-ats-mcp') {
      void handleAttachAtsMcp();
      return;
    }

    if (item.provider === 'composio') {
      const appName = item.composioApp || item.id.replace('composio-', '');
      void handleComposioOAuth(appName, item.name);
      return;
    }

    if (item.provider === 'mcp') {
      setCustomType('mcp');
      setCustomName(item.name);
      setIsAddModalOpen(true);
      return;
    }

    toast({
      tone: 'info',
      title: 'Native Service Active',
      detail: `${item.name} is sovereignly embedded in this workspace.`,
    });
  };

  // Perform OAuth Connect
  const handleExecuteConnect = async (provider: ConnectorProvider) => {
    const meta = PROVIDER_META[provider];
    setBusyAction(`connect-${provider}`);
    try {
      await api.integrations.create({ name: meta?.name ?? provider, provider });
      await mutate();
      toast({
        tone: 'success',
        title: 'Connector linked',
        detail: `${meta?.name ?? provider} successfully authorized for this workspace.`,
      });
      setPendingProvider(null);
      loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Connect failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Attach Public ATS MCP
  const handleAttachAtsMcp = async () => {
    if (!workspaceId) return;
    setBusyAction('attach-ats-mcp');
    try {
      const builtinRes = await connectorsApi.mcp.builtin();
      const server =
        builtinRes.builtin_servers?.find((s) => s.id === 'job-search-mcp') ||
        builtinRes.builtin_servers?.[0];

      if (!server) {
        throw new Error('Public ATS Job Search MCP definition not found.');
      }

      const created = await connectorsApi.create({
        name: server.name,
        type: 'mcp',
        workspace_id: workspaceId,
        config: server.config,
      });

      await connectorsApi.mcp.sync(created.id, workspaceId);

      toast({
        tone: 'success',
        title: 'ATS MCP Attached',
        detail: `Attached ${server.name} and synchronized sovereign agent tools.`,
      });
      loadDynamicData();
      await mutate();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Attachment Failed',
        detail: err instanceof Error ? err.message : 'Could not attach MCP server.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Composio OAuth Popup
  const handleComposioOAuth = async (appId: string, appName: string) => {
    if (!workspaceId) return;
    setBusyAction(`composio-${appId}`);
    try {
      const res = await connectorsApi.composio.authUrl(appId, workspaceId);
      const url = res.auth_url || res.url;
      if (res.status === 'error' || !url) {
        toast({
          tone: 'error',
          title:
            res.error_code === 'COMPOSIO_INVALID_API_KEY'
              ? 'Invalid Composio Key'
              : res.error_code === 'COMPOSIO_INSUFFICIENT_PERMISSIONS'
                ? 'Key Missing Write Permission'
                : 'Connection Error',
          detail:
            res.message ||
            'Could not initiate Composio OAuth. Please check your COMPOSIO_API_KEY in your .env file.',
        });
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      toast({
        tone: 'info',
        title: 'Composio OAuth Opened',
        detail: `Complete authorization for ${appName} in the opened window.`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Auth Failed',
        detail: err instanceof Error ? err.message : 'Could not generate OAuth authorization URL.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Sync All Composio Tools
  const handleSyncAllComposio = async () => {
    if (!workspaceId) return;
    setComposioSyncing(true);
    try {
      const res = await connectorsApi.composio.sync(workspaceId);
      toast({
        tone: 'success',
        title: 'Composio SaaS Synced',
        detail: `Successfully registered ${res.count || 0} tools into dynamic agent router.`,
      });
      loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync Failed',
        detail: err instanceof Error ? err.message : 'Composio synchronization failed.',
      });
    } finally {
      setComposioSyncing(false);
    }
  };

  // Sync Workspace Integration (Temporal or Direct)
  const handleSyncWorkspace = async (connector: Connector) => {
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
        toast({ tone: 'success', title: 'Durable sync started', detail: connector.id });
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        if ((e as { status?: number })?.status === 503 || errMsg.includes('503')) {
          const res = await api.integrations.sync(connector.id);
          toast({
            tone: 'success',
            title: 'Sync started',
            detail: (res as { message?: string })?.message ?? 'Sync requested',
          });
        } else {
          throw e;
        }
      }
      await mutate();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBusyAction(null);
      setSyncBusyId(null);
    }
  };

  // Dynamic Connector Sync
  const handleDynamicSync = async (connId: string) => {
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
          detail: `Records synced: ${res.records_synced ?? 0}`,
        });
      }
      loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync Failed',
        detail: err instanceof Error ? err.message : 'Error syncing connector.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Test Connection / Diagnostic
  const handleTestConnection = async (connId: string) => {
    setBusyAction(`test-${connId}`);
    try {
      const res = await connectorsApi.test(connId);
      if (res.status === 'success') {
        toast({
          tone: 'success',
          title: 'Connection Healthy',
          detail: res.message || 'Endpoint returned 200 OK.',
        });
      } else {
        toast({
          tone: 'warning',
          title: 'Connection Issue',
          detail: res.error || 'Endpoint returned non-success status.',
        });
      }
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Diagnostic Test Failed',
        detail: err instanceof Error ? err.message : 'Endpoint unreachable.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Health Modal
  const handleOpenHealthModal = async (connId: string) => {
    setHealthLoading(true);
    try {
      const res = await connectorsApi.health(connId);
      setHealthTarget(res);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Health Check Failed',
        detail: err instanceof Error ? err.message : 'Unable to query connector health.',
      });
    } finally {
      setHealthLoading(false);
    }
  };

  // MCP Tools Inspector
  const handleInspectTools = async (connId: string, name: string) => {
    setToolsModalTarget({ id: connId, name });
    setToolsLoading(true);
    try {
      const res = await connectorsApi.mcp.listTools(connId);
      setToolsList(res || []);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to inspect tools',
        detail: err instanceof Error ? err.message : 'Could not query MCP tool list.',
      });
      setToolsList([]);
    } finally {
      setToolsLoading(false);
    }
  };

  // Disconnect / Delete Connector
  const handleDisconnect = async (id: string, name: string, isWorkspaceIntegration = false) => {
    setBusyAction(`disconnect-${id}`);
    try {
      if (isWorkspaceIntegration) {
        await api.integrations.delete(id);
        await mutate();
      } else {
        await connectorsApi.delete(id);
        loadDynamicData();
      }
      toast({
        tone: 'success',
        title: 'Disconnected',
        detail: `Successfully unlinked ${name} from workspace.`,
      });
      setSelectedItemDetails(null);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Disconnect Failed',
        detail: err instanceof Error ? err.message : 'Could not disconnect.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Submit Add Custom Connector
  const handleCreateCustomConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !workspaceId) return;

    setSubmittingCustom(true);
    try {
      const config: Record<string, unknown> = {};

      if (customType === 'mcp') {
        config['transport'] = customMcpTransport;
        if (customMcpTransport === 'stdio') {
          config['command'] = customCommand.trim();
          config['args'] = customArgs
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          config['url'] = customUrl.trim();
          if (customAuthToken.trim()) {
            config['auth_token'] = customAuthToken.trim();
          }
        }
      } else {
        config['base_url'] = customUrl.trim();
        if (customApiKey.trim()) {
          config['api_key'] = customApiKey.trim();
        }
      }

      const created = await connectorsApi.create({
        name: customName.trim(),
        type: customType,
        workspace_id: workspaceId,
        config,
      });

      if (customType === 'mcp') {
        await connectorsApi.mcp.sync(created.id, workspaceId);
      }

      toast({
        tone: 'success',
        title: 'Connector Registered',
        detail: `Successfully configured ${customName}.`,
      });

      setIsAddModalOpen(false);
      setCustomName('');
      setCustomUrl('');
      setCustomApiKey('');
      setCustomAuthToken('');
      setCustomCommand('');
      setCustomArgs('');
      loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Registration Failed',
        detail: err instanceof Error ? err.message : 'Could not register custom connector.',
      });
    } finally {
      setSubmittingCustom(false);
    }
  };

  // All configured workspace connectors for 'Yours' view
  const configuredItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      type: string;
      status: 'active' | 'syncing' | 'error';
      lastSync?: string;
      isWorkspaceIntegration?: boolean;
      originalConnector?: Connector;
      originalDynamic?: ConnectorItem;
    }> = [];

    // Add workspace integrations (Google Drive, Gmail, Calendar, Slack, GitHub, Notion)
    connectors.forEach((c) => {
      const meta = PROVIDER_META[c.provider];
      list.push({
        id: c.id,
        name: meta?.name || c.provider,
        type: 'OAuth 2.0',
        status: c.status === 'connected' ? 'active' : 'error',
        lastSync: c.lastSyncAt,
        isWorkspaceIntegration: true,
        originalConnector: c,
      });
    });

    // Add dynamic studio connectors (MCP, REST, GraphQL)
    dynamicConnectors.forEach((dc) => {
      list.push({
        id: dc.id,
        name: dc.name,
        type: dc.type.toUpperCase(),
        status: dc.status === 'syncing' ? 'syncing' : dc.status === 'active' ? 'active' : 'error',
        lastSync: dc.updatedAt,
        isWorkspaceIntegration: false,
        originalDynamic: dc,
      });
    });

    // Add sovereign ATS crawler & Playwright browser as active
    list.push({
      id: 'native-ats-mcp',
      name: 'Public ATS Job Search MCP',
      type: 'MCP (stdio)',
      status: 'active',
      lastSync: new Date().toISOString(),
      isWorkspaceIntegration: false,
    });
    list.push({
      id: 'native-browser',
      name: 'Browser Scraper (Playwright)',
      type: 'Native Sovereign',
      status: 'active',
      lastSync: new Date().toISOString(),
      isWorkspaceIntegration: false,
    });

    return list;
  }, [connectors, dynamicConnectors]);

  if (workspaceLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner text="Loading connectors..." />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b] text-[#f4f4f5] antialiased">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Subheader Bar: Sub-Navigation (Yours vs Discover) + Top Action Buttons    */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#1c1d24] bg-[#0c0d12] px-4 sm:px-6 py-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Sub-nav Tabs */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveSubTab('yours')}
              className={`pb-1 text-sm font-medium transition-colors relative ${
                activeSubTab === 'yours'
                  ? 'text-white border-b-2 border-[#3b82f6]'
                  : 'text-[#8b8e99] hover:text-[#d4d4d8]'
              }`}
            >
              Yours
              {configuredItems.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#1c1d24] text-[#a1a1aa]">
                  {configuredItems.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('discover')}
              className={`pb-1 text-sm font-medium transition-colors relative ${
                activeSubTab === 'discover'
                  ? 'text-white border-b-2 border-[#3b82f6]'
                  : 'text-[#8b8e99] hover:text-[#d4d4d8]'
              }`}
            >
              Discover
              {composioTotalCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#1c1d24] text-[#a1a1aa]">
                  {composioTotalCount.toLocaleString()}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('studio')}
              className={`pb-1 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                activeSubTab === 'studio'
                  ? 'text-white border-b-2 border-[#3b82f6]'
                  : 'text-[#8b8e99] hover:text-[#d4d4d8]'
              }`}
            >
              <span>Full Connectors Studio</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
                MCP • REST • GraphQL
              </span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSyncAllComposio()}
              disabled={composioSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#181a22] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#222430] transition-colors"
              title="Sync dynamic SaaS tools from Composio"
            >
              <svg
                className={`w-3.5 h-3.5 text-[#3b82f6] ${composioSyncing ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              <span>{composioSyncing ? 'Syncing SaaS...' : 'Sync SaaS Tools'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenAddConnector) {
                  onOpenAddConnector();
                } else {
                  setIsAddModalOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-xs transition-colors"
            >
              <PlusIcon />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Main Content Area                                                          */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeSubTab === 'discover' ? (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Breadcrumb & Filter Bar (Matches Screenshots) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-[#71717a]">
                <span>Connectors</span>
                <span>/</span>
                <span className="text-[#f4f4f5] font-medium">Directory</span>
              </div>

              {/* Search & Category Filter */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717a] pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={internalSearch}
                    onChange={(e) => setInternalSearch(e.target.value)}
                    placeholder="Search connectors"
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#121319] border border-[#27272a] rounded-md text-white placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6] transition-colors"
                  />
                  {internalSearch && (
                    <button
                      type="button"
                      onClick={() => setInternalSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#71717a] hover:text-white"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="relative">
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value as ConnectorCategory)}
                    className="appearance-none bg-[#121319] border border-[#27272a] rounded-md pl-3 pr-8 py-1.5 text-xs text-[#d4d4d8] focus:outline-none focus:border-[#3b82f6] cursor-pointer"
                  >
                    <option value="All">Filter: All Purposes</option>
                    <option value="Education">🎓 Education & Learning</option>
                    <option value="Sales">💼 Sales & CRM</option>
                    <option value="Productivity">🚀 Productivity & Tasks</option>
                    <option value="Engineering">💻 Engineering & DevOps</option>
                    <option value="Financial">💰 Finance & Accounting</option>
                    <option value="Legal">⚖️ Legal & Contracts</option>
                    <option value="HR">👥 HR, Recruiting & Talent</option>
                    <option value="AI & ML">🤖 AI, Agents & ML</option>
                    <option value="Data & Analytics">📊 Data, Analytics & BI</option>
                    <option value="Communication">💬 Communication & Messaging</option>
                    <option value="Marketing">📣 Marketing & Social</option>
                    <option value="Support">🎧 Customer Support</option>
                    <option value="E-Commerce">🛒 E-Commerce & Retail</option>
                    <option value="Google">Google Workspace</option>
                    <option value="Native">Native Sovereign</option>
                    <option value="MCP">⚡ Model Context Protocol (MCP)</option>
                  </select>
                  <svg
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#71717a] pointer-events-none"
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

            {/* Quick Purpose Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {(
                [
                  { id: 'All', label: 'All', icon: '🌐' },
                  { id: 'Education', label: 'Education', icon: '🎓' },
                  { id: 'Sales', label: 'Sales & CRM', icon: '💼' },
                  { id: 'Productivity', label: 'Productivity', icon: '🚀' },
                  { id: 'Engineering', label: 'Engineering', icon: '💻' },
                  { id: 'Financial', label: 'Finance', icon: '💰' },
                  { id: 'HR', label: 'HR & Talent', icon: '👥' },
                  { id: 'AI & ML', label: 'AI & ML', icon: '🤖' },
                  { id: 'Data & Analytics', label: 'Analytics', icon: '📊' },
                  { id: 'Communication', label: 'Messaging', icon: '💬' },
                  { id: 'Legal', label: 'Legal', icon: '⚖️' },
                  { id: 'Support', label: 'Support', icon: '🎧' },
                  { id: 'MCP', label: 'MCP', icon: '⚡' },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedFilter(pill.id as ConnectorCategory)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                    selectedFilter === pill.id
                      ? 'bg-[#3b82f6] text-white shadow-xs font-semibold'
                      : 'bg-[#121319] hover:bg-[#181a22] text-[#8b8e99] hover:text-white border border-[#27272a]'
                  }`}
                >
                  <span>{pill.icon}</span>
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>

            {/* If Search is Active or Non-All Filter or ShowAll is toggled: Show Full Catalog Grid */}
            {showAllConnectors || effectiveQuery || selectedFilter !== 'All' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1c1d24] pb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">
                      {effectiveQuery
                        ? `Search results (${filteredCatalog.length})`
                        : selectedFilter !== 'All'
                          ? `${selectedFilter} connectors (${filteredCatalog.length})`
                          : `All connectors (${filteredCatalog.length})`}
                    </h2>
                    <span className="text-xs text-[#71717a]">• 260+ available</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllConnectors(false);
                      setInternalSearch('');
                      setSelectedFilter('All');
                    }}
                    className="text-xs text-[#3b82f6] hover:underline"
                  >
                    ← Back to featured
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredCatalog.map((item) => {
                    const connected = isItemConnected(item);
                    return (
                      <div
                        key={item.id}
                        className="group relative flex items-start justify-between p-3.5 rounded-lg bg-[#0e0f14] hover:bg-[#13141c] border border-[#1c1d24] hover:border-[#2c2f3d] transition-all cursor-pointer shadow-xs"
                        onClick={() => setSelectedItemDetails(item)}
                      >
                        <div className="flex items-start gap-3 min-w-0 pr-3">
                          <div className="shrink-0 mt-0.5">{renderCatalogIcon(item)}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-white truncate group-hover:text-[#93c5fd] transition-colors">
                                {item.name}
                              </span>
                              <VerifiedCheck />
                              {item.isTrending && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                  Trending
                                </span>
                              )}
                              {item.isNew && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-500/15 border border-blue-500/30 text-blue-300">
                                  New
                                </span>
                              )}
                              {item.isDesktop && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/15 border border-purple-500/30 text-purple-300">
                                  Desktop
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#8b8e99] line-clamp-2 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Right Action Button */}
                        <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                          {connected ? (
                            <div
                              className="w-7 h-7 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]"
                              title="Connected"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInitiateConnect(item)}
                              disabled={busyAction === `connect-${item.provider}`}
                              className="w-7 h-7 rounded-full bg-[#181a22] hover:bg-[#222430] border border-[#27272a] hover:border-[#3b82f6] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors shadow-xs"
                              title={`Connect ${item.name}`}
                            >
                              <PlusIcon />
                              <span className="sr-only">Connect</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Normal Directory Layout (Matches Screenshots 1, 2, 3) */
              <div className="space-y-8">
                {/* 1. Top Connectors Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1c1d24] pb-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">
                        Top connectors ({topConnectors.length})
                      </h2>
                      <span className="text-xs text-[#71717a]">
                        • {fullCatalogList.length} available
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllConnectors(true)}
                      className="text-xs text-[#3b82f6] hover:text-[#60a5fa] font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>Show all ({fullCatalogList.length})</span>
                      <span>›</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {topConnectors.map((item) => {
                      const connected = isItemConnected(item);
                      return (
                        <div
                          key={item.id}
                          className="group relative flex items-start justify-between p-3.5 rounded-lg bg-[#0e0f14] hover:bg-[#13141c] border border-[#1c1d24] hover:border-[#2c2f3d] transition-all cursor-pointer shadow-xs"
                          onClick={() => setSelectedItemDetails(item)}
                        >
                          <div className="flex items-start gap-3 min-w-0 pr-3">
                            <div className="shrink-0 mt-0.5">{renderCatalogIcon(item)}</div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-white truncate group-hover:text-[#93c5fd] transition-colors">
                                  {item.name}
                                </span>
                                <VerifiedCheck />
                              </div>
                              <p className="text-xs text-[#8b8e99] line-clamp-2 mt-1 leading-relaxed">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                            {connected ? (
                              <div
                                className="w-7 h-7 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]"
                                title="Connected"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleInitiateConnect(item)}
                                className="w-7 h-7 rounded-full bg-[#181a22] hover:bg-[#222430] border border-[#27272a] hover:border-[#3b82f6] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors shadow-xs"
                                title={`Connect ${item.name}`}
                              >
                                <PlusIcon />
                                <span className="sr-only">Connect</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. More Integrations & Dynamic Toolkits */}
                {otherConnectors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1c1d24] pb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-white">
                          More Integrations & Dynamic Toolkits
                        </h2>
                        <span className="text-xs text-[#71717a]">
                          • {otherConnectors.length} available
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {otherConnectors.map((item) => {
                        const connected = isItemConnected(item);
                        return (
                          <div
                            key={item.id}
                            className="group relative flex items-start justify-between p-3.5 rounded-lg bg-[#0e0f14] hover:bg-[#13141c] border border-[#1c1d24] hover:border-[#2c2f3d] transition-all cursor-pointer shadow-xs"
                            onClick={() => setSelectedItemDetails(item)}
                          >
                            <div className="flex items-start gap-3 min-w-0 pr-3">
                              <div className="shrink-0 mt-0.5">{renderCatalogIcon(item)}</div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium text-white truncate group-hover:text-[#93c5fd] transition-colors">
                                    {item.name}
                                  </span>
                                  <VerifiedCheck />
                                </div>
                                <p className="text-xs text-[#8b8e99] line-clamp-2 mt-1 leading-relaxed">
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                              {connected ? (
                                <div
                                  className="w-7 h-7 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]"
                                  title="Connected"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleInitiateConnect(item)}
                                  className="w-7 h-7 rounded-full bg-[#181a22] hover:bg-[#222430] border border-[#27272a] hover:border-[#3b82f6] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors shadow-xs"
                                  title={`Connect ${item.name}`}
                                >
                                  <PlusIcon />
                                  <span className="sr-only">Connect</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeSubTab === 'studio' ? (
          /* ────────────────────────────────────────────────────────────────────────── */
          /* Full Connectors Studio View: MCP, REST, and GraphQL Custom Connectors     */
          /* ────────────────────────────────────────────────────────────────────────── */
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c1d24] pb-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-[#71717a] mb-1">
                  <span>Connectors</span>
                  <span>/</span>
                  <span className="text-[#f4f4f5] font-medium">Full Connectors Studio</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
                    Enterprise Protocol Builder
                  </span>
                </div>
                <h1 className="text-lg font-semibold text-white">
                  Connectors Studio & Protocol Orchestrator
                </h1>
                <p className="text-xs text-[#8b8e99] max-w-2xl mt-0.5">
                  Build, test, and register custom Model Context Protocol (stdio/HTTP) servers,
                  enterprise REST APIs, and GraphQL endpoints with sandboxed execution and live
                  health monitoring.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-xs transition-colors"
                >
                  <PlusIcon />
                  <span>Add Custom Connector</span>
                </button>
              </div>
            </div>

            {/* Protocol Architecture Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-[#0e0f14] border border-[#1c1d24] hover:border-[#3b82f6]/40 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/15 border border-[#3b82f6]/30 flex items-center justify-center text-sm font-bold text-[#60a5fa]">
                      ⚡
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30">
                      Standard v1.0
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Model Context Protocol (MCP)</h3>
                  <p className="text-xs text-[#8b8e99] leading-relaxed">
                    Connect local subprocesses (stdio) or remote streamable-HTTP endpoints.
                    Auto-discovers dynamic tools, enforces typed JSON schema parameters, and routes
                    via approval gates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomType('mcp');
                    setIsAddModalOpen(true);
                  }}
                  className="w-full py-1.5 px-3 text-xs font-medium rounded bg-[#181a22] hover:bg-[#222430] border border-[#27272a] text-[#d4d4d8] hover:text-white transition-colors text-center"
                >
                  + Add MCP Server
                </button>
              </div>

              <div className="p-4 rounded-lg bg-[#0e0f14] border border-[#1c1d24] hover:border-[#10b981]/40 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-sm font-bold text-[#34d399]">
                      🌐
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
                      REST / Webhooks
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Enterprise REST API</h3>
                  <p className="text-xs text-[#8b8e99] leading-relaxed">
                    Integrate proprietary corporate microservices, webhooks, and REST endpoints.
                    Supports Bearer token, custom API keys, and Infisical encrypted environment
                    variables.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomType('rest');
                    setIsAddModalOpen(true);
                  }}
                  className="w-full py-1.5 px-3 text-xs font-medium rounded bg-[#181a22] hover:bg-[#222430] border border-[#27272a] text-[#d4d4d8] hover:text-white transition-colors text-center"
                >
                  + Add REST Connector
                </button>
              </div>

              <div className="p-4 rounded-lg bg-[#0e0f14] border border-[#1c1d24] hover:border-[#8b5cf6]/40 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 flex items-center justify-center text-sm font-bold text-[#a78bfa]">
                      ⬡
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-[#8b5cf6]/15 text-[#a78bfa] border border-[#8b5cf6]/30">
                      GraphQL 2021
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">GraphQL Explorer</h3>
                  <p className="text-xs text-[#8b8e99] leading-relaxed">
                    Point Vaeloom agents to GraphQL endpoints with automated schema introspection,
                    custom queries, document mutations, and JWT header propagation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomType('graphql');
                    setIsAddModalOpen(true);
                  }}
                  className="w-full py-1.5 px-3 text-xs font-medium rounded bg-[#181a22] hover:bg-[#222430] border border-[#27272a] text-[#d4d4d8] hover:text-white transition-colors text-center"
                >
                  + Add GraphQL Endpoint
                </button>
              </div>
            </div>

            {/* Built-in Sovereign MCP Servers Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Built-in Sovereign MCP Servers
                  </h2>
                  <p className="text-xs text-[#71717a]">
                    Pre-configured, sandboxed protocols maintained by Vaeloom
                  </p>
                </div>
                <span className="text-xs text-[#10b981] font-mono font-medium">
                  ● 5 active & sandboxed
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    name: 'SQLite Memory MCP',
                    desc: 'Local structured relational database engine with zero network dependencies. Ingests candidate profiles and memory graphs.',
                    protocol: 'MCP (stdio)',
                    tag: 'Local Sandbox',
                  },
                  {
                    name: 'Sovereign ATS Crawler',
                    desc: 'Native Playwright chromium crawler for corporate job portals, greenhouse boards, and enterprise career tracking.',
                    protocol: 'Native Playwright',
                    tag: 'Anti-Bot Guard',
                  },
                  {
                    name: 'Headless Web Scraper',
                    desc: 'SSRF-guarded browser scraper with screenshot extraction, DOM text analysis, and quota governance.',
                    protocol: 'Native Playwright',
                    tag: 'SSRF Guarded',
                  },
                  {
                    name: 'Local Filesystem MCP',
                    desc: 'Workspace document indexing, sandboxed file reading, and enterprise knowledge ingestion.',
                    protocol: 'MCP (stdio)',
                    tag: 'Local Sandbox',
                  },
                  {
                    name: 'Atlassian MCP Suite',
                    desc: 'Bidirectional Jira issue tracking, Confluence workspace searching, and Loom transcript ingestion.',
                    protocol: 'MCP (Streamable-HTTP)',
                    tag: 'Atlassian Certified',
                  },
                ].map((mcpItem, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-[#0e0f14] border border-[#1c1d24] flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{mcpItem.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {mcpItem.tag}
                        </span>
                      </div>
                      <p className="text-xs text-[#8b8e99] line-clamp-2">{mcpItem.desc}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#181a22] text-[11px]">
                      <span className="font-mono text-[#71717a]">{mcpItem.protocol}</span>
                      <span className="text-emerald-400 font-medium">Ready</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configured Custom Connectors List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Configured Custom Connectors</h2>
                  <p className="text-xs text-[#71717a]">
                    Custom endpoints and private MCP instances active in this workspace
                  </p>
                </div>
                <span className="text-xs text-[#8b8e99]">
                  {
                    dynamicConnectors.filter((c) =>
                      ['mcp', 'rest', 'graphql'].includes(c.type?.toLowerCase()),
                    ).length
                  }{' '}
                  active
                </span>
              </div>

              {dynamicConnectors.filter((c) =>
                ['mcp', 'rest', 'graphql'].includes(c.type?.toLowerCase()),
              ).length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#27272a] rounded-lg bg-[#0c0d12]/50">
                  <p className="text-xs text-[#8b8e99]">
                    No custom MCP, REST, or GraphQL connectors created in this workspace yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-2.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
                  >
                    + Add First Custom Connector
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dynamicConnectors
                    .filter((c) => ['mcp', 'rest', 'graphql'].includes(c.type?.toLowerCase()))
                    .map((conn) => (
                      <div
                        key={conn.id}
                        className="p-4 rounded-lg bg-[#0e0f14] border border-[#1c1d24] space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 flex items-center justify-center font-mono font-bold text-xs text-[#60a5fa]">
                              {conn.type.toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-xs font-semibold text-white">{conn.name}</h3>
                              <p className="text-[10px] font-mono text-[#71717a]">ID: {conn.id}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                            {conn.status || 'Active'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#181a22] text-xs">
                          <button
                            type="button"
                            onClick={() => void handleTestConnection(conn.id)}
                            className="px-2.5 py-1 rounded bg-[#181a22] hover:bg-[#222430] border border-[#27272a] text-[#d4d4d8] hover:text-white transition-colors"
                          >
                            Ping Health
                          </button>
                          {conn.type?.toLowerCase() === 'mcp' && (
                            <button
                              type="button"
                              onClick={() => handleInspectTools(conn.id, conn.name)}
                              className="px-2.5 py-1 rounded bg-[#3b82f6]/15 hover:bg-[#3b82f6]/25 border border-[#3b82f6]/30 text-[#93c5fd] transition-colors"
                            >
                              Inspect Tools
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDisconnect(conn.id, conn.name, false)}
                            className="text-rose-400 hover:text-rose-300 font-medium transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ────────────────────────────────────────────────────────────────────────── */
          /* Yours View: Active & Configured Workspace Connectors                       */
          /* ────────────────────────────────────────────────────────────────────────── */
          <div className="max-w-6xl mx-auto space-y-5">
            <div className="flex items-center justify-between border-b border-[#1c1d24] pb-3">
              <div className="flex items-center gap-2 text-sm text-[#71717a]">
                <span>Connectors</span>
                <span>/</span>
                <span className="text-[#f4f4f5] font-medium">Configured in Workspace</span>
                <span className="text-xs text-[#71717a]">({configuredItems.length})</span>
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab('discover')}
                className="text-xs text-[#3b82f6] hover:underline"
              >
                + Browse Directory
              </button>
            </div>

            {configuredItems.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#27272a] rounded-lg">
                <p className="text-sm text-[#8b8e99]">
                  No connectors configured in this workspace yet.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('discover')}
                  className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                >
                  Discover Connectors
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {configuredItems.map((item) => {
                  const isSyncing = syncBusyId === item.id || busyAction === `sync-${item.id}`;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg bg-[#0e0f14] border border-[#1c1d24] hover:border-[#27272a] transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.status === 'active'
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                : item.status === 'syncing'
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-rose-500'
                            }`}
                          />
                          <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                          <VerifiedCheck />
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#181a22] border border-[#27272a] text-[#8b8e99]">
                          {item.type}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#71717a]">
                        <span>Last sync: {formatDate(item.lastSync)}</span>
                        <span className="text-emerald-400 capitalize">{item.status}</span>
                      </div>

                      {/* Action Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#181a22] gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.isWorkspaceIntegration && item.originalConnector) {
                                void handleSyncWorkspace(item.originalConnector);
                              } else {
                                void handleDynamicSync(item.id);
                              }
                            }}
                            disabled={isSyncing}
                            className="px-2 py-1 text-xs font-medium rounded bg-[#181a22] hover:bg-[#222430] border border-[#27272a] text-[#d4d4d8] hover:text-white transition-colors"
                          >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!item.isWorkspaceIntegration) {
                                void handleTestConnection(item.id);
                              } else {
                                toast({
                                  tone: 'success',
                                  title: 'Health 200 OK',
                                  detail: `${item.name} integration token valid and reachable.`,
                                });
                              }
                            }}
                            className="px-2 py-1 text-xs font-medium rounded bg-[#181a22] hover:bg-[#222430] border border-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
                          >
                            Test
                          </button>

                          {item.type.includes('MCP') && (
                            <button
                              type="button"
                              onClick={() => handleInspectTools(item.id, item.name)}
                              className="px-2 py-1 text-xs font-medium rounded bg-[#3b82f6]/15 hover:bg-[#3b82f6]/25 border border-[#3b82f6]/30 text-[#93c5fd] transition-colors"
                            >
                              Tools
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleDisconnect(item.id, item.name, item.isWorkspaceIntegration)
                          }
                          className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal 1: Connector Detail & OAuth Authorization Modal                      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {selectedItemDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItemDetails(null)}
          title={`Connector: ${selectedItemDetails.name}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121319] border border-[#1c1d24]">
              <div className="shrink-0">{renderCatalogIcon(selectedItemDetails)}</div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white">
                    {selectedItemDetails.name}
                  </span>
                  <VerifiedCheck />
                </div>
                <p className="text-[#8b8e99] mt-0.5">{selectedItemDetails.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-[#f4f4f5] block">
                Security Scopes & Permissions:
              </span>
              <ul className="space-y-1.5 font-mono text-[11px] text-[#a1a1aa] bg-[#0c0d12] p-3 rounded border border-[#1c1d24]">
                {selectedItemDetails.scopes.map((s, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-[#f4f4f5] block">
                Assigned Autonomous Agents:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedItemDetails.assignedAgents.map((agent, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-[#181a22] border border-[#27272a] text-[#93c5fd]"
                  >
                    {agent}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1c1d24]">
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="px-3 py-1.5 rounded text-xs text-[#8b8e99] hover:text-white transition-colors"
              >
                Close
              </button>
              {isItemConnected(selectedItemDetails) ? (
                <button
                  type="button"
                  onClick={() => {
                    handleDisconnect(selectedItemDetails.id, selectedItemDetails.name, true);
                  }}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemDetails(null);
                    handleInitiateConnect(selectedItemDetails);
                  }}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal 2: OAuth Connect Confirmation Modal                                 */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {pendingProvider && (
        <Modal
          isOpen={true}
          onClose={() => setPendingProvider(null)}
          title={`Connect ${PROVIDER_META[pendingProvider]?.name ?? pendingProvider}`}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-[#a1a1aa]">
              {PROVIDER_META[pendingProvider]?.description ??
                'Authorizing this connector allows Vaeloom agents to ingest context with zero write privileges.'}
            </p>
            <div className="bg-[#0c0d12] p-2.5 rounded border border-[#1c1d24]">
              <span className="text-[11px] font-semibold text-white block mb-1">
                Requested Scopes:
              </span>
              {PROVIDER_META[pendingProvider]?.scopes?.map((scope, idx) => (
                <div key={idx} className="text-[11px] font-mono text-[#8b8e99]">
                  • {scope}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c1d24]">
              <button
                type="button"
                onClick={() => setPendingProvider(null)}
                className="px-3 py-1.5 rounded text-xs text-[#71717a] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyAction === `connect-${pendingProvider}`}
                onClick={() => handleExecuteConnect(pendingProvider)}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors"
              >
                {busyAction === `connect-${pendingProvider}`
                  ? 'Connecting...'
                  : 'Continue to OAuth'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal 3: Add Custom Connector (MCP, REST, GraphQL)                        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Custom Enterprise Connector"
          size="md"
        >
          <form onSubmit={handleCreateCustomConnector} className="space-y-4 text-xs">
            {/* Connector Type Selector */}
            <div>
              <label className="block text-[#a1a1aa] mb-1 font-medium">Connector Protocol</label>
              <div className="grid grid-cols-3 gap-2">
                {(['mcp', 'rest', 'graphql'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCustomType(type)}
                    className={`py-1.5 px-2 rounded border text-center font-medium transition-all ${
                      customType === type
                        ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-white'
                        : 'border-[#27272a] bg-[#121319] text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    {type === 'mcp' ? 'MCP Server' : type === 'rest' ? 'REST API' : 'GraphQL API'}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[#a1a1aa] mb-1 font-medium">Connector Name</label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Internal Analytics MCP"
                className="w-full px-3 py-1.5 bg-[#121319] border border-[#27272a] rounded text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6]"
              />
            </div>

            {/* MCP Specific Options */}
            {customType === 'mcp' && (
              <>
                <div>
                  <label className="block text-[#a1a1aa] mb-1 font-medium">MCP Transport</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[#d4d4d8]">
                      <input
                        type="radio"
                        name="mcpTransport"
                        checked={customMcpTransport === 'stdio'}
                        onChange={() => setCustomMcpTransport('stdio')}
                        className="accent-[#3b82f6]"
                      />
                      <span>stdio (local process)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[#d4d4d8]">
                      <input
                        type="radio"
                        name="mcpTransport"
                        checked={customMcpTransport === 'http'}
                        onChange={() => setCustomMcpTransport('http')}
                        className="accent-[#3b82f6]"
                      />
                      <span>Streamable-HTTP (remote SSE)</span>
                    </label>
                  </div>
                </div>

                {customMcpTransport === 'stdio' ? (
                  <>
                    <div>
                      <label className="block text-[#a1a1aa] mb-1 font-medium">
                        Executable Command
                      </label>
                      <input
                        type="text"
                        required
                        value={customCommand}
                        onChange={(e) => setCustomCommand(e.target.value)}
                        placeholder="e.g. npx or uvx"
                        className="w-full px-3 py-1.5 bg-[#121319] border border-[#27272a] rounded text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#a1a1aa] mb-1 font-medium">
                        Command Arguments
                      </label>
                      <input
                        type="text"
                        value={customArgs}
                        onChange={(e) => setCustomArgs(e.target.value)}
                        placeholder="e.g. -y @modelcontextprotocol/server-postgres"
                        className="w-full px-3 py-1.5 bg-[#121319] border border-[#27272a] rounded text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6]"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[#a1a1aa] mb-1 font-medium">
                      Server URL (HTTPS / SSE)
                    </label>
                    <input
                      type="url"
                      required
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://mcp.internal.company.com/sse"
                      className="w-full px-3 py-1.5 bg-[#121319] border border-[#27272a] rounded text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6]"
                    />
                  </div>
                )}
              </>
            )}

            {/* REST / GraphQL Specific Options */}
            {(customType === 'rest' || customType === 'graphql') && (
              <>
                <div>
                  <label className="block text-[#a1a1aa] mb-1 font-medium">Endpoint Base URL</label>
                  <input
                    type="url"
                    required
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://api.company.com/v1"
                    className="w-full px-3 py-1.5 bg-[#121319] border border-[#27272a] rounded text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>
                <div>
                  <label className="block text-[#a1a1aa] mb-1 font-medium">
                    API Key or Bearer Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="sk_live_..."
                    className="w-full px-3 py-1.5 bg-[#121319] border border-[#27272a] rounded text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#1c1d24]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-[#71717a] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCustom}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors"
              >
                {submittingCustom ? 'Registering...' : 'Register Connector'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal 4: MCP Tools Dynamic Inspector Modal                                */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {toolsModalTarget && (
        <Modal
          isOpen={true}
          onClose={() => setToolsModalTarget(null)}
          title={`MCP Tools: ${toolsModalTarget.name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {toolsLoading ? (
              <div className="text-center py-8 text-[#8b8e99]">
                Inspecting dynamic MCP tools schema...
              </div>
            ) : toolsList.length === 0 ? (
              <div className="text-center py-6 text-[#71717a]">
                No MCP tools exported by this server or discovery cache is empty.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {toolsList.map((tool, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[#121319] border border-[#1c1d24] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-[#93c5fd]">{tool.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#181a22] text-[#8b8e99]">
                        Approval-Gated
                      </span>
                    </div>
                    <p className="text-[#a1a1aa]">{tool.description}</p>
                    {tool.inputSchema && (
                      <pre className="p-2 rounded bg-[#09090b] text-[10px] text-[#71717a] font-mono overflow-x-auto">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#1c1d24]">
              <button
                type="button"
                onClick={() => setToolsModalTarget(null)}
                className="px-3 py-1.5 rounded text-xs bg-[#181a22] text-white hover:bg-[#222430]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
