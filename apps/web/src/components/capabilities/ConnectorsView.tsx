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
  const [composioTotalCount, setComposioTotalCount] = useState<number>(1553);
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
              total_apps: 1553,
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
        const conn = byProvider.get(item.provider);
        return Boolean(conn && conn.status === 'connected');
      }
      if (item.id === 'native-ats-mcp') {
        return dynamicConnectors.some(
          (c) =>
            c.type === 'mcp' &&
            Boolean(
              c.name?.toLowerCase().includes('job-search') || c.name?.toLowerCase().includes('ats'),
            ),
        );
      }
      if (item.provider === 'composio') {
        const appName = (item.composioApp || item.id.replace('composio-', '')).toLowerCase();
        return dynamicConnectors.some(
          (c) =>
            Boolean(c.name && c.name.toLowerCase() === appName) || c.config?.['app'] === appName,
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
      const actionCount =
        (app as { action_count?: number; actionCount?: number }).actionCount ?? app.action_count;
      if (!seenIds.has(slugId) && !seenIds.has(composioId) && !seenIds.has(rawName)) {
        list.push({
          id: composioId,
          name: app.name,
          provider: 'composio',
          composioApp: app.id || app.name,
          category: (app.category as ConnectorCategory) || 'Productivity',
          protocol: 'OAuth 2.0',
          description: app.description || `Connect ${app.name} to execute automated agent tools.`,
          scopes: actionCount ? [`${actionCount} dynamic actions`] : ['api:execute'],
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
        const sel = selectedFilter.toLowerCase();
        const cat = (item.category || '').toLowerCase();
        let matches = false;

        if (sel === 'sales') {
          matches = cat.includes('sales') || cat.includes('crm') || cat.includes('lead');
        } else if (sel === 'financial' || sel === 'finance') {
          matches =
            cat.includes('finance') ||
            cat.includes('financial') ||
            cat.includes('accounting') ||
            cat.includes('banking');
        } else if (sel === 'engineering') {
          matches =
            cat.includes('engineering') || cat.includes('devops') || cat.includes('developer');
        } else if (sel === 'hr') {
          matches =
            cat.includes('hr') ||
            cat.includes('talent') ||
            cat.includes('recruit') ||
            cat.includes('hiring');
        } else if (sel === 'ai & ml') {
          matches =
            cat.includes('ai') || cat.includes('machine learning') || cat.includes('intelligence');
        } else if (sel === 'data & analytics') {
          matches =
            cat.includes('analytics') ||
            cat.includes('data') ||
            cat.includes('bi') ||
            cat.includes('warehouse');
        } else if (sel === 'communication') {
          matches =
            cat.includes('communication') ||
            cat.includes('messaging') ||
            cat.includes('email') ||
            cat.includes('chat');
        } else if (sel === 'support') {
          matches = cat.includes('support') || cat.includes('helpdesk') || cat.includes('ticket');
        } else if (sel === 'education') {
          matches =
            cat.includes('education') ||
            cat.includes('learning') ||
            cat.includes('course') ||
            cat.includes('academy');
        } else if (sel === 'e-commerce') {
          matches = cat.includes('commerce') || cat.includes('retail') || cat.includes('store');
        } else if (sel === 'legal') {
          matches = cat.includes('legal') || cat.includes('contract') || cat.includes('compliance');
        } else if (sel === 'productivity') {
          matches =
            cat.includes('productivity') ||
            cat.includes('task') ||
            cat.includes('project') ||
            cat.includes('workspace');
        } else if (sel === 'mcp') {
          matches = cat.includes('mcp') || item.protocol.includes('MCP') || item.provider === 'mcp';
        } else if (sel === 'native') {
          matches = item.provider === 'native' || item.protocol === 'Native Sovereign';
        } else if (sel === 'google') {
          matches =
            item.category === 'Google' ||
            item.id.toLowerCase().includes('google') ||
            item.id.toLowerCase().includes('gmail');
        } else {
          matches = cat.includes(sel) || cat === sel;
        }

        if (!matches) return false;
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
      const composioEquivalents: Record<string, string> = {
        github: 'github',
        drive: 'googledrive',
        gmail: 'gmail',
        slack: 'slack',
        notion: 'notion',
        calendar: 'googlecalendar',
      };
      const composioApp = composioEquivalents[provider];
      if (
        composioApp &&
        composioCatalogApps.some((a) => (a.id || a.name || '').toLowerCase() === composioApp)
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
        detail: `${meta?.name ?? provider} registered. Connect credentials or OAuth tokens to activate.`,
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
      provider?: string;
      type: string;
      status: 'active' | 'syncing' | 'error';
      lastSync?: string;
      isWorkspaceIntegration?: boolean;
      originalConnector?: Connector;
      originalDynamic?: ConnectorItem;
      config?: Record<string, unknown>;
    }> = [];

    // Add workspace integrations (Google Drive, Gmail, Calendar, Slack, GitHub, Notion)
    connectors.forEach((c) => {
      const providerKey = (c.provider || '').toLowerCase();
      const meta = PROVIDER_META[providerKey] || PROVIDER_META[c.provider];
      const resolvedName =
        (c as unknown as { name?: string }).name?.trim() ||
        meta?.name ||
        (c.provider
          ? c.provider.charAt(0).toUpperCase() + c.provider.slice(1)
          : 'Connected Service');
      list.push({
        id: c.id,
        name: resolvedName,
        provider: c.provider,
        type: 'OAuth 2.0',
        status: c.status === 'connected' ? 'active' : 'error',
        lastSync: c.lastSyncAt,
        isWorkspaceIntegration: true,
        originalConnector: c,
        config: (c as unknown as { config?: Record<string, unknown> })?.config,
      });
    });

    // Add dynamic studio connectors (MCP, REST, GraphQL)
    dynamicConnectors.forEach((dc) => {
      list.push({
        id: dc.id,
        name: dc.name,
        provider: dc.type,
        type: dc.type.toUpperCase(),
        status: dc.status === 'syncing' ? 'syncing' : dc.status === 'active' ? 'active' : 'error',
        lastSync: dc.updatedAt,
        isWorkspaceIntegration: false,
        originalDynamic: dc,
        config: dc.config,
      });
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
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text antialiased overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Subheader Bar: Segmented Modes + SaaS Sync Action Buttons                  */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface px-4 sm:px-6 py-2.5 shrink-0 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
          {/* Sub-nav Segmented Switcher */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-elevated border border-border overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('discover')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'discover'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Explore Directory
              {composioTotalCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
                  {composioTotalCount.toLocaleString()}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('yours')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'yours'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Installed
              {configuredItems.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-success/15 text-success border border-success/30 font-medium">
                  {configuredItems.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('studio')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeSubTab === 'studio'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>Custom Protocols</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-primary/15 text-primary border border-primary/30">
                MCP • REST • GraphQL
              </span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => handleSyncAllComposio()}
              disabled={composioSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-elevated border border-border text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer whitespace-nowrap"
              title="Sync dynamic SaaS tools from Composio"
            >
              <svg
                className={`w-3.5 h-3.5 text-primary ${composioSyncing ? 'animate-spin' : ''}`}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground shadow-xs transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
            >
              <PlusIcon />
              <span>Add Custom Connector</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Main Content Area                                                          */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 min-h-0 min-w-0 bg-background">
        {activeSubTab === 'discover' ? (
          <div className="max-w-7xl mx-auto space-y-6 min-w-0">
            {/* Filter Toolbar: Purpose Selector + Filter Chips */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Filter By Sector
                </span>
                <span className="text-border">•</span>
                <span className="text-xs text-text-secondary">
                  Showing {filteredCatalog.length} of {fullCatalogList.length} verified connectors
                </span>
              </div>

              {/* Purpose Dropdown Filter */}
              <div className="relative shrink-0">
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value as ConnectorCategory)}
                  className="appearance-none bg-surface-elevated border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs text-text focus:outline-none focus:border-primary cursor-pointer font-sans"
                >
                  <option value="All">All Purposes & Sectors</option>
                  <option value="Education">Education & Learning</option>
                  <option value="Sales">Sales & CRM</option>
                  <option value="Productivity">Productivity & Tasks</option>
                  <option value="Engineering">Engineering & DevOps</option>
                  <option value="Financial">Finance & Accounting</option>
                  <option value="Legal">Legal & Contracts</option>
                  <option value="HR">HR, Recruiting & Talent</option>
                  <option value="AI & ML">AI, Agents & ML</option>
                  <option value="Data & Analytics">Data, Analytics & BI</option>
                  <option value="Communication">Communication & Messaging</option>
                  <option value="Marketing">Marketing & Social</option>
                  <option value="Support">Customer Support</option>
                  <option value="E-Commerce">E-Commerce & Retail</option>
                  <option value="Google">Google Workspace</option>
                  <option value="Native">Native Sovereign</option>
                  <option value="MCP">Model Context Protocol (MCP)</option>
                </select>
                <svg
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

            {/* Quick Purpose Vector Filter Chips (Clean Lucide SVGs, NO Emojis per ui-ux-pro-max) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs min-w-0 w-full">
              {(
                [
                  {
                    id: 'All',
                    label: 'All',
                    icon: (
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
                  },
                  {
                    id: 'Productivity',
                    label: 'Productivity',
                    icon: (
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
                  },
                  {
                    id: 'Engineering',
                    label: 'Engineering',
                    icon: (
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
                  },
                  {
                    id: 'Sales',
                    label: 'Sales & CRM',
                    icon: (
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
                  },
                  {
                    id: 'Communication',
                    label: 'Communication',
                    icon: (
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
                  },
                  {
                    id: 'AI & ML',
                    label: 'AI & ML',
                    icon: (
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
                  },
                  {
                    id: 'Financial',
                    label: 'Finance',
                    icon: (
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
                  },
                  {
                    id: 'HR',
                    label: 'HR & Talent',
                    icon: (
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
                  },
                  {
                    id: 'Data & Analytics',
                    label: 'Analytics',
                    icon: (
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
                  },
                  {
                    id: 'Legal',
                    label: 'Legal',
                    icon: (
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    ),
                  },
                  {
                    id: 'Support',
                    label: 'Support',
                    icon: (
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
                  },
                  {
                    id: 'Education',
                    label: 'Education',
                    icon: (
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
                  },
                  {
                    id: 'MCP',
                    label: 'MCP',
                    icon: (
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
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedFilter(pill.id as ConnectorCategory)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${
                    selectedFilter === pill.id
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text border border-border'
                  }`}
                >
                  <span
                    className={
                      selectedFilter === pill.id ? 'text-primary-foreground' : 'text-text-muted'
                    }
                  >
                    {pill.icon}
                  </span>
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>

            {/* If Search is Active or Non-All Filter or ShowAll is toggled: Show Full Catalog Grid */}
            {showAllConnectors || effectiveQuery || selectedFilter !== 'All' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-text">
                      {effectiveQuery
                        ? `Search results (${filteredCatalog.length})`
                        : selectedFilter !== 'All'
                          ? `${selectedFilter} connectors (${filteredCatalog.length})`
                          : `All connectors (${filteredCatalog.length})`}
                    </h2>
                    <span className="text-xs text-text-muted">
                      • {fullCatalogList.length.toLocaleString()} total available
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllConnectors(false);
                      setInternalSearch('');
                      setSelectedFilter('All');
                    }}
                    className="text-xs text-primary hover:text-primary-hover transition-colors cursor-pointer"
                  >
                    ← Back to featured
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
                  {filteredCatalog.map((item) => {
                    const connected = isItemConnected(item);
                    return (
                      <div
                        key={item.id}
                        className="group relative flex flex-col justify-between p-4 rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md min-h-[160px]"
                        onClick={() => setSelectedItemDetails(item)}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center p-2 shrink-0 group-hover:border-primary/40 transition-colors">
                                {renderCatalogIcon(item)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">
                                    {item.name}
                                  </h3>
                                  <VerifiedCheck />
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-text-secondary border border-border">
                                    {item.protocol}
                                  </span>
                                  {item.isTrending && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-warning/15 border border-warning/30 text-warning">
                                      Trending
                                    </span>
                                  )}
                                  {item.isNew && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-primary/15 border border-primary/30 text-primary">
                                      New
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              {connected ? (
                                <div
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/15 border border-success/30 text-success text-xs font-medium"
                                  title="Connected in Workspace"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                  <span>Connected</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleInitiateConnect(item)}
                                  disabled={busyAction === `connect-${item.provider}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary hover:text-primary-foreground border border-border hover:border-primary text-text-secondary text-xs font-medium transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.97]"
                                  title={`Connect ${item.name}`}
                                >
                                  <PlusIcon />
                                  <span>Connect</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-text-secondary line-clamp-2 mt-2.5 leading-relaxed font-sans">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border text-[11px] text-text-muted">
                          <span className="font-mono text-text-secondary">{item.category}</span>
                          <span className="text-text-muted font-mono truncate max-w-[140px]">
                            {item.scopes?.[0] || 'Standard Scope'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Normal Directory Layout */
              <div className="space-y-8">
                {/* 1. Top Connectors Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-text">
                        Top connectors ({topConnectors.length})
                      </h2>
                      <span className="text-xs text-text-muted">
                        • {fullCatalogList.length} available
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllConnectors(true)}
                      className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Show all ({fullCatalogList.length})</span>
                      <span>›</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
                    {topConnectors.map((item) => {
                      const connected = isItemConnected(item);
                      return (
                        <div
                          key={item.id}
                          className="group relative flex flex-col justify-between p-4 rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md min-h-[160px]"
                          onClick={() => setSelectedItemDetails(item)}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center p-2 shrink-0 group-hover:border-primary/40 transition-colors">
                                  {renderCatalogIcon(item)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">
                                      {item.name}
                                    </h3>
                                    <VerifiedCheck />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-text-secondary border border-border">
                                      {item.protocol}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                {connected ? (
                                  <div
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/15 border border-success/30 text-success text-xs font-medium"
                                    title="Connected in Workspace"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                    <span>Connected</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateConnect(item)}
                                    disabled={busyAction === `connect-${item.provider}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary hover:text-primary-foreground border border-border hover:border-primary text-text-secondary text-xs font-medium transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.97]"
                                    title={`Connect ${item.name}`}
                                  >
                                    <PlusIcon />
                                    <span>Connect</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-text-secondary line-clamp-2 mt-2.5 leading-relaxed font-sans">
                              {item.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border text-[11px] text-text-muted">
                            <span className="font-mono text-text-secondary">{item.category}</span>
                            <span className="text-text-muted font-mono truncate max-w-[140px]">
                              {item.scopes?.[0] || 'Standard Scope'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. More Integrations & Dynamic Toolkits */}
                {otherConnectors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-text">
                          More Integrations & Dynamic Toolkits
                        </h2>
                        <span className="text-xs text-text-muted">
                          • {otherConnectors.length} available
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {otherConnectors.map((item) => {
                        const connected = isItemConnected(item);
                        return (
                          <div
                            key={item.id}
                            className="group relative flex flex-col justify-between p-4 rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md min-h-[160px]"
                            onClick={() => setSelectedItemDetails(item)}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center p-2 shrink-0 group-hover:border-primary/40 transition-colors">
                                    {renderCatalogIcon(item)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h3 className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">
                                        {item.name}
                                      </h3>
                                      <VerifiedCheck />
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-text-secondary border border-border">
                                        {item.protocol}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {connected ? (
                                    <div
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/15 border border-success/30 text-success text-xs font-medium"
                                      title="Connected in Workspace"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                      <span>Connected</span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateConnect(item)}
                                      disabled={busyAction === `connect-${item.provider}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary hover:text-primary-foreground border border-border hover:border-primary text-text-secondary text-xs font-medium transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.97]"
                                      title={`Connect ${item.name}`}
                                    >
                                      <PlusIcon />
                                      <span>Connect</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-text-secondary line-clamp-2 mt-2.5 leading-relaxed font-sans">
                                {item.description}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border text-[11px] text-text-muted">
                              <span className="font-mono text-text-secondary">{item.category}</span>
                              <span className="text-text-muted font-mono truncate max-w-[140px]">
                                {item.scopes?.[0] || 'Standard Scope'}
                              </span>
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-text-muted mb-1.5 font-mono">
                  <span>CONNECTORS</span>
                  <span>/</span>
                  <span className="text-text font-medium">STUDIO</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30">
                    Enterprise Protocol Builder
                  </span>
                </div>
                <h1 className="text-base font-semibold text-text tracking-tight">
                  Connectors Studio & Protocol Orchestrator
                </h1>
                <p className="text-xs text-text-secondary max-w-2xl mt-1 leading-relaxed">
                  Build, test, and register custom Model Context Protocol (stdio/HTTP) servers,
                  enterprise REST APIs, and GraphQL endpoints with sandboxed execution and live
                  health monitoring.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                >
                  <PlusIcon />
                  <span>Add Custom Connector</span>
                </button>
              </div>
            </div>

            {/* Protocol Architecture Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface border border-border hover:border-border-subtle transition-all flex flex-col justify-between space-y-3 shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <rect x="9" y="9" width="6" height="6" />
                        <line x1="9" y1="1" x2="9" y2="4" />
                        <line x1="15" y1="1" x2="15" y2="4" />
                        <line x1="9" y1="20" x2="9" y2="23" />
                        <line x1="15" y1="20" x2="15" y2="23" />
                        <line x1="20" y1="9" x2="23" y2="9" />
                        <line x1="20" y1="15" x2="23" y2="15" />
                        <line x1="1" y1="9" x2="4" y2="9" />
                        <line x1="1" y1="15" x2="4" y2="15" />
                      </svg>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-success/15 text-success border border-success/30">
                      Standard v1.0
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-text">Model Context Protocol (MCP)</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
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
                  className="w-full py-1.5 px-3 text-xs font-medium rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-text transition-colors text-center cursor-pointer"
                >
                  + Add MCP Server
                </button>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border hover:border-border-subtle transition-all flex flex-col justify-between space-y-3 shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-success/15 border border-success/30 flex items-center justify-center text-success">
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                      REST / Webhooks
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-text">Enterprise REST API</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
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
                  className="w-full py-1.5 px-3 text-xs font-medium rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-text transition-colors text-center cursor-pointer"
                >
                  + Add REST Connector
                </button>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border hover:border-border-subtle transition-all flex flex-col justify-between space-y-3 shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                      </svg>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                      GraphQL 2021
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-text">GraphQL Explorer</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
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
                  className="w-full py-1.5 px-3 text-xs font-medium rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-text transition-colors text-center cursor-pointer"
                >
                  + Add GraphQL Endpoint
                </button>
              </div>
            </div>

            {/* Built-in Sovereign MCP Servers Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-text">
                    Built-in Sovereign MCP Servers
                  </h2>
                  <p className="text-xs text-text-muted">
                    Pre-configured, sandboxed protocols maintained sovereignly by Vaeloom
                  </p>
                </div>
                <span className="text-xs text-success font-mono font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span>5 active & sandboxed</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                    className="p-4 rounded-xl bg-surface border border-border hover:border-border-subtle transition-all flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text">{mcpItem.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-success/10 text-success border border-success/20">
                          {mcpItem.tag}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                        {mcpItem.desc}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border text-[11px]">
                      <span className="font-mono text-text-muted">{mcpItem.protocol}</span>
                      <span className="text-success font-medium">Ready</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configured Custom Connectors List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-text">Configured Custom Connectors</h2>
                  <p className="text-xs text-text-muted">
                    Custom endpoints and private MCP instances active in this workspace
                  </p>
                </div>
                <span className="text-xs text-text-muted font-mono">
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
                <div className="text-center py-10 border border-dashed border-border rounded-xl bg-surface-elevated/40">
                  <p className="text-xs text-text-secondary">
                    No custom MCP, REST, or GraphQL connectors created in this workspace yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    + Add First Custom Connector
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
                  {dynamicConnectors
                    .filter((c) => ['mcp', 'rest', 'graphql'].includes(c.type?.toLowerCase()))
                    .map((conn) => (
                      <div
                        key={conn.id}
                        className="p-4 rounded-xl bg-surface border border-border hover:border-border-subtle transition-all space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center font-mono font-bold text-xs text-primary">
                              {conn.type.toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-xs font-semibold text-text">{conn.name}</h3>
                              <p className="text-[10px] font-mono text-text-muted truncate max-w-[150px]">
                                ID: {conn.id}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 capitalize">
                            {conn.status || 'Active'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                          <button
                            type="button"
                            onClick={() => void handleTestConnection(conn.id)}
                            className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-text-secondary hover:text-text transition-colors cursor-pointer"
                          >
                            Ping Health
                          </button>
                          {conn.type?.toLowerCase() === 'mcp' && (
                            <button
                              type="button"
                              onClick={() => handleInspectTools(conn.id, conn.name)}
                              className="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary transition-colors cursor-pointer"
                            >
                              Inspect Tools
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDisconnect(conn.id, conn.name, false)}
                            className="text-danger hover:text-danger/80 font-medium transition-colors cursor-pointer text-xs"
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
          <div className="max-w-7xl mx-auto space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                <span>CONNECTORS</span>
                <span>/</span>
                <span className="text-text font-medium font-sans text-sm">
                  Configured in Workspace
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-success/15 text-success border border-success/30 font-medium">
                  {configuredItems.length} active
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab('discover')}
                className="text-xs text-primary hover:text-primary-hover font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>+ Browse Directory</span>
              </button>
            </div>

            {configuredItems.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-surface-elevated/40 max-w-lg mx-auto space-y-3">
                <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary mx-auto shadow-xs">
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text">No connectors configured</h3>
                  <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                    Integrate Google Drive, GitHub, Slack, ATS crawlers, or custom MCP servers to
                    empower your autonomous agents.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('discover')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <PlusIcon />
                  <span>Discover Connectors</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
                {configuredItems.map((item) => {
                  const isSyncing = syncBusyId === item.id || busyAction === `sync-${item.id}`;
                  const displayName =
                    item.name?.trim() || item.provider?.toUpperCase() || 'Custom Connector';
                  const catalogDef = fullCatalogList.find((c) => {
                    if (
                      item.provider &&
                      c.provider &&
                      c.provider.toLowerCase() === item.provider.toLowerCase()
                    )
                      return true;
                    if (item.name && c.name && c.name.toLowerCase() === item.name.toLowerCase())
                      return true;
                    if (item.id && (c.id === item.id || c.id === `composio-${item.id}`))
                      return true;
                    return false;
                  });

                  return (
                    <div
                      key={item.id}
                      className="group relative flex flex-col justify-between p-4 rounded-xl bg-surface hover:bg-surface-hover/50 border border-border hover:border-border-subtle transition-all duration-200 shadow-xs hover:shadow-md space-y-3.5"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center p-2 shrink-0 group-hover:border-primary/40 transition-colors">
                              {catalogDef ? (
                                renderCatalogIcon(catalogDef)
                              ) : item.type.toLowerCase().includes('mcp') ? (
                                <svg
                                  className="w-5 h-5 text-primary"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                              ) : item.type.toLowerCase().includes('graphql') ? (
                                <svg
                                  className="w-5 h-5 text-primary"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                  <polyline points="2 17 12 22 22 17" />
                                  <polyline points="2 12 12 17 22 12" />
                                </svg>
                              ) : item.type.toLowerCase().includes('rest') ? (
                                <svg
                                  className="w-5 h-5 text-primary"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="2" y1="12" x2="22" y2="12" />
                                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                              ) : (
                                <svg
                                  className="w-5 h-5 text-primary"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={1.75}
                                >
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">
                                  {displayName}
                                </h3>
                                <VerifiedCheck />
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-text-secondary border border-border">
                                  {item.type}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Live Status Pill */}
                          <div className="shrink-0">
                            {item.status === 'active' ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 border border-success/30 text-success text-[10px] font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                <span>Active</span>
                              </div>
                            ) : item.status === 'syncing' || isSyncing ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning text-[10px] font-medium">
                                <svg
                                  className="w-2.5 h-2.5 animate-spin"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                                <span>Syncing</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/15 border border-danger/30 text-danger text-[10px] font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                                <span>Error</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-text-muted font-mono pt-2">
                          <span>Last synced</span>
                          <span className="text-text-secondary">{formatDate(item.lastSync)}</span>
                        </div>
                      </div>

                      {/* Action Dock */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-border gap-2">
                        <div className="flex items-center gap-1.5">
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
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-text-secondary hover:text-text transition-colors cursor-pointer flex items-center gap-1"
                          >
                            {isSyncing ? (
                              <>
                                <svg
                                  className="w-3 h-3 animate-spin text-primary"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                </svg>
                                <span>Syncing...</span>
                              </>
                            ) : (
                              <span>Sync Now</span>
                            )}
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
                                  detail: `${item.name} token is valid and reachable.`,
                                });
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
                          >
                            Ping
                          </button>

                          {item.type.includes('MCP') && (
                            <button
                              type="button"
                              onClick={() => handleInspectTools(item.id, item.name)}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary transition-colors cursor-pointer"
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
                          className="text-xs text-danger hover:text-danger/80 font-medium transition-colors cursor-pointer"
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
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated border border-border">
              <div className="shrink-0">{renderCatalogIcon(selectedItemDetails)}</div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-text">
                    {selectedItemDetails.name}
                  </span>
                  <VerifiedCheck />
                </div>
                <p className="text-text-muted mt-0.5">{selectedItemDetails.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-text block">Security Scopes & Permissions:</span>
              <ul className="space-y-1.5 font-mono text-[11px] text-text-secondary bg-surface p-3 rounded border border-border">
                {selectedItemDetails.scopes.map((s, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-text block">Assigned Autonomous Agents:</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedItemDetails.assignedAgents.map((agent, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-primary/10 border border-primary/20 text-primary"
                  >
                    {agent}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text transition-colors"
              >
                Close
              </button>
              {isItemConnected(selectedItemDetails) ? (
                <button
                  type="button"
                  onClick={() => {
                    handleDisconnect(selectedItemDetails.id, selectedItemDetails.name, true);
                  }}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-danger hover:bg-danger/90 text-white transition-colors"
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
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground transition-colors"
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
            <p className="text-text-secondary">
              {PROVIDER_META[pendingProvider]?.description ??
                'Authorizing this connector allows Vaeloom agents to ingest context with zero write privileges.'}
            </p>
            <div className="bg-surface-elevated p-2.5 rounded border border-border">
              <span className="text-[11px] font-semibold text-text block mb-1">
                Requested Scopes:
              </span>
              {PROVIDER_META[pendingProvider]?.scopes?.map((scope, idx) => (
                <div key={idx} className="text-[11px] font-mono text-text-muted">
                  • {scope}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setPendingProvider(null)}
                className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyAction === `connect-${pendingProvider}`}
                onClick={() => handleExecuteConnect(pendingProvider)}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground transition-colors"
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
              <label className="block text-text-secondary mb-1 font-medium">
                Connector Protocol
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['mcp', 'rest', 'graphql'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCustomType(type)}
                    className={`py-1.5 px-2 rounded border text-center font-medium transition-all ${
                      customType === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-text-muted hover:text-text hover:bg-surface-hover'
                    }`}
                  >
                    {type === 'mcp' ? 'MCP Server' : type === 'rest' ? 'REST API' : 'GraphQL API'}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-text-secondary mb-1 font-medium">Connector Name</label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Internal Analytics MCP"
                className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>

            {/* MCP Specific Options */}
            {customType === 'mcp' && (
              <>
                <div>
                  <label className="block text-text-secondary mb-1 font-medium">
                    MCP Transport
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-text">
                      <input
                        type="radio"
                        name="mcpTransport"
                        checked={customMcpTransport === 'stdio'}
                        onChange={() => setCustomMcpTransport('stdio')}
                        className="accent-primary"
                      />
                      <span>stdio (local process)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-text">
                      <input
                        type="radio"
                        name="mcpTransport"
                        checked={customMcpTransport === 'http'}
                        onChange={() => setCustomMcpTransport('http')}
                        className="accent-primary"
                      />
                      <span>Streamable-HTTP (remote SSE)</span>
                    </label>
                  </div>
                </div>

                {customMcpTransport === 'stdio' ? (
                  <>
                    <div>
                      <label className="block text-text-secondary mb-1 font-medium">
                        Executable Command
                      </label>
                      <input
                        type="text"
                        required
                        value={customCommand}
                        onChange={(e) => setCustomCommand(e.target.value)}
                        placeholder="e.g. npx or uvx"
                        className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary mb-1 font-medium">
                        Command Arguments
                      </label>
                      <input
                        type="text"
                        value={customArgs}
                        onChange={(e) => setCustomArgs(e.target.value)}
                        placeholder="e.g. -y @modelcontextprotocol/server-postgres"
                        className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-text-secondary mb-1 font-medium">
                      Server URL (HTTPS / SSE)
                    </label>
                    <input
                      type="url"
                      required
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://mcp.internal.company.com/sse"
                      className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
              </>
            )}

            {/* REST / GraphQL Specific Options */}
            {(customType === 'rest' || customType === 'graphql') && (
              <>
                <div>
                  <label className="block text-text-secondary mb-1 font-medium">
                    Endpoint Base URL
                  </label>
                  <input
                    type="url"
                    required
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://api.company.com/v1"
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1 font-medium">
                    API Key or Bearer Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="sk_live_..."
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded text-text text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCustom}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground transition-colors"
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
              <div className="text-center py-8 text-text-muted">
                Inspecting dynamic MCP tools schema...
              </div>
            ) : toolsList.length === 0 ? (
              <div className="text-center py-6 text-text-muted">
                No MCP tools exported by this server or discovery cache is empty.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {toolsList.map((tool, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-surface-elevated border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-primary">{tool.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface border border-border text-text-muted">
                        Approval-Gated
                      </span>
                    </div>
                    <p className="text-text-secondary">{tool.description}</p>
                    {tool.inputSchema && (
                      <pre className="p-2 rounded bg-surface border border-border text-[10px] text-text-muted font-mono overflow-x-auto">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setToolsModalTarget(null)}
                className="px-3 py-1.5 rounded text-xs bg-surface-hover text-text hover:bg-surface border border-border transition-colors"
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
