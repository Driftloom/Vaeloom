'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  Spinner,
  StatusDot,
  TabPanel,
  Tabs,
} from '@vaeloom/ui-kit';
import type { StatusDotProps } from '@vaeloom/ui-kit';
import { connectorsApi, type ConnectorHealthResponse, type McpToolInfo } from '@/lib/api-client';
import { useWorkspaceConnectors } from '../../../../../../hooks/useWorkspace';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { CapabilitySubpageSkeleton } from '@/components/capabilities/CapabilitySubpageSkeleton';

type StatusDotType = NonNullable<StatusDotProps['status']>;
type SubTab = 'overview' | 'tools' | 'security' | 'health';

interface UnifiedConnector {
  id: string;
  name: string;
  provider: string;
  protocol: string;
  status: string;
  description: string;
  accountEmail?: string;
  lastSyncedAt?: string | null;
  errorDetail?: string;
  scopes?: string[] | null;
}

export default function ConnectorSubpage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const connectorId = (params?.['connectorId'] as string) || '';
  const decodedConnectorId = decodeURIComponent(connectorId);

  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<ConnectorHealthResponse | null>(null);
  const [syncingTools, setSyncingTools] = useState(false);

  const { connectors, isLoading: loadingConnectors } = useWorkspaceConnectors(workspaceId);

  const { data: serverConnector, isLoading: loadingServerConnector } = useSWR(
    decodedConnectorId ? ['connector-item', decodedConnectorId] : null,
    async () => {
      try {
        return await connectorsApi.get(decodedConnectorId);
      } catch {
        return null;
      }
    },
    { revalidateOnFocus: false },
  );

  const connector: UnifiedConnector | null = useMemo(() => {
    if (!decodedConnectorId) return null;
    if (serverConnector) {
      return {
        id: serverConnector.id,
        name: serverConnector.name,
        provider: serverConnector.type,
        protocol: serverConnector.type.toUpperCase(),
        status: serverConnector.status,
        description: `Workspace connector bridging ${serverConnector.name} via ${serverConnector.type.toUpperCase()} protocol.`,
        lastSyncedAt: serverConnector.lastSyncedAt,
        scopes: serverConnector.scopes,
      };
    }
    const match = connectors?.find(
      (c) =>
        c.id === decodedConnectorId ||
        c.provider.toLowerCase() === decodedConnectorId.toLowerCase(),
    );
    if (!match) return null;
    return {
      id: match.id,
      name: match.provider.charAt(0).toUpperCase() + match.provider.slice(1),
      provider: match.provider,
      protocol: 'OAUTH2 / REST',
      status: match.status,
      description: `Integrated workspace connector for ${match.provider}.`,
      accountEmail: match.accountEmail,
      lastSyncedAt: match.lastSyncAt,
      errorDetail: match.errorDetail,
    };
  }, [serverConnector, connectors, decodedConnectorId]);

  const {
    data: toolsData,
    isLoading: loadingTools,
    mutate: mutateTools,
  } = useSWR(
    connector?.id ? ['connector-tools', connector.id] : null,
    async () => {
      try {
        const res = await connectorsApi.mcp.listTools(connector!.id);
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    { revalidateOnFocus: false },
  );

  const tools: McpToolInfo[] = toolsData ?? [];

  const handleTestHealth = useCallback(async () => {
    if (!connector) return;
    setTestingHealth(true);
    try {
      const res = await connectorsApi.health(connector.id);
      setHealthStatus(res);
      const latency =
        (res as unknown as Record<string, unknown>)['latency_ms'] ??
        (res as unknown as Record<string, unknown>)['latencyMs'] ??
        0;
      toast({
        tone: res.status === 'healthy' ? 'success' : 'warning',
        title: `Health check: ${res.status}`,
        detail: `Latency: ${String(latency)}ms`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Health check failed',
        detail: err instanceof Error ? err.message : 'Could not contact connector.',
      });
    } finally {
      setTestingHealth(false);
    }
  }, [connector, toast]);

  const handleSyncTools = useCallback(async () => {
    if (!connector) return;
    setSyncingTools(true);
    try {
      const res = await connectorsApi.mcp.sync(connector.id, workspaceId);
      void mutateTools();
      toast({
        tone: 'success',
        title: 'Tools synchronized',
        detail: `Registered ${res.registered?.length ?? 0} tools in workspace.`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync failed',
        detail: err instanceof Error ? err.message : 'Tool sync failed.',
      });
    } finally {
      setSyncingTools(false);
    }
  }, [connector, workspaceId, mutateTools, toast]);

  const breadcrumbsBackUrl = `/workspace/${workspaceId}/capabilities?category=connectors`;

  const connectorTitle = connector?.name ?? decodedConnectorId;
  const connectorDesc =
    connector?.description ||
    'Inspect protocol bindings, auth state, and exposed tools for this connector.';

  const breadcrumbItems = [
    { label: 'Capabilities', href: `/workspace/${workspaceId}/capabilities` },
    { label: 'Connectors', href: breadcrumbsBackUrl },
    { label: connectorTitle, current: true },
  ];

  const subTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tools', label: `Tools (${tools.length})` },
    { id: 'security', label: 'Security & Auth' },
    { id: 'health', label: 'Health Diagnostics' },
  ];

  const statusDotType: StatusDotType = useMemo(() => {
    if (!connector) return 'idle';
    if (
      connector.status === 'connected' ||
      connector.status === 'active' ||
      connector.status === 'synced'
    ) {
      return 'active';
    }
    if (connector.status === 'error') return 'error';
    if (connector.status === 'syncing') return 'warning';
    return 'idle';
  }, [connector]);

  const isPageLoading = loadingConnectors && loadingServerConnector;

  return (
    <div className="flex flex-col h-full min-h-0 bg-background text-text antialiased overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4 border-b border-border bg-surface">
        <PageHeader
          title={connectorTitle}
          description={connectorDesc}
          eyebrow="Connector Integration"
          breadcrumb={<Breadcrumb items={breadcrumbItems} />}
          actions={
            <div className="flex items-center gap-3">
              <Link
                href={breadcrumbsBackUrl}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg"
              >
                <Button variant="secondary" size="sm">
                  Back to Connectors
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                disabled={testingHealth || !connector}
                onClick={() => void handleTestHealth()}
              >
                {testingHealth ? <Spinner size="sm" /> : 'Run Health Check'}
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
        {isPageLoading && !connector ? (
          <CapabilitySubpageSkeleton eyebrow="Connector Integration" />
        ) : !connector ? (
          <div className="max-w-xl mx-auto py-12">
            <EmptyState
              title={`Connector "${decodedConnectorId}" not found`}
              description="This connector may not be configured in this workspace."
              action={{
                label: 'View all Connectors',
                onClick: () => router.push(breadcrumbsBackUrl),
              }}
            />
          </div>
        ) : connector ? (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Status Card */}
            <div className="p-4 rounded-xl border border-border-subtle bg-surface flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <StatusDot status={statusDotType} />
                <div>
                  <div className="text-sm font-semibold text-text">{connectorTitle}</div>
                  <div className="text-xs text-text-muted font-mono">{connector.provider}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm">
                  {connector.protocol}
                </Badge>
                <Badge
                  variant={
                    connector.status === 'connected' || connector.status === 'active'
                      ? 'success'
                      : 'warning'
                  }
                  size="sm"
                >
                  {connector.status || 'Configured'}
                </Badge>
                <Badge variant="mono" size="sm">
                  ID: {connector.id}
                </Badge>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-border-subtle">
              <Tabs
                ariaLabel="Connector Inspection Subtabs"
                size="sm"
                tabs={subTabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as SubTab)}
              />
            </div>

            <TabPanel id="overview" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">Connector Overview</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {connector.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-subtle text-xs">
                  <div>
                    <span className="text-text-muted">Provider:</span>
                    <span className="ml-2 font-medium text-text">{connector.provider}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Protocol:</span>
                    <span className="ml-2 font-medium text-text">{connector.protocol}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Auth Status:</span>
                    <span className="ml-2 font-medium text-text">{connector.status}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Workspace Isolation:</span>
                    <span className="ml-2 font-medium text-text">Enforced (RLS scoped)</span>
                  </div>
                  {connector.accountEmail && (
                    <div>
                      <span className="text-text-muted">Bound Account:</span>
                      <span className="ml-2 font-mono text-text">{connector.accountEmail}</span>
                    </div>
                  )}
                  {connector.lastSyncedAt && (
                    <div>
                      <span className="text-text-muted">Last Synced:</span>
                      <span className="ml-2 text-text">
                        {new Date(connector.lastSyncedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabPanel>

            <TabPanel id="tools" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text">Attached Tools & Functions</h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={syncingTools}
                    onClick={() => void handleSyncTools()}
                  >
                    Refresh Tools
                  </Button>
                </div>

                {loadingTools ? (
                  <div className="py-8 flex justify-center">
                    <Spinner size="md" />
                  </div>
                ) : tools.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted">
                    No tools currently bridged through this connector. Click &quot;Sync Tools&quot;
                    to register available operations.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="p-3.5 rounded-lg border border-border-subtle bg-surface-elevated space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-text">
                            {tool.name}
                          </span>
                          <Badge variant="mono" size="sm">
                            Bridged Tool
                          </Badge>
                        </div>
                        <p className="text-xs text-text-secondary">{tool.description}</p>
                        {tool.inputSchema && (
                          <details className="text-[11px] font-mono text-text-muted">
                            <summary className="cursor-pointer hover:text-text">
                              View Input Schema
                            </summary>
                            <pre className="p-2 mt-1 rounded bg-surface border border-border overflow-x-auto">
                              {JSON.stringify(tool.inputSchema, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel id="security" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">
                  Security & Credential Governance
                </h3>
                <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                  <div className="p-3 rounded-lg border border-border-subtle bg-surface-elevated">
                    <div className="font-semibold text-text mb-1">Encrypted Vault Storage</div>
                    <div>
                      All connector credentials, OAuth refresh tokens, and API secrets are encrypted
                      at rest using AES-256-GCM envelope encryption. Secrets are never logged or
                      exposed in client payloads.
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border-subtle bg-surface-elevated">
                    <div className="font-semibold text-text mb-1">
                      Row Level Security (RLS) Isolation
                    </div>
                    <div>
                      Access to connector execution pipelines is bounded by the current active
                      workspace tenant GUC. Cross-workspace token leaking is prohibited at the
                      database engine level.
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border-subtle bg-surface-elevated">
                    <div className="font-semibold text-text mb-1">TLS / In-Transit Protection</div>
                    <div>
                      All outbound requests dispatched by connector workers strictly require TLS 1.3
                      verification with pinned certificate authority stores.
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="health" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text">
                    Connector Health Diagnostics
                  </h3>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={testingHealth}
                    onClick={() => void handleTestHealth()}
                  >
                    {testingHealth ? <Spinner size="sm" /> : 'Run Health Check'}
                  </Button>
                </div>

                {healthStatus ? (
                  <div className="p-4 rounded-lg border border-border-subtle bg-surface-elevated space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text">Diagnostic Report:</span>
                      <Badge
                        variant={healthStatus.status === 'healthy' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {healthStatus.status}
                      </Badge>
                    </div>
                    <pre className="p-3 rounded bg-surface border border-border text-xs font-mono overflow-x-auto">
                      {JSON.stringify(healthStatus, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">
                    No recent health check recorded. Run a check to verify endpoint latency and
                    token validity.
                  </p>
                )}
              </div>
            </TabPanel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
