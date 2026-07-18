'use client';
import React, { useState } from 'react';
import { Button, Card, Modal } from '@vaeloom/ui-kit';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/shared/StatusBadge';

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

const allPlugins: Plugin[] = [
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
  const [plugins, setPlugins] = useState<Plugin[]>(allPlugins);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [view, setView] = useState<'browse' | 'installed'>('browse');

  const filtered = plugins.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || p.category === category;
    const matchesView = view === 'installed' ? p.installed : true;
    return matchesSearch && matchesCategory && matchesView;
  });

  const installedPlugins = plugins.filter((p) => p.installed);

  const toggleInstall = (id: string) => {
    setPlugins(plugins.map((p) => p.id === id ? { ...p, installed: !p.installed } : p));
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Marketplace</h1>
          <p className="text-text-muted">Discover plugins and integrations to extend your workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'browse' ? 'primary' : 'secondary'} onClick={() => setView('browse')}>Browse</Button>
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
                category === cat ? 'bg-primary text-background border-primary' : 'bg-surface-hover text-text-muted border-border hover:border-primary/50'
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
                <StatusBadge variant={plugin.installed ? 'success' : 'neutral'} label={plugin.installed ? 'Installed' : plugin.price} />
              </div>
              <h3 className="font-medium text-text mb-1">{plugin.name}</h3>
              <p className="text-sm text-text-muted mb-3 flex-1 line-clamp-2">{plugin.description}</p>
              <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
                <span>{plugin.author}</span>
                <span>v{plugin.version}</span>
                <span>⭐ {plugin.rating}</span>
                <span>{plugin.installs.toLocaleString()} installs</span>
              </div>
              <div className="flex gap-2 mt-auto">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSelectedPlugin(plugin)}>
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

      <Modal isOpen={!!selectedPlugin} onClose={() => setSelectedPlugin(null)} title={selectedPlugin?.name || ''} size="lg">
        {selectedPlugin && (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm text-text-muted">
              <span>By {selectedPlugin.author}</span>
              <span>v{selectedPlugin.version}</span>
              <span>⭐ {selectedPlugin.rating}</span>
            </div>
            <p className="text-text">{selectedPlugin.description}</p>
            <div className="flex items-center gap-2">
              <StatusBadge variant={selectedPlugin.installed ? 'success' : 'neutral'} label={selectedPlugin.installed ? 'Installed' : 'Not Installed'} />
              <StatusBadge variant="info" label={selectedPlugin.category} />
              <StatusBadge variant="neutral" label={selectedPlugin.price} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedPlugin(null)}>Close</Button>
              <Button onClick={() => { toggleInstall(selectedPlugin.id); setSelectedPlugin(null); }}>
                {selectedPlugin.installed ? 'Uninstall' : 'Install'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
