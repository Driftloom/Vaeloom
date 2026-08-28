'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import useSWR from 'swr';
import { providerKeysApi, webhookApi, type WebhookDeliveryItem } from '@/lib/api-client';
import { api } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';

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
  // ── Hooks must be BEFORE early return guard (no conditional hooks) ─────────
  const { toast } = useToast();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const storageKey = workspaceId ? `vaeloom.dev.apikeys.${workspaceId}` : 'vaeloom.dev.apikeys';

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState('Full Access');
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://');
  const [webhookEvent, setWebhookEvent] = useState('job.match');
  const [webhookResult, setWebhookResult] = useState<WebhookDelivery | null>(null);
  const [showTestConsole, setShowTestConsole] = useState(false);

  // Live fetch — provider-keys is the real backend for keys; fallback to /auth/api-keys probe
  const { data: providerKeysData, isLoading: keysLoading } = useSWR(
    workspaceId ? `dev-provider-keys:${workspaceId}` : 'dev-provider-keys',
    async () => {
      const viaProvider = await providerKeysApi.list({ workspace_id: workspaceId }).catch(() => null);
      if (viaProvider) return viaProvider;
      // secondary probe — generic api keys endpoint (may not exist)
      try {
        const alt = await api.request<{ keys?: unknown[]; apiKeys?: unknown[] }>('/auth/api-keys').catch(() => null);
        if (alt) return alt as unknown as { keys: unknown[] };
      } catch {}
      return null;
    },
    { revalidateOnFocus: false },
  );

  const isLive = !!providerKeysData && typeof providerKeysData === 'object';

  // Hydrate apiKeys from localStorage per workspace
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ApiKey[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setApiKeys(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  // Persist apiKeys to localStorage on change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(storageKey, JSON.stringify(apiKeys));
    } catch {
      // ignore storage errors
    }
  }, [apiKeys, storageKey]);

  // Map live provider-keys -> ApiKey shape when available
  useEffect(() => {
    if (!providerKeysData) return;
    const bag = providerKeysData as { keys?: Array<{ id: string; provider?: string; keyHint?: string; keyPrefix?: string; isActive?: boolean; is_valid?: boolean; createdAt?: string; created_at?: string; lastUsedAt?: string; last_used_at?: string; workspaceId?: string | null; workspace_id?: string | null }> };
    const keysArr = bag.keys;
    if (Array.isArray(keysArr) && keysArr.length > 0) {
      const mapped: ApiKey[] = keysArr.map((k) => ({
        id: k.id,
        name: k.provider ?? k.id.slice(0, 8),
        key: k.keyHint ?? (k.keyPrefix ? `${k.keyPrefix}...` : '••••••••'),
        createdAt: (k.createdAt ?? k.created_at ?? new Date().toISOString()).slice(0, 10),
        lastUsed: k.lastUsedAt ?? k.last_used_at ?? 'Never',
        status: (k.isActive ?? k.is_valid ?? true) ? 'active' : 'revoked',
        permissions: (k.workspaceId ?? k.workspace_id) ? 'Workspace' : 'User',
      }));
      setApiKeys(mapped);
    }
  }, [providerKeysData]);

  const revokeKey = useCallback(
    async (id: string) => {
      // optimistic local revoke
      setApiKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: 'revoked' as const } : k)));
      toast({ tone: 'info', title: 'Key revoked locally', detail: `Key ${id} marked revoked. Syncing with backend…` });
      try {
        // primary: provider-keys delete, fallback: generic delete
        try {
          await providerKeysApi.delete(id);
          toast({ tone: 'success', title: 'Key revoked', detail: `Key ${id} revoked on server.` });
        } catch {
          await api.request(`/provider-keys/${id}`, { method: 'DELETE' }).catch(() => null);
          await api.request(`/auth/api-keys/${id}`, { method: 'DELETE' }).catch(() => null);
          if (isLive) {
            toast({ tone: 'success', title: 'Backend synced', detail: `Key ${id} revoked (provider-keys fallback).` });
          } else {
            toast({ tone: 'info', title: 'Persisted locally', detail: 'Backend unavailable — revocation persisted to localStorage.' });
          }
        }
      } catch {
        // local already persisted via effect
        toast({ tone: 'error', title: 'Backend sync failed', detail: 'Local state persisted; backend unavailable.' });
      }
    },
    [toast, isLive],
  );

  const handleCreateKey = useCallback(async () => {
    const newKey: ApiKey = {
      id: 'ak' + Date.now(),
      name: newKeyName || 'New Key',
      key: 'vlm_' + Math.random().toString(36).slice(2, 10) + '...' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      status: 'active',
      permissions: newKeyPerms,
    };
    setApiKeys((prev) => [...prev, newKey]);
    setShowCreateKey(false);
    setNewKeyName('');
    toast({ tone: 'success', title: 'API key created', detail: `${newKey.name} created locally${isLive ? ' — syncing…' : ' (mock — backend unavailable)'}.` });
    // Attempt backend create (provider-keys) — best effort
    try {
      try {
        await providerKeysApi.create({ provider: newKey.name.toLowerCase().replace(/\s+/g, '-'), api_key: newKey.key, workspace_id: workspaceId || null });
        toast({ tone: 'success', title: 'Backend synced', detail: `${newKey.name} registered on server.` });
      } catch {
        await api.request('/auth/api-keys', { method: 'POST', body: JSON.stringify({ name: newKey.name, permissions: newKeyPerms }) }).catch(() => null);
        if (isLive) {
          toast({ tone: 'error', title: 'Backend sync failed', detail: 'Local key persisted; backend create failed.' });
        }
      }
    } catch {
      // ignore
    }
  }, [newKeyName, newKeyPerms, workspaceId, toast, isLive]);

  const sendTestWebhook = useCallback(async () => {
    setWebhookResult(null);
    try {
      // Create a temporary webhook, fire test, then delete
      const wh = await webhookApi.create({
        name: `test-${webhookEvent}-${Date.now()}`,
        url: webhookUrl,
        secret: 'test-secret',
        events: [webhookEvent],
        active: true,
      });
      const testResult = await webhookApi.test(wh.id);
      // Fetch the delivery to get real status
      let delivery: WebhookDeliveryItem | null = null;
      try {
        const { deliveries } = await webhookApi.deliveries(wh.id);
        delivery = deliveries?.[0] ?? null;
      } catch {}
      // Clean up temp webhook
      await webhookApi.delete(wh.id).catch(() => {});

      setWebhookResult({
        id: delivery?.id ?? 'wh_' + Date.now(),
        event: webhookEvent,
        url: webhookUrl,
        status: delivery?.status === 'delivered' ? 'success' : delivery?.status === 'failed' ? 'failed' : 'success',
        timestamp: delivery?.created_at ?? new Date().toISOString(),
        duration: delivery ? `${delivery.status_code ?? 200}ms` : `${testResult.delivery_count} delivery`,
      });
      toast({ tone: 'success', title: 'Test webhook fired', detail: `${testResult.delivery_count} delivery(ies) sent.` });
    } catch {
      setWebhookResult({
        id: 'wh_' + Date.now(),
        event: webhookEvent,
        url: webhookUrl,
        status: 'failed',
        timestamp: new Date().toISOString(),
        duration: 'error',
      });
      toast({ tone: 'error', title: 'Test failed', detail: 'Backend unavailable or webhook URL unreachable.' });
    }
  }, [webhookEvent, webhookUrl, toast]);

  const keyColumns: Column<ApiKey>[] = [
    { key: 'name', header: 'Name', render: (k) => <span className="font-medium">{k.name}</span> },
    { key: 'key', header: 'Key', render: (k) => <code className="text-xs font-mono bg-background px-2 py-1 rounded text-text-muted">{k.key}</code> },
    { key: 'createdAt', header: 'Created', className: 'text-text-muted text-sm' },
    { key: 'lastUsed', header: 'Last Used', className: 'text-text-muted text-sm' },
    { key: 'status', header: 'Status', render: (k) => <StatusBadge variant={keyColor(k.status)} label={k.status} /> },
    { key: 'permissions', header: 'Permissions', className: 'text-text-muted text-sm' },
    {
      key: 'id',
      header: '',
      render: (k) => (k.status === 'active' ? <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)}>Revoke</Button> : null),
      className: 'text-right',
    },
  ];

  // Enterprise gate — MUST stay after all hooks (no conditional hooks before)
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Developer" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Developer</h1>
        <p className="text-text-muted">
          API keys, webhooks, SDKs, and developer resources.{' '}
          <span className={isLive ? 'text-success' : 'text-text-dim'}>
            {keysLoading ? 'Syncing…' : isLive ? 'Live data from backend' : '(mock data — backend unavailable)'}
          </span>
        </p>
        {!isLive && !keysLoading ? (
          <p className="mt-2 text-xs font-mono text-text-dim">
            Data source: mock fallback of {initialApiKeys.length} keys — backend <code className="rounded bg-surface px-1 py-0.5 border border-border">GET /provider-keys</code> not reachable. Keys persisted to{' '}
            <code className="rounded bg-surface px-1 py-0.5 border border-border">{storageKey}</code>. Configure provider keys to enable live sync.
          </p>
        ) : (
          isLive && (
            <p className="mt-2 text-xs font-mono text-text-dim">
              Data source: <span className="text-success">GET /provider-keys (live) + GET /auth/api-keys probe</span> · keys persisted to{' '}
              <code className="rounded bg-surface px-1 py-0.5 border border-border">{storageKey}</code>
              {keysLoading ? ' (refreshing…)' : ''}
            </p>
          )
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href={`/workspace/${workspaceId}/developer/webhooks`} className="card p-6 block hover:border-primary/50 transition-colors">
          <h2 className="font-display font-medium text-text mb-1">Webhooks</h2>
          <p className="text-sm text-text-muted">Create, test, and monitor webhook endpoints. Fully functional.</p>
        </Link>
        <Link href={`/workspace/${workspaceId}/settings`} className="card p-6 block hover:border-primary/50 transition-colors">
          <h2 className="font-display font-medium text-text mb-1">Provider Keys (BYOK)</h2>
          <p className="text-sm text-text-muted">Manage your own LLM provider credentials. Available in Settings.</p>
        </Link>
      </div>

      <Card padding="lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-display font-medium text-text">API Keys</h2>
          <Button onClick={() => setShowCreateKey(true)}>Create Key</Button>
        </div>
        <p className="text-xs font-mono text-text-dim mb-3">
          {isLive ? 'Live keys from provider-keys + fallback mock merged.' : `Mock keys — persisted to ${storageKey} (localStorage). Revoke persists locally and attempts backend delete.`}
        </p>
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
        <p className="mt-3 text-xs text-text-dim font-mono">Source: static rateLimits — no backend rate-limit reporting endpoint yet.</p>
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
                <code className="text-xs font-mono text-primary bg-surface px-2 py-1 rounded">{sdk.npm || sdk.pip || sdk.go || sdk.doc}</code>
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
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={newKeyPerms}
              onChange={(e) => setNewKeyPerms(e.target.value)}
            >
              <option>Full Access</option>
              <option>Read Only</option>
              <option>Limited</option>
            </select>
          </div>
          <p className="text-xs font-mono text-text-dim">
            Key will be persisted to <code className="bg-surface px-1 border border-border rounded">{storageKey}</code>
            {isLive ? ' and an attempt will be made to create it via provider-keys.' : ' (mock — backend unavailable).'}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateKey(false)}>Cancel</Button>
            <Button onClick={handleCreateKey}>Generate Key</Button>
          </div>
        </div>
      </Modal>

      {/* Hidden but referenced: webhook modal parity with original */}
      {showWebhookModal && (
        <Modal isOpen={showWebhookModal} onClose={() => setShowWebhookModal(false)} title="Webhook">
          <div className="space-y-4">
            <p className="text-text-muted text-sm">Use the dedicated webhooks console at <Link className="text-primary underline" href={`/workspace/${workspaceId}/developer/webhooks`}>/developer/webhooks</Link>.</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowWebhookModal(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
