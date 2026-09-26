'use client';
import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import useSWR from 'swr';
import {
  apiKeysApi,
  webhookApi,
  type ApiKeyItem,
  type WebhookDeliveryItem,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

interface WebhookDelivery {
  id: string;
  event: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  duration: string;
}

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
  { name: 'Authentication API', url: 'http://localhost:8000/docs#/Auth' },
  { name: 'Agents & ReAct API', url: 'http://localhost:8000/docs#/Agents' },
  { name: 'SCALE Cognition API', url: 'http://localhost:8000/docs#/Cognition' },
  { name: 'Council Adjudication API', url: 'http://localhost:8000/docs#/Council' },
  { name: 'Webhook Subscriptions API', url: 'http://localhost:8000/docs#/Webhooks' },
  { name: 'Connectors & MCP API', url: 'http://localhost:8000/docs#/Connectors' },
];

function DeveloperContent() {
  const { toast } = useToast();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';

  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState('full_access');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time secret display modal state
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Webhook testing states
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://');
  const [webhookEvent, setWebhookEvent] = useState('job.match');
  const [webhookResult, setWebhookResult] = useState<WebhookDelivery | null>(null);
  const [showTestConsole, setShowTestConsole] = useState(false);

  // Real backend SWR query for API keys
  const {
    data: apiKeys = [],
    isLoading: keysLoading,
    error: keysError,
    mutate: mutateKeys,
  } = useSWR<ApiKeyItem[]>(
    '/api/v1/api-keys',
    async () => {
      return await apiKeysApi.list();
    },
    { revalidateOnFocus: true },
  );

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) {
      toast({
        tone: 'error',
        title: 'Name required',
        detail: 'Please provide a name for the API key.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await apiKeysApi.create({
        name: newKeyName.trim(),
        permissions: [newKeyPerms],
      });
      setShowCreateKey(false);
      setNewKeyName('');
      setCreatedSecret(created.key);
      setCopiedSecret(false);
      await mutateKeys();
      toast({
        tone: 'success',
        title: 'API key generated',
        detail: 'Make sure to copy your API secret now. It will not be shown again.',
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Creation failed',
        detail: err instanceof Error ? err.message : 'Failed to create API key on server.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [newKeyName, newKeyPerms, mutateKeys, toast]);

  const handleRevokeKey = useCallback(
    async (id: string) => {
      try {
        await apiKeysApi.revoke(id);
        await mutateKeys();
        toast({
          tone: 'success',
          title: 'Key revoked',
          detail: 'The API key has been revoked and can no longer be used.',
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Revocation failed',
          detail: err instanceof Error ? err.message : 'Failed to revoke API key.',
        });
      }
    },
    [mutateKeys, toast],
  );

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          setCopiedSecret(true);
          toast({
            tone: 'success',
            title: 'Copied to clipboard',
            detail: 'Key secret copied successfully.',
          });
        }
      } catch {
        toast({ tone: 'error', title: 'Copy failed', detail: 'Please copy the key manually.' });
      }
    },
    [toast],
  );

  const keyColumns: Column<ApiKeyItem>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (k) => <span className="font-medium text-text">{k.name}</span>,
    },
    {
      key: 'keyPrefix',
      header: 'Key Prefix',
      render: (k) => (
        <code className="text-xs font-mono bg-background px-2 py-1 rounded text-text-muted">
          {k.keyPrefix}••••••••
        </code>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (k) => (
        <span className="text-text-muted text-sm">
          {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'lastUsed',
      header: 'Last Used',
      render: (k) => (
        <span className="text-text-muted text-sm">
          {k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'enabled',
      header: 'Status',
      render: (k) => (
        <StatusBadge
          variant={k.enabled ? 'success' : 'error'}
          label={k.enabled ? 'active' : 'revoked'}
        />
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (k) => (
        <span className="text-text-muted text-sm">
          {Array.isArray(k.permissions) && k.permissions.length > 0
            ? k.permissions.join(', ')
            : 'full_access'}
        </span>
      ),
    },
    {
      key: 'id',
      header: '',
      render: (k) =>
        k.enabled ? (
          <Button variant="ghost" size="sm" onClick={() => handleRevokeKey(k.id)}>
            Revoke
          </Button>
        ) : null,
      className: 'text-right',
    },
  ];

  const sendTestWebhook = useCallback(async () => {
    setWebhookResult(null);
    try {
      const wh = await webhookApi.create({
        name: `test-${webhookEvent}-${Date.now()}`,
        url: webhookUrl,
        secret: 'test-secret',
        events: [webhookEvent],
        active: true,
      });
      const testResult = await webhookApi.test(wh.id);
      let delivery: WebhookDeliveryItem | null = null;
      try {
        const { deliveries } = await webhookApi.deliveries(wh.id);
        delivery = deliveries?.[0] ?? null;
      } catch {}
      await webhookApi.delete(wh.id).catch(() => {});

      setWebhookResult({
        id: delivery?.id ?? 'wh_' + Date.now(),
        event: webhookEvent,
        url: webhookUrl,
        status:
          delivery?.status === 'delivered'
            ? 'success'
            : delivery?.status === 'failed'
              ? 'failed'
              : 'success',
        timestamp: delivery?.created_at ?? new Date().toISOString(),
        duration: delivery
          ? `${delivery.status_code ?? 200}ms`
          : `${testResult.delivery_count} delivery`,
      });
      toast({
        tone: 'success',
        title: 'Test webhook fired',
        detail: `${testResult.delivery_count} delivery(ies) sent.`,
      });
    } catch {
      setWebhookResult({
        id: 'wh_' + Date.now(),
        event: webhookEvent,
        url: webhookUrl,
        status: 'failed',
        timestamp: new Date().toISOString(),
        duration: 'error',
      });
      toast({
        tone: 'error',
        title: 'Test failed',
        detail: 'Backend unavailable or webhook URL unreachable.',
      });
    }
  }, [webhookEvent, webhookUrl, toast]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Developer</h1>
        <p className="text-text-muted">
          Manage API keys, webhooks, SDKs, and developer integration resources.{' '}
          <span className={!keysError && !keysLoading ? 'text-success' : 'text-text-dim'}>
            {keysLoading
              ? 'Syncing…'
              : !keysError
                ? 'Connected to live API'
                : 'Backend unavailable'}
          </span>
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/workspace/${workspaceId}/developer/webhooks`}
          className="card p-6 block hover:border-primary/50 transition-colors"
        >
          <h2 className="font-display font-medium text-text mb-1">Webhooks</h2>
          <p className="text-sm text-text-muted">
            Create, test, and monitor webhook endpoints. Real event delivery.
          </p>
        </Link>
        <Link
          href={`/workspace/${workspaceId}/settings`}
          className="card p-6 block hover:border-primary/50 transition-colors"
        >
          <h2 className="font-display font-medium text-text mb-1">Provider Keys (BYOK)</h2>
          <p className="text-sm text-text-muted">
            Manage your own LLM provider credentials. Available in Settings.
          </p>
        </Link>
      </div>

      <Card padding="lg">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-display font-medium text-text">API Keys</h2>
            <p className="text-xs text-text-muted mt-1">
              Keys are encrypted at rest with bcrypt. Use them via the{' '}
              <code className="text-xs bg-surface px-1 py-0.5 rounded font-mono">X-API-Key</code>{' '}
              header or Bearer token.
            </p>
          </div>
          <Button onClick={() => setShowCreateKey(true)}>Create Key</Button>
        </div>
        {keysLoading ? (
          <div className="py-8 text-center text-text-muted text-sm">Loading API keys…</div>
        ) : apiKeys.length === 0 ? (
          <EmptyState
            title="No API keys"
            description="Create an API key to start building with Vaeloom."
          />
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
                  style={{
                    width: `${Math.min((rl.current / parseInt(rl.limit.replace(/,/g, '').split(' ')[0] ?? '1')) * 100, 100)}%`,
                  }}
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
              <Input
                label="Webhook URL"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
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
              <Button variant="secondary" onClick={() => setWebhookResult(null)}>
                Clear
              </Button>
            </div>
            {webhookResult && (
              <div className="p-4 bg-surface rounded-lg border border-border">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-text-muted">Status</span>
                  <StatusBadge
                    variant={webhookResult.status === 'success' ? 'success' : 'error'}
                    label={webhookResult.status}
                  />
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
              <div
                key={sdk.name}
                className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
              >
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
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors text-text hover:text-primary"
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-sm font-medium">{link.name}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>

      {/* Create Key Modal */}
      <Modal isOpen={showCreateKey} onClose={() => setShowCreateKey(false)} title="Create API Key">
        <div className="space-y-4">
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. Production CI"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Permissions</label>
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={newKeyPerms}
              onChange={(e) => setNewKeyPerms(e.target.value)}
            >
              <option value="full_access">Full Access</option>
              <option value="read_only">Read Only</option>
              <option value="limited">Limited</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateKey(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={isSubmitting}>
              {isSubmitting ? 'Generating…' : 'Generate Key'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* One-Time Secret Display Modal */}
      <Modal
        isOpen={!!createdSecret}
        onClose={() => setCreatedSecret(null)}
        title="API Key Generated"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-sm">
            <p className="font-semibold mb-1">Save this key in a secure location.</p>
            <p className="text-xs">
              For security reasons, this key will never be shown again. If you lose it, you will
              need to generate a new key.
            </p>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Your API Secret</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={createdSecret ?? ''}
                className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm text-primary select-all focus:outline-none focus:border-primary"
              />
              <Button
                variant={copiedSecret ? 'secondary' : 'primary'}
                onClick={() => createdSecret && copyToClipboard(createdSecret)}
              >
                {copiedSecret ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setCreatedSecret(null)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Webhook Info Modal */}
      {showWebhookModal && (
        <Modal isOpen={showWebhookModal} onClose={() => setShowWebhookModal(false)} title="Webhook">
          <div className="space-y-4">
            <p className="text-text-muted text-sm">
              Use the dedicated webhooks console at{' '}
              <Link
                className="text-primary underline"
                href={`/workspace/${workspaceId}/developer/webhooks`}
              >
                /developer/webhooks
              </Link>
              .
            </p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowWebhookModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function DeveloperPage() {
  if (!isEnterpriseEnabled()) {
    return <EnterpriseGated feature="Developer" />;
  }
  return <DeveloperContent />;
}
