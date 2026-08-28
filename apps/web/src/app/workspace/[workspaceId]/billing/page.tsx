'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { Button, Card, Modal } from '@vaeloom/ui-kit';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { billingApi, ApiClientError } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29/mo',
    features: ['5 agents', '1 GB storage', '1,000 API calls/mo', 'Community support'],
    popular: false,
  },
  {
    id: 'pro',
    name: 'Professional',
    price: '$99/mo',
    features: [
      '25 agents',
      '10 GB storage',
      '10,000 API calls/mo',
      'Priority support',
      'Custom integrations',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$299/mo',
    features: [
      'Unlimited agents',
      '100 GB storage',
      'Unlimited API calls',
      'Dedicated support',
      'On-premise option',
      'SLA guarantee',
    ],
    popular: false,
  },
];

const mockInvoices: Invoice[] = [
  { id: 'inv_2026_07', date: '2026-07-01', amount: '$99.00', status: 'paid', description: 'Professional plan — July 2026' },
  { id: 'inv_2026_06', date: '2026-06-01', amount: '$99.00', status: 'paid', description: 'Professional plan — June 2026' },
  { id: 'inv_2026_05', date: '2026-05-01', amount: '$29.00', status: 'paid', description: 'Starter plan — May 2026' },
];

const mockUsage = { apiCalls: 3421, storage: 3.7, users: 8, agents: 6 };

const invoiceColors: Record<string, StatusVariant> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
};

const invColor = (s: string): StatusVariant => invoiceColors[s] ?? 'neutral';

const STORAGE_KEY_BASE = 'vaeloom.billing.selectedPlan';

export default function BillingPage() {
  // ── Hooks must be BEFORE early return guard (no conditional hooks) ─────────
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? null;
  const storageKey = workspaceId ? `${STORAGE_KEY_BASE}:${workspaceId}` : STORAGE_KEY_BASE;

  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState('pro');
  const [changingPlan, setChangingPlan] = useState(false);

  // Live fetches with mock fallback — never throw, return null on backend unavailable
  const { data: subscriptionData, isLoading: subLoading } = useSWR(
    'billing-subscription',
    () => billingApi.subscription().catch(() => null),
    { revalidateOnFocus: false },
  );
  const { data: usageRecords, isLoading: usageLoading } = useSWR(
    'billing-usage',
    () => billingApi.usage().catch(() => null),
    { revalidateOnFocus: false },
  );
  const { data: invoicesData, isLoading: invoicesLoading } = useSWR(
    'billing-invoices',
    () => billingApi.invoices().catch(() => null),
    { revalidateOnFocus: false },
  );

  // Hydrate selectedPlan from localStorage per workspace / global fallback
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      if (raw && plans.some((p) => p.id === raw)) {
        setSelectedPlan(raw);
        setPendingPlan(raw);
      }
    } catch {
      // ignore storage errors (SSR / privacy mode)
    }
  }, [storageKey]);

  // Persist selectedPlan to localStorage on change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, selectedPlan);
      }
    } catch {
      // ignore storage errors
    }
  }, [selectedPlan, storageKey]);

  // Map live subscription -> selectedPlan (backend wins when present)
  useEffect(() => {
    if (subscriptionData && typeof (subscriptionData as { plan?: string }).plan === 'string') {
      const livePlan = (subscriptionData as { plan: string }).plan;
      if (plans.some((p) => p.id === livePlan)) {
        setSelectedPlan(livePlan);
        setPendingPlan(livePlan);
      }
    }
  }, [subscriptionData]);

  const hasLiveSubscription = !!subscriptionData;
  const hasLiveUsage = Array.isArray(usageRecords) && usageRecords.length > 0;
  const isLive = hasLiveSubscription || hasLiveUsage;

  const liveUsage = React.useMemo(() => {
    if (!hasLiveUsage) return null;
    const base = { apiCalls: 0, storage: 0, users: 0, agents: 0 };
    for (const r of usageRecords as Array<{ metric: string; value: number }>) {
      switch (r.metric) {
        case 'api_calls':
          base.apiCalls = r.value;
          break;
        case 'storage':
          base.storage = r.value;
          break;
        case 'users':
          base.users = r.value;
          break;
        case 'agents':
          base.agents = r.value;
          break;
        default:
          break;
      }
    }
    return base;
  }, [usageRecords, hasLiveUsage]);

  const displayUsage = liveUsage ?? mockUsage;
  const hasLiveInvoices = Array.isArray(invoicesData) && invoicesData.length > 0;
  const displayInvoices: Invoice[] = hasLiveInvoices
    ? (invoicesData as unknown as Array<{ id: string; plan: string; amount: number; status: string; periodStart: string }>)!.map((inv) => ({
        id: inv.id,
        date: inv.periodStart ? new Date(inv.periodStart).toISOString().slice(0, 10) : inv.id,
        amount: `$${Number(inv.amount).toFixed(2)}`,
        status: inv.status as Invoice['status'],
        description: `${inv.plan} plan — ${inv.periodStart ? new Date(inv.periodStart).toLocaleDateString() : inv.id}`,
      }))
    : mockInvoices;

  const invoiceColumns: Column<Invoice>[] = [
    { key: 'date', header: 'Date', className: 'text-text-muted' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', className: 'font-mono' },
    {
      key: 'status',
      header: 'Status',
      render: (inv) => <StatusBadge variant={invColor(inv.status)} label={inv.status} />,
    },
    {
      key: 'id',
      header: '',
      render: (inv) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (hasLiveInvoices) {
              try {
                const dl = await billingApi.downloadInvoice(inv.id);
                window.open(dl.download_url || `/api/v1/billing/invoices/${inv.id}/download`, '_blank');
                toast({ tone: 'success', title: 'Invoice download ready', detail: inv.id });
              } catch (e) {
                toast({ tone: 'error', title: 'Download failed', detail: e instanceof ApiClientError ? e.message : 'Could not fetch invoice' });
              }
            } else {
              window.open('#');
              toast({ tone: 'info', title: 'Mock invoice', detail: 'No live invoice — enable ENTERPRISE_ROUTES_ENABLED' });
            }
          }}
        >
          Download
        </Button>
      ),
      className: 'text-right',
    },
  ];

  const isLoading = subLoading || usageLoading || invoicesLoading;

  // Enterprise gate — MUST stay after all hooks (no conditional hooks before)
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Billing" />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-muted">Loading billing data…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Billing</h1>
        <p className="text-text-muted">
          Manage your subscription, usage, and payment methods.{' '}
          <span className={isLive ? 'text-success' : 'text-text-dim'}>
            {isLive ? 'Live data from backend' : '(mock data — backend unavailable, enable ENTERPRISE_ROUTES_ENABLED)'}
          </span>
        </p>
        {!isLive && (
          <p className="mt-2 text-xs font-mono text-text-dim">
            Data source: mock fallback — backend /billing/* not reachable. Set{' '}
            <code className="rounded bg-surface px-1 py-0.5 border border-border">ENTERPRISE_ROUTES_ENABLED=true</code> on the API.
          </p>
        )}
        {isLive && (
          <p className="mt-2 text-xs font-mono text-text-dim">
            Data source:{' '}
            <span className="text-success">
              {hasLiveSubscription ? 'GET /billing/subscription (live)' : 'GET /billing/subscription (no subscription yet)'} +{' '}
              {hasLiveUsage ? 'GET /billing/usage (live)' : 'GET /billing/usage (empty)'}
            </span>
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-2">Current Plan</h2>
          <div className="text-3xl font-display text-primary mt-2">
            {plans.find((p) => p.id === selectedPlan)?.name}
          </div>
          <div className="text-text-muted text-sm mt-1">
            {plans.find((p) => p.id === selectedPlan)?.price}
          </div>
          <ul className="mt-4 space-y-2">
            {plans
              .find((p) => p.id === selectedPlan)
              ?.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-text">
                  <svg
                    className="w-4 h-4 text-primary shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {f}
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs text-text-dim font-mono">
            Selected plan persisted to <code className="bg-surface px-1 border border-border rounded">{storageKey}</code>
            {hasLiveSubscription ? ' · live subscription overrides local value when present' : ' · mock / local'}
          </p>
          <Button
            variant="secondary"
            fullWidth
            className="mt-6"
            onClick={() => {
              setPendingPlan(selectedPlan);
              setShowChangeModal(true);
            }}
          >
            Change Plan
          </Button>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">Usage This Month</h2>
          <div className="space-y-4">
            <ProgressBar value={displayUsage.apiCalls} max={10000} label="API Calls" color="primary" />
            <ProgressBar value={displayUsage.storage} max={10} label="Storage Used (GB)" color="accent" />
            <ProgressBar value={displayUsage.users} max={25} label="Active Users" color="success" />
            <ProgressBar value={displayUsage.agents} max={25} label="Agents Deployed" color="warning" />
          </div>
          <p className="mt-4 text-xs font-mono text-text-dim">
            {hasLiveUsage ? (
              <span className="text-success">Live usage from GET /billing/usage — {Array.isArray(usageRecords) ? usageRecords.length : 0} record(s)</span>
            ) : (
              <span>Mock usage — backend unavailable (showing {mockUsage.apiCalls} API calls, {mockUsage.storage} GB)</span>
            )}
          </p>
          {!hasLiveUsage && (
            <p className="text-[11px] text-text-dim mt-1">Enable ENTERPRISE_ROUTES_ENABLED to see real usage records.</p>
          )}
        </Card>
      </div>

      <Card padding="lg">
        <h2 className="text-lg font-display font-medium text-text mb-4">Invoice History</h2>
        <Table columns={invoiceColumns} data={displayInvoices} keyExtractor={(inv) => inv.id} />
        <p className="mt-3 text-xs text-text-dim font-mono">
          Source:{' '}
          {hasLiveInvoices ? (
            <span className="text-success">GET /billing/invoices (live) — {displayInvoices.length} invoice(s)</span>
          ) : (
            <span>mockInvoices fallback — no subscription/invoices yet; create a subscription to generate live invoices</span>
          )}
        </p>
      </Card>

      <Card padding="lg">
        <h2 className="text-lg font-display font-medium text-text mb-4">Payment Method</h2>
        <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
          <div>
            <p className="text-text">No payment method on file</p>
            <p className="text-text-muted text-sm">Payment collection is not configured for this environment.</p>
          </div>
        </div>
      </Card>

      <Modal isOpen={showChangeModal} onClose={() => setShowChangeModal(false)} title="Change Plan" size="lg">
        <div className="space-y-4">
          <p className="text-text-muted text-sm">Select a new plan. Changes take effect next billing cycle.</p>
          <div className="grid grid-cols-1 gap-4">
            {plans.map((plan) => (
              <button
                key={plan.id}
                className={`p-4 rounded-lg border text-left transition-colors ${pendingPlan === plan.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50'}`}
                onClick={() => setPendingPlan(plan.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-text">{plan.name}</span>
                    {plan.popular && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Most Popular</span>
                    )}
                  </div>
                  <span className="text-text-muted font-mono">{plan.price}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-sm text-text-muted flex items-center gap-1">
                      <span className="text-primary">·</span> {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowChangeModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={changingPlan || pendingPlan === selectedPlan}
              onClick={async () => {
                if (!pendingPlan) return;
                setChangingPlan(true);
                try {
                  await billingApi.createSubscription(pendingPlan);
                  setSelectedPlan(pendingPlan);
                  setShowChangeModal(false);
                  toast({
                    tone: 'success',
                    title: 'Plan updated',
                    detail: `Subscription switched to ${plans.find((p) => p.id === pendingPlan)?.name ?? pendingPlan}.`,
                  });
                } catch (err) {
                  toast({
                    tone: 'error',
                    title: 'Plan change failed',
                    detail: err instanceof ApiClientError ? err.message : 'The billing service could not complete the change. No changes were applied.',
                  });
                } finally {
                  setChangingPlan(false);
                }
              }}
            >
              {changingPlan ? 'Updating…' : 'Confirm Change'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
