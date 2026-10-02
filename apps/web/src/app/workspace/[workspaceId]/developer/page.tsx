'use client';
import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EnterpriseGated, useEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import useSWR from 'swr';
import {
  apiKeysApi,
  webhookApi,
  type ApiKeyItem,
  type WebhookDeliveryItem,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { API_BASE, API_PREFIX } from '@/lib/api';

/**
 * The outcome of one webhook test. `pending` is a first-class state, not a
 * synonym for success: the delivery record can exist with a status the API has
 * not resolved yet, and rendering that green would claim a delivery that
 * never happened.
 */
type WebhookTestStatus = 'delivered' | 'failed' | 'pending';

interface WebhookTestOutcome {
  id: string;
  event: string;
  url: string;
  status: WebhookTestStatus;
  /** Real HTTP response code from the delivery record, or null when none was reported. */
  statusCode: number | null;
  timestamp: string;
  deliveryCount: number;
  note: string;
}

function deliveryStatusOf(delivery: WebhookDeliveryItem | null): WebhookTestStatus {
  const raw = (delivery as unknown as { status?: unknown } | null)?.status;
  const status = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (status === 'delivered' || status === 'success' || status === 'ok') return 'delivered';
  if (status === 'failed' || status === 'error') return 'failed';
  return 'pending';
}

/**
 * `WebhookDeliveryItem` has no timing field, so there is no duration to show.
 * An HTTP status code is not a duration and must never be rendered as
 * milliseconds; it gets its own row instead.
 */
function deliveryStatusCodeOf(delivery: WebhookDeliveryItem | null): number | null {
  if (!delivery) return null;
  // The api client camelCases response keys via `transformKeys`; the declared
  // type still uses the wire spelling, so both are accepted.
  const record = delivery as unknown as Record<string, unknown>;
  const raw = record['statusCode'] ?? record['status_code'];
  return typeof raw === 'number' ? raw : null;
}

const STATUS_VARIANT: Record<WebhookTestStatus, 'success' | 'error' | 'info'> = {
  delivered: 'success',
  failed: 'error',
  pending: 'info',
};

/**
 * Static reference values transcribed from the published API policy. They are
 * NOT read from the server, so they say nothing about this workspace's plan,
 * its current consumption, or what the limiter will actually enforce.
 */
const documentedRateLimits = [
  { name: 'REST API', limit: '1,000 / hour' },
  { name: 'GraphQL API', limit: '500 / hour' },
  { name: 'Streaming API', limit: '100 / min' },
  { name: 'Webhook Delivery', limit: '500 / hour' },
];

const sdkItems = [
  { name: 'TypeScript SDK', version: '2.4.1', npm: 'npm install @vaeloom/sdk' },
  { name: 'Python SDK', version: '1.8.0', pip: 'pip install vaeloom-sdk' },
  { name: 'Go SDK', version: '0.9.2', go: 'go get github.com/vaeloom/go-sdk' },
  { name: 'REST API', version: 'v2', doc: '/api/v2/docs' },
];

const API_DOCS_BASE = `${API_BASE}${API_PREFIX}/docs`;

const apiDocLinks = [
  { name: 'Authentication API', url: `${API_DOCS_BASE}#/Auth` },
  { name: 'Agents & ReAct API', url: `${API_DOCS_BASE}#/Agents` },
  { name: 'SCALE Cognition API', url: `${API_DOCS_BASE}#/Cognition` },
  { name: 'Council Adjudication API', url: `${API_DOCS_BASE}#/Council` },
  { name: 'Webhook Subscriptions API', url: `${API_DOCS_BASE}#/Webhooks` },
  { name: 'Connectors & MCP API', url: `${API_DOCS_BASE}#/Connectors` },
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
  const [webhookUrl, setWebhookUrl] = useState('https://');
  const [webhookEvent, setWebhookEvent] = useState('job.match');
  /**
   * Supplied by the user, per test, and never persisted. The previous build
   * hardcoded the literal "test-secret" and shipped it to the API as if it were
   * a chosen secret; a hardcoded value is not a secret and must not be presented
   * as one.
   */
  const [webhookTestSecret, setWebhookTestSecret] = useState('');
  const [webhookResult, setWebhookResult] = useState<WebhookTestOutcome | null>(null);
  const [showTestConsole, setShowTestConsole] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

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
    if (!webhookTestSecret.trim()) {
      toast({
        tone: 'error',
        title: 'Test secret required',
        detail:
          'Enter a throwaway signing secret for this test run. It is sent once and discarded.',
      });
      return;
    }
    setIsSendingTest(true);
    setWebhookResult(null);
    try {
      const wh = await webhookApi.create({
        name: `test-${webhookEvent}-${Date.now()}`,
        url: webhookUrl,
        secret: webhookTestSecret.trim(),
        events: [webhookEvent],
        active: true,
      });
      const testResult = await webhookApi.test(wh.id);
      let delivery: WebhookDeliveryItem | null = null;
      try {
        const { deliveries } = await webhookApi.deliveries(wh.id);
        delivery = deliveries?.[0] ?? null;
      } catch {
        // The delivery list is a separate endpoint; if it is unavailable we say
        // so rather than inferring an outcome from its absence.
      }
      await webhookApi.delete(wh.id).catch(() => {});

      const status = deliveryStatusOf(delivery);
      const statusCode = deliveryStatusCodeOf(delivery);
      setWebhookResult({
        id: delivery?.id ?? `wh_${Date.now()}`,
        event: webhookEvent,
        url: webhookUrl,
        status,
        statusCode,
        timestamp: delivery?.created_at ?? new Date().toISOString(),
        deliveryCount: testResult.delivery_count,
        note: delivery
          ? 'Recorded delivery, reported by the server.'
          : 'The API accepted the test but returned no delivery record, so the outcome is unknown.',
      });
      setWebhookTestSecret('');
      toast({
        tone: status === 'delivered' ? 'success' : status === 'failed' ? 'error' : 'info',
        title: status === 'delivered' ? 'Test webhook delivered' : 'Test webhook not confirmed',
        detail:
          status === 'delivered'
            ? `${testResult.delivery_count} delivery(ies) sent.`
            : status === 'failed'
              ? 'The endpoint reported a failed delivery.'
              : 'The API accepted the test but has not reported a delivery outcome.',
      });
    } catch (err) {
      setWebhookResult({
        id: `wh_${Date.now()}`,
        event: webhookEvent,
        url: webhookUrl,
        status: 'failed',
        statusCode: null,
        timestamp: new Date().toISOString(),
        deliveryCount: 0,
        note: err instanceof Error ? err.message : 'The test request itself failed.',
      });
      toast({
        tone: 'error',
        title: 'Test failed',
        detail: 'Backend unavailable or webhook URL unreachable.',
      });
    } finally {
      setIsSendingTest(false);
    }
  }, [webhookEvent, webhookUrl, webhookTestSecret, toast]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Developer"
        description="Manage API keys, webhooks, SDKs, and developer integration resources."
        actions={
          <span className={!keysError && !keysLoading ? 'text-success' : 'text-text-dim'}>
            {keysLoading
              ? 'Syncing…'
              : !keysError
                ? 'Connected to live API'
                : 'Backend unavailable'}
          </span>
        }
      />

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
        ) : keysError ? (
          // A failed list must not read as "this workspace has no keys".
          <ErrorState
            title="Failed to load API keys"
            message={keysError.message}
            onRetry={() => void mutateKeys()}
          />
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
        <h2 className="text-lg font-display font-medium text-text mb-1">Documented Rate Limits</h2>
        <p className="text-xs text-text-muted mb-4">
          Static reference values transcribed from the published API policy. They are not read from
          the server, so they do not reflect your plan, your current usage, or what the limiter will
          actually enforce on your next request.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {documentedRateLimits.map((rl) => (
            <div key={rl.name} className="bg-background rounded-lg p-4 border border-border">
              <p className="text-sm text-text-muted">{rl.name}</p>
              <p className="text-2xl font-display text-text mt-1">{rl.limit}</p>
              <p className="text-xs text-text-muted font-mono mt-1">Published policy (static)</p>
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
                <label htmlFor="webhook-event" className="block text-sm font-medium text-text">
                  Event Type
                </label>
                <select
                  id="webhook-event"
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
            <div>
              <label htmlFor="webhook-test-secret" className="block text-sm font-medium text-text">
                Test signing secret
              </label>
              <input
                id="webhook-test-secret"
                type="password"
                autoComplete="off"
                value={webhookTestSecret}
                onChange={(e) => setWebhookTestSecret(e.target.value)}
                placeholder="Enter a throwaway value for this run"
                aria-describedby="webhook-test-secret-help"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              />
              <p id="webhook-test-secret-help" className="text-xs text-text-muted mt-1">
                TEST VALUE ONLY. It is sent with this single test delivery and cleared immediately
                afterwards. It is not a real credential and is not stored.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => void sendTestWebhook()}
                disabled={isSendingTest}
                loading={isSendingTest}
              >
                Send Test Event
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setWebhookResult(null);
                  setWebhookTestSecret('');
                }}
              >
                Clear
              </Button>
            </div>
            {webhookResult && (
              <div className="p-4 bg-surface rounded-lg border border-border">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-text-muted">Status</span>
                  <span>
                    <StatusBadge
                      variant={STATUS_VARIANT[webhookResult.status]}
                      label={webhookResult.status}
                    />
                  </span>
                  <span className="text-text-muted">Event</span>
                  <span className="font-mono text-text">{webhookResult.event}</span>
                  <span className="text-text-muted">HTTP Status</span>
                  <span className="font-mono text-text">
                    {webhookResult.statusCode === null ? 'Not reported' : webhookResult.statusCode}
                  </span>
                  <span className="text-text-muted">Delivery Attempts</span>
                  <span className="font-mono text-text">{webhookResult.deliveryCount}</span>
                  <span className="text-text-muted">Timestamp</span>
                  <span className="text-text-muted text-xs">{webhookResult.timestamp}</span>
                </div>
                <p className="text-xs text-text-muted mt-3">{webhookResult.note}</p>
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
                  aria-hidden="true"
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
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
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
    </div>
  );
}

export default function DeveloperPage() {
  const enterpriseEnabled = useEnterpriseEnabled();
  if (!enterpriseEnabled) {
    return <EnterpriseGated feature="Developer" />;
  }
  return <DeveloperContent />;
}
