'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Modal } from '@vaeloom/ui-kit';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/shared/StatusBadge';
import useSWR from 'swr';
import { pluginApi } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  installed: boolean;
  rating: number;
  installs: number;
  price: string;
}

const categories = ['All', 'Analytics', 'Integration', 'Productivity', 'AI', 'Data', 'Security'];

const mockPlugins: Plugin[] = [
  { id: 'p1', name: 'Slack Connector', description: 'Sync messages and files with Slack workspaces. Enable automated notifications and cross-platform collaboration.', category: 'Integration', author: 'Vaeloom', version: '2.1.0', installed: true, rating: 4.8, installs: 1240, price: 'Free' },
  { id: 'p2', name: 'Analytics Dashboard', description: 'Advanced analytics and reporting dashboard with customizable widgets and export capabilities.', category: 'Analytics', author: 'DataFlow', version: '1.3.2', installed: false, rating: 4.5, installs: 890, price: '$19/mo' },
  { id: 'p3', name: 'GPT-4 Vision', description: 'Enable visual recognition and image analysis workflows using GPT-4 Vision capabilities.', category: 'AI', author: 'OpenAI', version: '3.0.0', installed: true, rating: 4.9, installs: 3200, price: 'Usage-based' },
  { id: 'p4', name: 'GitHub Sync', description: 'Bi-directional sync between your workspace and GitHub repositories. Automate commit tracking.', category: 'Integration', author: 'Vaeloom', version: '1.0.5', installed: false, rating: 4.6, installs: 2100, price: 'Free' },
  { id: 'p5', name: 'Calendar Pro', description: 'Advanced calendar integration with smart scheduling, availability detection, and meeting notes.', category: 'Productivity', author: 'Calendly', version: '2.0.1', installed: false, rating: 4.3, installs: 650, price: '$9/mo' },
  { id: 'p6', name: 'Data Pipeline', description: 'ETL pipeline builder for processing and transforming workspace data at scale.', category: 'Data', author: 'DataFlow', version: '1.1.0', installed: false, rating: 4.2, installs: 340, price: '$49/mo' },
  { id: 'p7', name: 'Security Scanner', description: 'Automated security scanning for documents and code snippets in your workspace.', category: 'Security', author: 'SecureAI', version: '1.5.0', installed: false, rating: 4.7, installs: 520, price: '$29/mo' },
  { id: 'p8', name: 'Notion Export', description: 'Export and sync workspace content to Notion databases and pages.', category: 'Productivity', author: 'Notion Labs', version: '1.0.0', installed: false, rating: 4.0, installs: 180, price: 'Free' },
  { id: 'p9', name: 'Sentiment Analysis', description: 'Analyze text sentiment across messages, documents, and agent conversations.', category: 'AI', author: 'HuggingFace', version: '2.3.0', installed: false, rating: 4.4, installs: 780, price: 'Free' },
];

export default function MarketplacePage() {
  // ── Hooks must be BEFORE early return guard (no conditional hooks) ─────────
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? '';
  const storageKey = workspaceId ? `vaeloom.marketplace.installed.${workspaceId}` : 'vaeloom.marketplace.installed';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [view, setView] = useState<'browse' | 'installed'>('browse');
  const [plugins, setPlugins] = useState<Plugin[]>(mockPlugins);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});

  // Live fetch with mock fallback — never throw, return null on backend unavailable
  const { data: liveData, isLoading } = useSWR(
    workspaceId ? `marketplace-plugins:${workspaceId}` : 'marketplace-plugins',
    () => pluginApi.list({ page: 1, page_size: 50 }).catch(() => null),
    { revalidateOnFocus: false },
  );

  const isLive = !!liveData && Array.isArray((liveData as { plugins?: unknown[] }).plugins);

  // Hydrate installed map from localStorage per workspace
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === 'object') {
          setInstalledMap(parsed);
          setPlugins((prev) => prev.map((p) => (parsed[p.id] !== undefined ? { ...p, installed: parsed[p.id]! } : p)));
        }
      }
    } catch {
      // ignore storage errors (SSR / privacy mode)
    }
  }, [storageKey]);

  // Persist installed map to localStorage on change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (Object.keys(installedMap).length > 0) {
        window.localStorage.setItem(storageKey, JSON.stringify(installedMap));
      }
    } catch {
      // ignore storage errors
    }
  }, [installedMap, storageKey]);

  // Map live data -> Plugin shape when available, applying local overrides
  useEffect(() => {
    if (isLive && liveData) {
      const raw = liveData as { plugins: Array<{ id: string; name: string; description?: string; tags?: string[]; author?: string; version?: string; status?: string }> };
      if (Array.isArray(raw.plugins)) {
        const mapped: Plugin[] = raw.plugins.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? '',
          category: p.tags?.[0] ?? 'General',
          author: p.author ?? 'Unknown',
          version: p.version ?? '1.0.0',
          installed: p.status === 'active',
          rating: 0,
          installs: 0,
          price: 'Free',
        }));
        // Apply local installed overrides on top of live server truth — read fresh from storage to avoid stale closure
        let overrides: Record<string, boolean> = installedMap;
        try {
          if (typeof window !== 'undefined') {
            const rawStorage = window.localStorage.getItem(storageKey);
            if (rawStorage) {
              const parsed = JSON.parse(rawStorage) as Record<string, boolean>;
              if (parsed && typeof parsed === 'object') overrides = { ...overrides, ...parsed };
            }
          }
        } catch {
          // ignore
        }
        setPlugins(mapped.map((p) => (overrides[p.id] !== undefined ? { ...p, installed: overrides[p.id]! } : p)));
      }
    }
  }, [liveData, isLive, storageKey, installedMap]);

  // Keep selectedPlugin in sync if its plugin changes
  useEffect(() => {
    if (selectedPlugin) {
      const fresh = plugins.find((p) => p.id === selectedPlugin.id);
      if (fresh && fresh.installed !== selectedPlugin.installed) {
        setSelectedPlugin(fresh);
      }
    }
  }, [plugins, selectedPlugin]);

  const toggleInstall = async (plugin: Plugin) => {
    const nextInstalled = !plugin.installed;
    // optimistic local update
    setPlugins((prev) => prev.map((p) => (p.id === plugin.id ? { ...p, installed: nextInstalled } : p)));
    setInstalledMap((prev) => ({ ...prev, [plugin.id]: nextInstalled }));
    if (selectedPlugin && selectedPlugin.id === plugin.id) {
      setSelectedPlugin({ ...plugin, installed: nextInstalled });
    }
    try {
      if (typeof window !== 'undefined') {
        const cur = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Record<string, boolean>;
        cur[plugin.id] = nextInstalled;
        window.localStorage.setItem(storageKey, JSON.stringify(cur));
      }
    } catch {
      // ignore
    }

    toast({
      tone: nextInstalled ? 'success' : 'info',
      title: nextInstalled ? 'Plugin installed' : 'Plugin uninstalled',
      detail: `${plugin.name} ${nextInstalled ? 'installed' : 'uninstalled'} locally${isLive ? ' — syncing with backend…' : ' (mock — backend unavailable)'}.`,
    });

    // Attempt backend sync — best-effort try/catch
    try {
      if (nextInstalled) {
        try {
          await pluginApi.update(plugin.id, { status: 'active' });
          toast({ tone: 'success', title: 'Backend synced', detail: `${plugin.name} activated on server.` });
        } catch {
          // mock plugins (p1..p9) may not exist server-side → try register
          try {
            await pluginApi.register({
              name: plugin.name,
              version: plugin.version,
              author: plugin.author,
              description: plugin.description,
              license: 'MIT',
              min_app_version: '1.0.0',
              tags: [plugin.category],
              permissions: {},
              entry_point: `marketplace:${plugin.id}`,
            });
            toast({ tone: 'success', title: 'Plugin registered', detail: `${plugin.name} registered on backend.` });
          } catch {
            if (isLive) {
              toast({ tone: 'error', title: 'Backend sync failed', detail: 'Local state persisted; backend could not register plugin.' });
            }
          }
        }
      } else {
        try {
          await pluginApi.update(plugin.id, { status: 'inactive' });
          toast({ tone: 'success', title: 'Backend synced', detail: `${plugin.name} deactivated on server.` });
        } catch {
          try {
            await pluginApi.delete(plugin.id);
            toast({ tone: 'success', title: 'Plugin removed', detail: `${plugin.name} removed from backend.` });
          } catch {
            if (isLive) {
              toast({ tone: 'error', title: 'Backend sync failed', detail: 'Local state persisted; backend could not deactivate plugin.' });
            }
          }
        }
      }
    } catch {
      // final fallback — local already persisted
    }
  };

  const filtered = useMemo(
    () =>
      plugins.filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === 'All' || p.category === category;
        const matchesView = view === 'installed' ? p.installed : true;
        return matchesSearch && matchesCategory && matchesView;
      }),
    [plugins, search, category, view],
  );

  const installedPlugins = useMemo(() => plugins.filter((p) => p.installed), [plugins]);

  // Enterprise gate — MUST stay after all hooks (no conditional hooks before)
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Marketplace" />;

  if (isLoading && !isLive && plugins.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-muted">Loading marketplace…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Marketplace</h1>
          <p className="text-text-muted">
            Discover plugins and integrations to extend your workspace.{' '}
            <span className={isLive ? 'text-success' : 'text-text-dim'}>
              {isLive ? 'Live data from backend' : '(mock data — backend unavailable)'}
            </span>
          </p>
          {!isLive ? (
            <p className="mt-2 text-xs font-mono text-text-dim">
              Data source: mock fallback of {mockPlugins.length} plugins — backend <code className="rounded bg-surface px-1 py-0.5 border border-border">GET /plugins</code> not reachable. Installed state persisted to{' '}
              <code className="rounded bg-surface px-1 py-0.5 border border-border">{storageKey}</code>.
            </p>
          ) : (
            <p className="mt-2 text-xs font-mono text-text-dim">
              Data source: <span className="text-success">GET /plugins (live) — {(liveData as { total?: number })?.total ?? plugins.length} total</span> · installed overrides persisted to{' '}
              <code className="rounded bg-surface px-1 py-0.5 border border-border">{storageKey}</code>
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant={view === 'browse' ? 'primary' : 'secondary'} onClick={() => setView('browse')}>
            Browse
          </Button>
          <Button variant={view === 'installed' ? 'primary' : 'secondary'} onClick={() => setView('installed')}>
            Installed ({installedPlugins.length})
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search plugins..." className="flex-1" />
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                category === cat
                  ? 'bg-primary text-background border-primary'
                  : 'bg-surface-hover text-text-muted border-border hover:border-primary/50'
              }`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-text-muted">
            No plugins match your filters.
          </div>
        ) : (
          filtered.map((plugin) => (
            <Card key={plugin.id} padding="lg" hover>
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-active flex items-center justify-center text-lg shrink-0">
                    {plugin.name[0]}
                  </div>
                  <StatusBadge variant={plugin.installed ? 'success' : 'neutral'} label={plugin.installed ? 'Installed' : 'Available'} />
                </div>
                <h3 className="font-medium text-text mb-1">{plugin.name}</h3>
                <p className="text-sm text-text-muted mb-3 flex-1 line-clamp-2">{plugin.description}</p>
                <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
                  <span>{plugin.author}</span>
                  <span>v{plugin.version}</span>
                  {plugin.rating > 0 && <span>⭐ {plugin.rating}</span>}
                  {plugin.installs > 0 && <span>{plugin.installs.toLocaleString()} installs</span>}
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSelectedPlugin(plugin)}>
                    Details
                  </Button>
                  <Button
                    variant={plugin.installed ? 'ghost' : 'primary'}
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleInstall(plugin)}
                    title={isLive ? 'Toggle install (persists locally + backend)' : 'Toggle install (mock — persists locally)'}
                  >
                    {plugin.installed ? 'Uninstall' : 'Install'}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal isOpen={!!selectedPlugin} onClose={() => setSelectedPlugin(null)} title={selectedPlugin?.name || ''} size="lg">
        {selectedPlugin && (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm text-text-muted">
              <span>By {selectedPlugin.author}</span>
              <span>v{selectedPlugin.version}</span>
              {selectedPlugin.rating > 0 && <span>⭐ {selectedPlugin.rating}</span>}
            </div>
            <p className="text-text">{selectedPlugin.description}</p>
            <div className="flex items-center gap-2">
              <StatusBadge variant={selectedPlugin.installed ? 'success' : 'neutral'} label={selectedPlugin.installed ? 'Installed' : 'Not Installed'} />
              <StatusBadge variant="info" label={selectedPlugin.category} />
              <StatusBadge variant="neutral" label={selectedPlugin.price} />
            </div>
            <p className="text-xs font-mono text-text-dim">
              Install state persisted to <code className="bg-surface px-1 border border-border rounded">{storageKey}</code>
              {isLive ? ' · backend sync attempted' : ' · mock mode (backend unavailable)'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedPlugin(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => selectedPlugin && toggleInstall(selectedPlugin)}>
                {selectedPlugin.installed ? 'Uninstall' : 'Install'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
