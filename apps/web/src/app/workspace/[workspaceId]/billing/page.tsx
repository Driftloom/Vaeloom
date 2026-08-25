'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect } from 'react';
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

const invoiceColors: Record<string, StatusVariant> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
};

const invColor = (s: string): StatusVariant => invoiceColors[s] ?? 'neutral';

export default function BillingPage() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState('pro');
  const [changingPlan, setChangingPlan] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<{
    apiCalls: number;
    storage: number;
    users: number;
    agents: number;
  }>({ apiCalls: 0, storage: 0, users: 0, agents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch subscription
        try {
          const subscription = await billingApi.subscription();
          setSelectedPlan(subscription.plan);
        } catch (e) {
          if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
            // No subscription yet, keep default
          } else {
            throw e;
          }
        }

        // Fetch usage
        const usageRecords = await billingApi.usage();
        const usageData = { apiCalls: 0, storage: 0, users: 0, agents: 0 };
        usageRecords.forEach((record) => {
          switch (record.metric) {
            case 'api_calls':
              usageData.apiCalls = record.value;
              break;
            case 'storage':
              usageData.storage = record.value;
              break;
            case 'users':
              usageData.users = record.value;
              break;
            case 'agents':
              usageData.agents = record.value;
              break;
          }
        });
        setUsage(usageData);

        // For invoices, we'll show a placeholder since there's no invoice endpoint
        setInvoices([]);
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
          setError('This feature requires an Enterprise license. Contact sales@vaeloom.app.');
        } else {
          setError('Failed to load billing data. Please try again later.');
        }
        console.error('Billing data fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

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
        <Button variant="ghost" size="sm" onClick={() => window.open('#')}>
          Download
        </Button>
      ),
      className: 'text-right',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-muted">Loading billing data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-mono uppercase tracking-widest text-text-dim mb-4">
          Enterprise — Gated
        </div>
        <h1 className="text-2xl font-display font-medium text-text mb-2">Billing</h1>
        <p className="text-text-muted max-w-lg">{error}</p>
        <div className="mt-6 flex gap-3">
          <a href="mailto:sales@vaeloom.app" className="btn-secondary">
            Contact sales
          </a>
        </div>
      </div>
    );
  }

  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Billing" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Billing</h1>
        <p className="text-text-muted">Manage your subscription, usage, and payment methods.</p>
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
            <ProgressBar value={usage.apiCalls} max={10000} label="API Calls" color="primary" />
            <ProgressBar value={usage.storage} max={10} label="Storage Used (GB)" color="accent" />
            <ProgressBar value={usage.users} max={25} label="Active Users" color="success" />
            <ProgressBar value={usage.agents} max={25} label="Agents Deployed" color="warning" />
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <h2 className="text-lg font-display font-medium text-text mb-4">Invoice History</h2>
        <Table columns={invoiceColumns} data={invoices} keyExtractor={(inv) => inv.id} />
      </Card>

      <Card padding="lg">
        <h2 className="text-lg font-display font-medium text-text mb-4">Payment Method</h2>
        {/* F-02: previously displayed a fictional "Visa ending in 4242".
            No payment-method backend exists yet — honest state shown. */}
        <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
          <div>
            <p className="text-text">No payment method on file</p>
            <p className="text-text-muted text-sm">
              Payment collection is not configured for this environment.
            </p>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        title="Change Plan"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-text-muted text-sm">
            Select a new plan. Changes take effect next billing cycle.
          </p>
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
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        Most Popular
                      </span>
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
                  // F-03: persist the plan change to the real billing API.
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
                    detail:
                      err instanceof ApiClientError
                        ? err.message
                        : 'The billing service could not complete the change. No changes were applied.',
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
