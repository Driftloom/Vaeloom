'use client';
import React, { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { Toggle } from '@/components/shared/Toggle';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/Toast';
import { api } from '@/lib/api';

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  retry_count: number;
  timeout_ms: number;
  created_at: string;
}

interface DeliveryItem {
  id: string;
  webhook_id: string;
  event_type: string;
  status: string;
  status_code: number | null;
  completed_at: string | null;
  created_at: string;
}

const eventOptions = [
  'job.match',
  'application.submitted',
  'agent.task.completed',
  'memory.created',
  'workspace.updated',
  'user.joined',
  'billing.invoice',
  '*',
];

export default function WebhooksPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('https://');
  const [newSecret, setNewSecret] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['*']);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookItem | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [showDeliveries, setShowDeliveries] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.request<{ webhooks: WebhookItem[] }>('/webhooks');
      setWebhooks(res.webhooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeliveries = useCallback(async (webhookId: string) => {
    try {
      const res = await api.request<{ deliveries: DeliveryItem[] }>(
        `/webhooks/${webhookId}/deliveries`,
      );
      setDeliveries(res.deliveries);
    } catch {
      setDeliveries([]);
    }
  }, []);

  const createWebhook = useCallback(async () => {
    try {
      // F-02: when the user leaves the secret empty, omit it and let the
      // backend generate the real signing secret (webhooks.py auto-generates).
      // The client previously invented a fake 'sk-...' value.
      const body: Record<string, unknown> = {
        name: newName,
        url: newUrl,
        events: newEvents,
        active: true,
      };
      if (newSecret.trim()) body['secret'] = newSecret.trim();
      await api.request('/webhooks', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setShowCreate(false);
      setNewName('');
      setNewUrl('https://');
      setNewSecret('');
      setNewEvents(['*']);
      await fetchWebhooks();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Create failed',
        detail: err instanceof Error ? err.message : '',
      });
    }
  }, [newName, newUrl, newSecret, newEvents, fetchWebhooks]);

  const toggleActive = useCallback(
    async (webhook: WebhookItem) => {
      try {
        await api.request(`/webhooks/${webhook.id}`, {
          method: 'PUT',
          body: JSON.stringify({ active: !webhook.active }),
        });
        await fetchWebhooks();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Update failed',
          detail: err instanceof Error ? err.message : '',
        });
      }
    },
    [fetchWebhooks],
  );

  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);

  const deleteWebhook = useCallback(
    async (webhookId: string) => {
      try {
        await api.request(`/webhooks/${webhookId}`, { method: 'DELETE' });
        await fetchWebhooks();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Delete failed',
          detail: err instanceof Error ? err.message : '',
        });
      }
    },
    [fetchWebhooks],
  );

  const testFire = useCallback(
    async (webhookId: string) => {
      try {
        await api.request(`/webhooks/test/${webhookId}`, { method: 'POST' });
        await fetchDeliveries(webhookId);
        setShowDeliveries(true);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Test failed',
          detail: err instanceof Error ? err.message : '',
        });
      }
    },
    [fetchDeliveries],
  );

  const viewDeliveries = useCallback(
    async (webhook: WebhookItem) => {
      setSelectedWebhook(webhook);
      await fetchDeliveries(webhook.id);
      setShowDeliveries(true);
    },
    [fetchDeliveries],
  );

  const toggleEvent = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const webhookColumns: Column<WebhookItem>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (w) => <span className="font-medium text-text">{w.name}</span>,
    },
    {
      key: 'url',
      header: 'URL',
      render: (w) => (
        <code className="text-xs font-mono text-text-muted truncate max-w-[200px] block">
          {w.url}
        </code>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      render: (w) => (
        <div className="flex flex-wrap gap-1">
          {w.events.slice(0, 3).map((e) => (
            <span
              key={e}
              className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted"
            >
              {e}
            </span>
          ))}
          {w.events.length > 3 && (
            <span className="text-xs text-text-muted">+{w.events.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      render: (w) => <Toggle enabled={w.active} onChange={() => toggleActive(w)} />,
    },
    {
      key: 'id',
      header: '',
      render: (w) => (
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => testFire(w.id)}>
            Test
          </Button>
          <Button variant="secondary" size="sm" onClick={() => viewDeliveries(w)}>
            Deliveries
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWebhookToDelete(w.id)}
            className="text-accent"
          >
            Delete
          </Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Webhooks</h1>
          <p className="text-text-muted">Manage outgoing webhook endpoints and delivery logs.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create Webhook</Button>
      </header>

      <Card padding="lg">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface-active animate-pulse rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-accent mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchWebhooks}>
              Retry
            </Button>
          </div>
        ) : webhooks.length === 0 ? (
          <EmptyState
            title="No webhooks configured"
            description="Create a webhook to receive real-time events from your workspace."
            action={{ label: 'Create Webhook', onClick: () => setShowCreate(true) }}
          />
        ) : (
          <Table columns={webhookColumns} data={webhooks} keyExtractor={(w) => w.id} />
        )}
      </Card>

      {showDeliveries && selectedWebhook && (
        <Card padding="lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-display font-medium text-text">
              Deliveries: {selectedWebhook.name}
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setShowDeliveries(false)}>
              Close
            </Button>
          </div>
          {deliveries.length === 0 ? (
            <p className="text-text-muted text-sm">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border border-border text-sm"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      variant={
                        d.status === 'DELIVERED'
                          ? 'success'
                          : d.status === 'FAILED'
                            ? 'error'
                            : 'warning'
                      }
                      label={d.status}
                    />
                    <span className="font-mono text-text-muted text-xs">{d.event_type}</span>
                  </div>
                  <div className="text-text-muted text-xs font-mono">
                    {d.status_code && <span>HTTP {d.status_code} </span>}
                    {d.created_at && new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Webhook">
        <div className="space-y-4">
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Production"
          />
          <Input
            label="URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://hooks.example.com/events"
          />
          <Input
            label="Secret"
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            placeholder="Leave blank to auto-generate"
          />
          <div className="space-y-1">
            <span id="events-label" className="block text-sm font-medium text-text">
              Events
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="events-label">
              {eventOptions.map((event) => {
                const eventId = `event-${event}`;
                return (
                  <label
                    key={event}
                    htmlFor={eventId}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      id={eventId}
                      type="checkbox"
                      checked={newEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-mono text-text-muted">{event}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createWebhook} disabled={!newName || !newUrl}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!webhookToDelete}
        onClose={() => setWebhookToDelete(null)}
        onConfirm={() => {
          if (webhookToDelete) deleteWebhook(webhookToDelete);
        }}
        title="Delete Webhook"
        message="Delete this webhook? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
