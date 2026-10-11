'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Badge,
  Breadcrumb,
  Button,
  ConfirmationDialog,
  EmptyState,
  FormField,
  Spinner,
  StatusDot,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import { pluginApi, type PluginResponse } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { CapabilitySubpageSkeleton } from '@/components/capabilities/CapabilitySubpageSkeleton';

// No `BUILTIN_PLUGINS` fallback.
//
// It declared four plugins with ids (`plug-*`) the registry never issued,
// invented `.py` entrypoints, and a hardcoded `status: 'ACTIVE'`. When the
// registry had no match the page fell back to it and rendered an operator-facing
// detail view for a plugin that was not registered -- with a healthy-looking
// status badge. The registry is authoritative; a plugin it does not know about
// is "not found", which is what the empty state already says.

type SubTab = 'overview' | 'runtime' | 'activity' | 'test';

export default function PluginSubpage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const pluginId = (params?.['pluginId'] as string) || '';
  const decodedPluginId = decodeURIComponent(pluginId);

  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [inputText, setInputText] = useState('Analyze this sample document payload.');
  const [runningTest, setRunningTest] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    data: registry,
    isLoading: loadingRegistry,
    mutate: mutateRegistry,
  } = useSWR('plugin-registry', () => pluginApi.list({ page_size: 100 }), {
    revalidateOnFocus: false,
  });

  const plugin = useMemo(() => {
    if (!decodedPluginId) return null;
    const clean = decodedPluginId.toLowerCase();
    const cleanNoPrefix = clean.startsWith('plug-') ? clean.slice('plug-'.length) : clean;

    const remote = registry?.plugins?.find(
      (p) =>
        p.id.toLowerCase() === clean ||
        p.name.toLowerCase() === clean ||
        p.name.toLowerCase() === cleanNoPrefix,
    );
    if (remote) return remote;
    return null;
  }, [decodedPluginId, registry]);

  // `GET /plugins/{id}/executions` and `GET /plugins/{id}/permissions` both
  // existed on the backend with `pluginApi` wrappers that had zero callers.
  // An operator deciding whether to grant a plugin an `on_tool_call` hook needs
  // the real run history and the real declared permissions, not a claim.
  const {
    data: executionPage,
    error: executionsError,
    isLoading: executionsLoading,
  } = useSWR(
    plugin ? ['plugin-executions', plugin.id] : null,
    () => pluginApi.executions(plugin!.id, { page: 1, page_size: 25 }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const { data: permissionPayload } = useSWR(
    plugin ? ['plugin-permissions', plugin.id] : null,
    () => pluginApi.getPermissions(plugin!.id),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const isActive = plugin?.status === 'ACTIVE';

  const handleToggleStatus = useCallback(
    async (nextActive: boolean) => {
      if (!plugin) return;
      const nextStatus = nextActive ? 'ACTIVE' : 'DISABLED';
      try {
        await pluginApi.update(plugin.id, { status: nextStatus });
        void mutateRegistry();
        toast({
          tone: nextActive ? 'success' : 'warning',
          title: `${nextActive ? 'Enabled' : 'Disabled'} ${plugin.name}`,
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not update status for ${plugin.name}`,
          detail: err instanceof Error ? err.message : 'Server error.',
        });
      }
    },
    [plugin, mutateRegistry, toast],
  );

  const handleDelete = useCallback(async () => {
    if (!plugin) return;
    try {
      await pluginApi.delete(plugin.id);
      void mutateRegistry();
      toast({ tone: 'info', title: `Plugin ${plugin.name} deleted` });
      router.push(`/workspace/${workspaceId}/capabilities?category=plugins`);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Write failed.',
      });
    }
  }, [plugin, mutateRegistry, router, toast, workspaceId]);

  const handleRunProbe = useCallback(async () => {
    if (!plugin) return;
    setRunningTest(true);
    setTestOutput(null);
    try {
      // The real endpoint. This used to `setTimeout(600)` and render an
      // invented `status: 'EXECUTED'` result with fabricated `tags`, then toast
      // success — for code that never ran. `pluginApi.execute` has existed at
      // `lib/api-client.ts` with zero callers until now.
      const result = await pluginApi.execute(plugin.id, { input: { text: inputText } });

      setTestOutput(JSON.stringify(result, null, 2));

      // Only claim success when the server said so. A non-success status is
      // reported as-is; `error_message` is the server's, not ours.
      if (result.status === 'success') {
        toast({ tone: 'success', title: `Executed ${plugin.name} successfully` });
      } else {
        toast({
          tone: 'error',
          title: `${plugin.name} returned "${result.status}"`,
          detail: result.error_message ?? 'The server ran the plugin and did not report success.',
        });
      }
    } catch (err) {
      setTestOutput(null);
      toast({
        tone: 'error',
        title: `Could not run ${plugin.name}`,
        detail:
          err instanceof Error
            ? err.message
            : 'The plugin was not executed and no result was recorded.',
      });
    } finally {
      setRunningTest(false);
    }
  }, [plugin, inputText, toast]);

  const breadcrumbsBackUrl = `/workspace/${workspaceId}/capabilities?category=plugins`;

  const breadcrumbItems = [
    { label: 'Capabilities', href: `/workspace/${workspaceId}/capabilities` },
    { label: 'Plugins', href: breadcrumbsBackUrl },
    { label: plugin?.name ?? decodedPluginId, current: true },
  ];

  const subTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'runtime', label: 'Runtime & Sandboxing' },
    { id: 'activity', label: 'Activity' },
    { id: 'test', label: 'Execution Probe' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background text-text antialiased overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4 border-b border-border bg-surface">
        <PageHeader
          title={plugin?.name ?? decodedPluginId}
          description={
            plugin?.description ||
            'Inspect entrypoints, execution status, and sandboxing rules for this plugin.'
          }
          eyebrow="Workspace Plugin"
          breadcrumb={<Breadcrumb items={breadcrumbItems} />}
          actions={
            <div className="flex items-center gap-3">
              <Link
                href={breadcrumbsBackUrl}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg"
              >
                <Button variant="secondary" size="sm">
                  Back to Plugins
                </Button>
              </Link>
              {plugin && (
                <div className="flex items-center gap-2 pl-2 border-l border-border-subtle">
                  <span className="text-xs text-text-muted">Enabled:</span>
                  <Switch
                    checked={isActive}
                    onChange={(next) => void handleToggleStatus(next)}
                    label={`Enable ${plugin.name}`}
                  />
                </div>
              )}
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
        {loadingRegistry && !plugin ? (
          <CapabilitySubpageSkeleton eyebrow="Workspace Plugin" />
        ) : !plugin ? (
          <div className="max-w-xl mx-auto py-12">
            <EmptyState
              title={`Plugin "${decodedPluginId}" not found`}
              description="This plugin does not exist in this workspace."
              action={{
                label: 'View all Plugins',
                onClick: () => router.push(breadcrumbsBackUrl),
              }}
            />
          </div>
        ) : plugin ? (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Metadata Card */}
            <div className="p-4 rounded-xl border border-border-subtle bg-surface flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <StatusDot status={isActive ? 'active' : 'idle'} />
                <div>
                  <div className="text-sm font-semibold font-mono text-text">{plugin.name}</div>
                  <div className="text-xs text-text-muted">
                    {(plugin as any).entrypoint ?? `${plugin.name}.py`}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm">
                  v{plugin.version}
                </Badge>
                <Badge variant={isActive ? 'success' : 'default'} size="sm">
                  {plugin.status}
                </Badge>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  Delete Plugin
                </Button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-border-subtle">
              <Tabs
                ariaLabel="Plugin Inspection Subtabs"
                size="sm"
                tabs={subTabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as SubTab)}
              />
            </div>

            <TabPanel id="overview" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">Plugin Description</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{plugin.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-subtle text-xs">
                  <div>
                    <span className="text-text-muted">Author:</span>
                    <span className="ml-2 font-medium text-text">{plugin.author}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Entrypoint:</span>
                    {plugin.entry_point ? (
                      <span className="ml-2 font-mono text-text">{plugin.entry_point}</span>
                    ) : (
                      // The registry declares `entry_point`. Guessing
                      // `${name}.py` printed a path that may not exist, which is
                      // exactly what an operator reads to decide whether to grant
                      // this plugin a hook.
                      <span className="ml-2 text-text-muted">not reported by the registry</span>
                    )}
                  </div>
                  <div>
                    <span className="text-text-muted">Status:</span>
                    <span className="ml-2 font-medium text-text">{plugin.status}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Tags:</span>
                    <span className="ml-2 text-text">
                      {(plugin.tags ?? []).join(', ') || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="runtime" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">
                  Runtime Environment & Sandboxing
                </h3>
                <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                  <div className="p-3 rounded-lg border border-border-subtle bg-surface-elevated">
                    <div className="font-semibold text-text mb-1">Process Isolation</div>
                    <div>
                      Plugins run inside isolated sub-processes with restricted environment
                      variables and memory limits. Filesystem access is locked to the workspace
                      vault.
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border-subtle bg-surface-elevated">
                    <div className="font-semibold text-text mb-1">Entrypoint Binding</div>
                    <div className="font-mono text-[11px] text-text-muted mt-1">
                      Path: plugins/{plugin.name}/
                      {(plugin as any).entrypoint ?? `${plugin.name}.py`}
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="activity" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">Recorded Executions</h3>

                <div>
                  <span className="text-xs text-text-muted">Declared permissions:</span>
                  {permissionPayload?.permissions &&
                  Object.keys(permissionPayload.permissions).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(permissionPayload.permissions).map(([scope, value]) => (
                        <Badge key={scope} variant="mono" size="sm">
                          {String(value) === 'true' || value === true
                            ? scope
                            : `${scope}=${String(value)}`}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-text-muted">
                      The registry declares no permissions for this plugin.
                    </p>
                  )}
                </div>

                {executionsLoading ? (
                  <p role="status" className="text-xs text-text-muted">
                    Loading execution history…
                  </p>
                ) : executionsError ? (
                  <p role="alert" className="text-xs text-error">
                    Execution history is unavailable: {executionsError.message}
                  </p>
                ) : executionPage && executionPage.executions.length > 0 ? (
                  <>
                    <p className="text-xs text-text-muted">
                      {executionPage.total} recorded run{executionPage.total === 1 ? '' : 's'},
                      newest first.
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border-subtle text-left">
                          <th scope="col" className="py-1.5 pr-3 font-medium text-text-muted">
                            When
                          </th>
                          <th scope="col" className="py-1.5 pr-3 font-medium text-text-muted">
                            Status
                          </th>
                          <th scope="col" className="py-1.5 font-medium text-text-muted">
                            Duration
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {executionPage.executions.map((execution) => (
                          <tr key={execution.id} className="border-b border-border-subtle/60">
                            <td className="py-1.5 pr-3 font-mono text-text-secondary">
                              {execution.created_at}
                            </td>
                            <td className="py-1.5 pr-3">
                              <Badge
                                variant={execution.status === 'success' ? 'success' : 'warning'}
                                size="sm"
                              >
                                {execution.status}
                              </Badge>
                            </td>
                            <td className="py-1.5 font-mono text-text-secondary">
                              {execution.duration_ms == null
                                ? 'not reported'
                                : `${execution.duration_ms}ms`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p className="text-xs text-text-muted">
                    No executions have been recorded for this plugin. Nothing has run it.
                  </p>
                )}
              </div>
            </TabPanel>

            <TabPanel id="test" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">Test Plugin Execution</h3>
                <p className="text-xs text-text-muted">
                  Dispatch a sample payload to verify the plugin entrypoint response.
                </p>

                <FormField label="Sample Input Text">
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    rows={4}
                  />
                </FormField>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={runningTest}
                  onClick={() => void handleRunProbe()}
                >
                  {runningTest ? <Spinner size="sm" /> : 'Run Plugin Probe'}
                </Button>

                {testOutput && (
                  <div className="p-4 rounded-lg border border-border-subtle bg-surface-elevated space-y-2 text-xs">
                    <span className="font-semibold text-text">Execution Output:</span>
                    <pre className="p-3 rounded bg-surface border border-border text-xs font-mono overflow-x-auto">
                      {testOutput}
                    </pre>
                  </div>
                )}
              </div>
            </TabPanel>
          </div>
        ) : null}
      </div>

      {/* Every other destructive action in this feature confirms first
          (SkillsView, McpServerCard, ConnectorModals). This was the only
          one-click irreversible delete, with no undo. */}
      <ConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void handleDelete();
        }}
        title="Delete this plugin?"
        description={
          plugin
            ? `${plugin.name} will be removed from this workspace and will stop being available to any hook that referenced it. This cannot be undone.`
            : 'This plugin will be removed from this workspace.'
        }
        confirmLabel="Delete plugin"
        cancelLabel="Keep plugin"
        variant="destructive"
      />
    </div>
  );
}
