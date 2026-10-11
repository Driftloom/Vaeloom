'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/shared/Toast';
import { useWorkspaceConnectors } from '../../../hooks/useWorkspace';
import { api } from '../../../lib/api';
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
} from '../../../lib/api-client';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';
import {
  AUTHORITATIVE_CATALOG,
  CATEGORY_FILTERS,
  type ConnectorCategory,
  type CategoryFilter,
} from '@/lib/connectors-catalog';
import {
  type CatalogRow,
  type ConfiguredItem,
  type ConfiguredStatus,
  ALL_CATEGORY_FILTER,
  PROVIDER_META,
  COMPOSIO_EQUIVALENTS,
  SHELL_METACHARACTERS,
  errorText,
  isCustomConnector,
  parseCommandLineArgs,
  readBuiltinServers,
  rowActionCount,
  rowComposioApp,
  rowId,
  rowIsTop,
  rowName,
  rowProvider,
  rowSearchText,
  matchesCategory,
} from './types';

export interface UseConnectorsStateProps {
  workspaceId: string;
  searchQuery?: string;
  openAddTrigger?: number;
}

export function useConnectorsState({
  workspaceId,
  searchQuery = '',
  openAddTrigger,
}: UseConnectorsStateProps) {
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

  useEffect(() => {
    function handleOAuthMessage(event: MessageEvent) {
      if (typeof window === 'undefined') return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data && data.type === 'COMPOSIO_AUTH_SUCCESS') {
        if (oauthPollRef.current !== null) {
          window.clearTimeout(oauthPollRef.current);
          oauthPollRef.current = null;
        }
        void loadDynamicData();
        void mutate();
        toast({
          tone: 'success',
          title: `${data.app || 'App'} connected`,
          detail: 'OAuth handshake completed. Tools and permissions are now active.',
        });
      } else if (data && data.type === 'COMPOSIO_AUTH_ERROR') {
        if (oauthPollRef.current !== null) {
          window.clearTimeout(oauthPollRef.current);
          oauthPollRef.current = null;
        }
        toast({
          tone: 'error',
          title: 'Authorization failed',
          detail: data.error || 'The provider returned an authorization error.',
        });
      }
    }

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [loadDynamicData, mutate, toast]);

  const byProvider = useMemo(
    () =>
      new Map<string, Connector>(connectors.map((connector) => [connector.provider, connector])),
    [connectors],
  );

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
    () => fullCatalogList.filter((row) => !rowIsTop(row)).slice(0, 36),
    [fullCatalogList],
  );

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
            // failed poll keeps trying
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
    [handleAttachAtsMcp, handleComposioOAuth, toast],
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
    [composioCatalogApps, handleComposioOAuth, loadDynamicData, mutate, toast],
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
            if (SHELL_METACHARACTERS.test(command)) {
              throw new Error(
                'Shell metacharacters (; & | ` $ > <) are not allowed in the command.',
              );
            }
            config['command'] = command;
            const parsedArgs = parseCommandLineArgs(customArgs);
            if (!parsedArgs.ok) {
              throw new Error(parsedArgs.error);
            }
            config['args'] = parsedArgs.argv;
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

  const configuredItems = useMemo<ConfiguredItem[]>(() => {
    const list: ConfiguredItem[] = [];

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

  return {
    workspaceLoading,
    activeSubTab,
    setActiveSubTab,
    internalSearch,
    setInternalSearch,
    selectedFilter,
    setSelectedFilter,
    showAllConnectors,
    setShowAllConnectors,
    dynamicConnectors,
    dynamicError,
    composioCatalogApps,
    composioAppsError,
    composioTotalCount,
    composioEnabled,
    builtinServers,
    builtinError,
    composioSyncing,
    loadingDynamic,
    busyAction,
    setBusyAction,
    syncBusyId,
    isAddModalOpen,
    setIsAddModalOpen,
    selectedItemDetails,
    setSelectedItemDetails,
    pendingProvider,
    setPendingProvider,
    healthTarget,
    setHealthTarget,
    healthLoading,
    pendingDisconnect,
    setPendingDisconnect,
    toolsModalTarget,
    setToolsModalTarget,
    toolsList,
    toolsLoading,
    customType,
    setCustomType,
    customName,
    setCustomName,
    customUrl,
    setCustomUrl,
    customApiKey,
    setCustomApiKey,
    customMcpTransport,
    setCustomMcpTransport,
    customCommand,
    setCustomCommand,
    customArgs,
    setCustomArgs,
    submittingCustom,
    effectiveQuery,
    fullCatalogList,
    activeCategoryFilter,
    filteredCatalog,
    topConnectors,
    otherConnectors,
    configuredItems,
    customConnectors,
    isRowConnected,
    loadDynamicData,
    handleInitiateConnect,
    handleExecuteConnect,
    handleAttachAtsMcp,
    handleComposioOAuth,
    handleSyncAllComposio,
    handleSyncWorkspace,
    handleDynamicSync,
    handleTestConnection,
    handleOpenHealthModal,
    handleInspectTools,
    confirmDisconnect,
    handleCreateCustomConnector,
  };
}
