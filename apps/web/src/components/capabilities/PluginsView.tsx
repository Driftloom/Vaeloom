'use client';

import React, { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Badge, Button, EmptyState, ErrorState, Skeleton, Switch, Tooltip } from '@vaeloom/ui-kit';
import { CapabilityItem, formatRelativeTime } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { pluginApi, type PluginResponse } from '@/lib/api-client';

export interface PluginsViewProps {
  plugins: CapabilityItem[];
  searchQuery?: string;
  onTogglePlugin: (id: string) => void;
  onOpenGitImport: () => void;
}

const SWR_KEY = 'plugin-registry';

/** The only status values `PluginStatus` accepts server-side. */
const ACTIVE_STATUS = 'ACTIVE';
const DISABLED_STATUS = 'DISABLED';

type PendingSet = ReadonlySet<string>;

/**
 * A plugin's declared icon, or a monogram built from its name.
 *
 * The previous renderer returned one hard-coded glyph for every workspace
 * plugin, so a row could not be told apart from any other. A monogram is derived
 * from data the server actually sent rather than from an invented icon set.
 */
function PluginTile({ icon, name }: { icon?: string; name: string }) {
  const usable = icon && !/^https?:\/\//i.test(icon) && icon.length <= 4 ? icon : null;
  return (
    <span
      className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-xs font-mono text-sm font-semibold text-text-secondary"
      aria-hidden="true"
    >
      {usable ?? (name.trim().charAt(0).toUpperCase() || '?')}
    </span>
  );
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === ACTIVE_STATUS) return 'success';
  if (status === 'FAILED') return 'error';
  if (status === 'REGISTERED') return 'warning';
  return 'default';
}

function matches(
  haystack: { name: string; description: string; tags: string[] },
  query: string,
): boolean {
  if (!query) return true;
  return (
    haystack.name.toLowerCase().includes(query) ||
    haystack.description.toLowerCase().includes(query) ||
    haystack.tags.some((t) => t.toLowerCase().includes(query))
  );
}

export const PluginsView: React.FC<PluginsViewProps> = ({
  plugins,
  searchQuery = '',
  onTogglePlugin,
  onOpenGitImport,
}) => {
  const { toast } = useToast();

  const {
    data: registry,
    error: registryError,
    isLoading: registryLoading,
    mutate: mutateRegistry,
  } = useSWR(SWR_KEY, () => pluginApi.list({ page_size: 100 }), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [pendingIds, setPendingIds] = useState<PendingSet>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);

  const query = searchQuery.trim().toLowerCase();

  const registeredPlugins = useMemo<PluginResponse[]>(
    () => (registry?.plugins ?? []).filter((p) => matches(p, query)),
    [registry, query],
  );

  const workspacePlugins = useMemo(
    () => plugins.filter((p) => matches(p, query)),
    [plugins, query],
  );

  const setPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * Toggle a registry row through the one status field the server actually
   * stores. `plugin_service.execute` refuses a `DISABLED` row with a 403, so this
   * flag is load-bearing rather than decorative.
   *
   * The two-switch "Desktop UI" / "Agent Runtime" columns are gone: they both
   * called the same handler and both rendered the same boolean, while the
   * `PluginStatus` enum has exactly four members and no lifecycle split. There is
   * no second flag to persist.
   */
  const handleToggleRegistered = useCallback(
    async (plugin: PluginResponse, enabled: boolean) => {
      const previous = plugin.status;
      const next = enabled ? ACTIVE_STATUS : DISABLED_STATUS;
      setToggleError(null);
      setPending(plugin.id, true);
      try {
        await pluginApi.update(plugin.id, { status: next });
        await mutateRegistry();
        toast({
          tone: 'success',
          title: `${plugin.name} ${enabled ? 'enabled' : 'disabled'}`,
          detail: `Server status is now ${next}.`,
        });
      } catch (err) {
        await mutateRegistry();
        const detail = err instanceof Error ? err.message : 'The server write failed.';
        setToggleError(`${plugin.name} was not changed: ${detail}`);
        toast({
          tone: 'error',
          title: `${plugin.name} unchanged`,
          detail: `${detail} The status is still ${previous}.`,
        });
      } finally {
        setPending(plugin.id, false);
      }
    },
    [mutateRegistry, setPending, toast],
  );

  const handleToggleWorkspace = useCallback(
    (plugin: CapabilityItem) => {
      // The page's handler owns this write and reverts its own state on failure;
      // the switch is disabled for the round trip so it cannot be double-fired.
      setToggleError(null);
      setPending(plugin.id, true);
      onTogglePlugin(plugin.id);
      setPending(plugin.id, false);
    },
    [onTogglePlugin, setPending],
  );

  const isEmpty =
    !registryLoading &&
    !registryError &&
    registeredPlugins.length === 0 &&
    workspacePlugins.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text overflow-y-auto overscroll-y-contain pb-16 antialiased">
      <div className="px-5 py-3 border-b border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-xs">
        <p className="text-xs text-text-secondary font-sans leading-relaxed max-w-3xl">
          Plugins registered with <code className="font-mono">GET /api/v1/plugins</code> and the
          plugin rows this workspace has stored as capabilities. The server exposes a single{' '}
          <code className="font-mono">status</code> per plugin, so each row has one switch.
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={onOpenGitImport}>
            Register from Git
          </Button>
          <Tooltip content="Re-fetch the plugin registry from the server">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void mutateRegistry()}
              loading={registryLoading}
            >
              Refresh
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 min-w-0 space-y-6">
        {toggleError && (
          <ErrorState
            title="Plugin change was not applied"
            message={toggleError}
            onRetry={() => setToggleError(null)}
            actionText="Dismiss"
          />
        )}

        {registryError && (
          <ErrorState
            title="Plugin registry unavailable"
            message={`${registryError.message}. The workspace plugin rows below are still shown; the registered-plugin list could not be loaded.`}
            onRetry={() => void mutateRegistry()}
            actionText="Retry registry fetch"
          />
        )}

        {registryLoading && (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {isEmpty && (
          <EmptyState
            title="No plugins"
            description="Nothing is registered with the plugin service and this workspace has no plugin capability rows. Register one from Git, or create a plugin capability to get started."
            action={{ label: 'Register your first plugin', onClick: onOpenGitImport }}
          />
        )}

        {registeredPlugins.length > 0 && (
          <PluginSection
            title="Registered plugins"
            description="Server rows from the plugin service. Status is the server's own field."
          >
            {registeredPlugins.map((plugin) => (
              <PluginRow
                key={plugin.id}
                title={plugin.name}
                description={plugin.description}
                badges={
                  <>
                    <Badge variant={statusVariant(plugin.status)} size="sm">
                      {plugin.status}
                    </Badge>
                    <Badge variant="default" size="sm">
                      v{plugin.version}
                    </Badge>
                    <Badge variant="default" size="sm">
                      {plugin.license}
                    </Badge>
                  </>
                }
                facts={[
                  { label: 'author', value: plugin.author },
                  { label: 'entry point', value: plugin.entry_point },
                  {
                    label: 'tags',
                    value: plugin.tags.length > 0 ? plugin.tags.join(', ') : null,
                  },
                  {
                    label: 'hooks',
                    value: plugin.hooks.length > 0 ? plugin.hooks.join(', ') : null,
                  },
                  {
                    label: 'permissions',
                    value: Object.keys(plugin.permissions ?? {}).join(', ') || null,
                  },
                  { label: 'updated', value: formatRelativeTime(plugin.updated_at) },
                ]}
                icon={plugin.icon}
                switchLabel={`Set ${plugin.name} ${plugin.status === ACTIVE_STATUS ? 'to disabled' : 'to active'}`}
                switchChecked={plugin.status !== DISABLED_STATUS}
                switchDisabled={pendingIds.has(plugin.id)}
                onSwitchChange={(next) => void handleToggleRegistered(plugin, next)}
              />
            ))}
          </PluginSection>
        )}

        {workspacePlugins.length > 0 && (
          <PluginSection
            title="Workspace plugin records"
            description="Capability rows in this workspace. Enabling writes through the capability API, not the plugin service."
          >
            {workspacePlugins.map((plugin) => (
              <PluginRow
                key={plugin.id}
                title={plugin.name}
                description={plugin.description}
                badges={
                  <>
                    <Badge variant={plugin.enabled ? 'success' : 'default'} size="sm">
                      {plugin.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    <Badge variant="default" size="sm">
                      {plugin.source === 'built-in' ? 'bundled' : 'custom'}
                    </Badge>
                    {plugin.version && (
                      <Badge variant="default" size="sm">
                        v{plugin.version}
                      </Badge>
                    )}
                  </>
                }
                facts={[
                  { label: 'scope', value: plugin.requiredScope ?? null },
                  { label: 'trust', value: plugin.trustClass ?? null },
                  { label: 'runs', value: String(plugin.usageCount) },
                  { label: 'last used', value: formatRelativeTime(plugin.lastUsedAt) },
                ]}
                switchLabel={`Set ${plugin.name} ${plugin.enabled ? 'to disabled' : 'to enabled'}`}
                switchChecked={plugin.enabled}
                switchDisabled={pendingIds.has(plugin.id)}
                onSwitchChange={() => handleToggleWorkspace(plugin)}
              />
            ))}
          </PluginSection>
        )}
      </div>
    </div>
  );
};

function PluginSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
      <div className="px-4 sm:px-5 py-3 border-b border-border bg-surface-elevated">
        <h2 className="text-xs font-semibold text-text uppercase tracking-wider font-sans">
          {title}
        </h2>
        <p className="text-2xs text-text-muted font-sans mt-0.5">{description}</p>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function PluginRow({
  title,
  description,
  badges,
  facts,
  icon,
  switchLabel,
  switchChecked,
  switchDisabled,
  onSwitchChange,
}: {
  title: string;
  description: string;
  badges: React.ReactNode;
  facts: { label: string; value: string | null }[];
  icon?: string;
  switchLabel: string;
  switchChecked: boolean;
  switchDisabled: boolean;
  onSwitchChange: (next: boolean) => void;
}) {
  return (
    <li className="px-4 sm:px-5 py-4 hover:bg-surface-hover transition-colors">
      {/* Stacks under 640px instead of forcing a 540px minimum width into a
          horizontal scroller, which left the switch off-screen on a phone. */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <PluginTile icon={icon} name={title} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-text font-sans tracking-tight">{title}</h3>
              {badges}
            </div>
            <p className="text-xs text-text-muted font-sans leading-relaxed mt-1 max-w-2xl">
              {description || 'No description supplied.'}
            </p>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-1.5 min-w-0">
                  <dt className="text-2xs font-mono uppercase text-text-muted shrink-0">
                    {fact.label}
                  </dt>
                  <dd className="text-2xs font-mono text-text-secondary truncate">
                    {fact.value ?? '—'}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start">
          <span className="text-2xs font-sans text-text-muted">Active</span>
          <Switch
            checked={switchChecked}
            disabled={switchDisabled}
            onChange={onSwitchChange}
            label={<span className="sr-only">{switchLabel}</span>}
          />
        </div>
      </div>
    </li>
  );
}
