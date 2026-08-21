'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect } from 'react';
import { Button, Card, Modal } from '@vaeloom/ui-kit';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { pluginApi, ApiClientError } from '@/lib/api-client';

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

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [view, setView] = useState<'browse' | 'installed'>('browse');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlugins = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await pluginApi.list({ page: 1, page_size: 100 });
        const mapped: Plugin[] = response.plugins.map((p) => ({
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
        setPlugins(mapped);
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
          setError('This feature requires an Enterprise license. Contact sales@vaeloom.app.');
        } else {
          setError('Failed to load plugins. Please try again later.');
        }
        console.error('Plugin fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPlugins();
  }, []);

  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Marketplace" />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-muted">Loading marketplace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-mono uppercase tracking-widest text-text-dim mb-4">
          Enterprise — Gated
        </div>
        <h1 className="text-2xl font-display font-medium text-text mb-2">Marketplace</h1>
        <p className="text-text-muted max-w-lg">{error}</p>
        <div className="mt-6 flex gap-3">
          <a href="mailto:sales@vaeloom.app" className="btn-secondary">
            Contact sales
          </a>
        </div>
      </div>
    );
  }

  const filtered = plugins.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || p.category === category;
    const matchesView = view === 'installed' ? p.installed : true;
    return matchesSearch && matchesCategory && matchesView;
  });

  const installedPlugins = plugins.filter((p) => p.installed);

  const toggleInstall = (id: string) => {
    setPlugins(plugins.map((p) => (p.id === id ? { ...p, installed: !p.installed } : p)));
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Marketplace</h1>
          <p className="text-text-muted">
            Discover plugins and integrations to extend your workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'browse' ? 'primary' : 'secondary'}
            onClick={() => setView('browse')}
          >
            Browse
          </Button>
          <Button
            variant={view === 'installed' ? 'primary' : 'secondary'}
            onClick={() => setView('installed')}
          >
            Installed ({installedPlugins.length})
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search plugins..."
          className="flex-1"
        />
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
        {filtered.map((plugin) => (
          <Card key={plugin.id} padding="lg" hover>
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-surface-active flex items-center justify-center text-lg shrink-0">
                  {plugin.name[0]}
                </div>
                <StatusBadge
                  variant={plugin.installed ? 'success' : 'neutral'}
                  label={plugin.installed ? 'Installed' : plugin.price}
                />
              </div>
              <h3 className="font-medium text-text mb-1">{plugin.name}</h3>
              <p className="text-sm text-text-muted mb-3 flex-1 line-clamp-2">
                {plugin.description}
              </p>
              <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
                <span>{plugin.author}</span>
                <span>v{plugin.version}</span>
                <span>⭐ {plugin.rating}</span>
                <span>{plugin.installs.toLocaleString()} installs</span>
              </div>
              <div className="flex gap-2 mt-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedPlugin(plugin)}
                >
                  Details
                </Button>
                <Button
                  variant={plugin.installed ? 'ghost' : 'primary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => toggleInstall(plugin.id)}
                >
                  {plugin.installed ? 'Uninstall' : 'Install'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={!!selectedPlugin}
        onClose={() => setSelectedPlugin(null)}
        title={selectedPlugin?.name || ''}
        size="lg"
      >
        {selectedPlugin && (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm text-text-muted">
              <span>By {selectedPlugin.author}</span>
              <span>v{selectedPlugin.version}</span>
              <span>⭐ {selectedPlugin.rating}</span>
            </div>
            <p className="text-text">{selectedPlugin.description}</p>
            <div className="flex items-center gap-2">
              <StatusBadge
                variant={selectedPlugin.installed ? 'success' : 'neutral'}
                label={selectedPlugin.installed ? 'Installed' : 'Not Installed'}
              />
              <StatusBadge variant="info" label={selectedPlugin.category} />
              <StatusBadge variant="neutral" label={selectedPlugin.price} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedPlugin(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  toggleInstall(selectedPlugin.id);
                  setSelectedPlugin(null);
                }}
              >
                {selectedPlugin.installed ? 'Uninstall' : 'Install'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
