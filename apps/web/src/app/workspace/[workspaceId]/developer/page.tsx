'use client';
import React, { useState } from 'react';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'revoked';
  permissions: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  duration: string;
}

const initialApiKeys: ApiKey[] = [
  { id: 'ak1', name: 'Production', key: 'vlm_prod_8a7d...3f2b', createdAt: '2026-06-01', lastUsed: '2 min ago', status: 'active', permissions: 'Full Access' },
  { id: 'ak2', name: 'Development', key: 'vlm_dev_c4e1...9a8d', createdAt: '2026-07-10', lastUsed: '1 hour ago', status: 'active', permissions: 'Read Only' },
  { id: 'ak3', name: 'CI/CD Pipeline', key: 'vlm_ci_5b2f...1e4c', createdAt: '2026-05-15', lastUsed: '3 days ago', status: 'revoked', permissions: 'Limited' },
];

const rateLimits = [
  { name: 'REST API', limit: '1,000 / hour', current: 342, color: 'success' as StatusVariant },
  { name: 'GraphQL API', limit: '500 / hour', current: 89, color: 'success' as StatusVariant },
  { name: 'Streaming API', limit: '100 / min', current: 23, color: 'success' as StatusVariant },
  { name: 'Webhook Delivery', limit: '500 / hour', current: 12, color: 'success' as StatusVariant },
];

const sdkItems = [
  { name: 'TypeScript SDK', version: '2.4.1', npm: 'npm install @vaeloom/sdk' },
  { name: 'Python SDK', version: '1.8.0', pip: 'pip install vaeloom-sdk' },
  { name: 'Go SDK', version: '0.9.2', go: 'go get github.com/vaeloom/go-sdk' },
  { name: 'REST API', version: 'v2', doc: '/api/v2/docs' },
];

const apiDocLinks = [
  { name: 'Authentication', url: '#' },
  { name: 'Agents API', url: '#' },
  { name: 'Memories API', url: '#' },
  { name: 'Files API', url: '#' },
  { name: 'Webhook API', url: '#' },
  { name: 'Rate Limits', url: '#' },
];

const keyStatusColors: Record<string, StatusVariant> = { active: 'success', revoked: 'error' };

const keyColor = (s: string): StatusVariant => keyStatusColors[s] ?? 'neutral';

export default function DeveloperPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://');
  const [webhookEvent, setWebhookEvent] = useState('job.match');
  const [webhookResult, setWebhookResult] = useState<WebhookDelivery | null>(null);
  const [showTestConsole, setShowTestConsole] = useState(false);

  const revokeKey = (id: string) => {
    setApiKeys(apiKeys.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k));
  };

  const sendTestWebhook = () => {
    setWebhookResult({
      id: 'wh_' + Date.now(),
      event: webhookEvent,
      url: webhookUrl,
      status: 'success',
      timestamp: new Date().toISOString(),
      duration: '132ms',
    });
  };

  const keyColumns: Column<ApiKey>[] = [
    { key: 'name', header: 'Name', render: (k) => <span className="font-medium">{k.name}</span> },
    { key: 'key', header: 'Key', render: (k) => <code className="text-xs font-mono bg-background px-2 py-1 rounded text-text-muted">{k.key}</code> },
    { key: 'createdAt', header: 'Created', className: 'text-text-muted text-sm' },
    { key: 'lastUsed', header: 'Last Used', className: 'text-text-muted text-sm' },
    { key: 'status', header: 'Status', render: (k) => <StatusBadge variant={keyColor(k.status)} label={k.status} /> },
    { key: 'permissions', header: 'Permissions', className: 'text-text-muted text-sm' },
    { key: 'id', header: '', render: (k) => k.status === 'active' ? <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)}>Revoke</Button> : null, className: 'text-right' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Developer</h1>
        <p className="text-text-muted">API keys, webhooks, SDKs, and developer resources.</p>
      </header>

      <Card padding="lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-display font-medium text-text">API Keys</h2>
          <Button onClick={() => setShowCreateKey(true)}>Create Key</Button>
        </div>
        {apiKeys.length === 0 ? (
          <EmptyState title="No API keys" description="Create an API key to start building with Vaeloom." />
        ) : (
          <Table columns={keyColumns} data={apiKeys} keyExtractor={(k) => k.id} />
        )}
      </Card>

      <Card padding="lg">
        <h2 className="text-lg font-display font-medium text-text mb-4">Rate Limit Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {rateLimits.map((rl) => (
            <div key={rl.name} className="bg-background rounded-lg p-4 border border-border">
              <p className="text-sm text-text-muted">{rl.name}</p>
              <p className="text-2xl font-display text-text mt-1">{rl.current}</p>
              <p className="text-xs text-text-muted font-mono mt-1">Limit: {rl.limit}</p>
              <div className="mt-2 h-1.5 bg-surface-active rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min((rl.current / parseInt(rl.limit.replace(/,/g, '').split(' ')[0] ?? '1')) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-display font-medium text-text">Webhook Test Console</h2>
          <Button variant="secondary" onClick={() => setShowTestConsole(!showTestConsole)}>
            {showTestConsole ? 'Hide Console' : 'Open Console'}
          </Button>
        </div>
        {showTestConsole && (
          <div className="space-y-4 p-4 bg-background rounded-lg border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Webhook URL" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text">Event Type</label>
                <select
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                >
                  <option value="job.match">job.match</option>
                  <option value="application.submitted">application.submitted</option>
                  <option value="agent.task.completed">agent.task.completed</option>
                  <option value="memory.created">memory.created</option>
                  <option value="workspace.updated">workspace.updated</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={sendTestWebhook}>Send Test Event</Button>
              <Button variant="secondary" onClick={() => setWebhookResult(null)}>Clear</Button>
            </div>
            {webhookResult && (
              <div className="p-4 bg-surface rounded-lg border border-border">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-text-muted">Status</span>
                  <StatusBadge variant={webhookResult.status === 'success' ? 'success' : 'error'} label={webhookResult.status} />
                  <span className="text-text-muted">Event</span>
                  <span className="font-mono text-text">{webhookResult.event}</span>
                  <span className="text-text-muted">Duration</span>
                  <span className="font-mono text-text">{webhookResult.duration}</span>
                  <span className="text-text-muted">Timestamp</span>
                  <span className="text-text-muted text-xs">{webhookResult.timestamp}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">SDK Downloads</h2>
          <div className="space-y-4">
            {sdkItems.map((sdk) => (
              <div key={sdk.name} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                <div>
                  <p className="font-medium text-text">{sdk.name}</p>
                  <p className="text-xs text-text-muted font-mono">v{sdk.version}</p>
                </div>
                <code className="text-xs font-mono text-primary bg-surface px-2 py-1 rounded">
                  {sdk.npm || sdk.pip || sdk.go || sdk.doc}
                </code>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">API Documentation</h2>
          <div className="grid grid-cols-2 gap-2">
            {apiDocLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                className="flex items-center gap-2 p-3 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors text-text hover:text-primary"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium">{link.name}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>

      <Modal isOpen={showCreateKey} onClose={() => setShowCreateKey(false)} title="Create API Key">
        <div className="space-y-4">
          <Input label="Key Name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production CI" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Permissions</label>
            <select className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary">
              <option>Full Access</option>
              <option>Read Only</option>
              <option>Limited</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateKey(false)}>Cancel</Button>
            <Button onClick={() => {
              setApiKeys([...apiKeys, { id: 'ak' + Date.now(), name: newKeyName || 'New Key', key: 'vlm_' + Math.random().toString(36).slice(2, 10) + '...' + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString().slice(0, 10), lastUsed: 'Never', status: 'active', permissions: 'Full Access' }]);
              setShowCreateKey(false);
              setNewKeyName('');
            }}>
              Generate Key
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
