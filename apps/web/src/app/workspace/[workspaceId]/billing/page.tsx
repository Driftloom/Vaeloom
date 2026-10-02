'use client';
import { EnterpriseGated, useEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { Button, Card, Modal } from '@vaeloom/ui-kit';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { PageHeader } from '@/components/shared/Page';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { billingApi, ApiClientError } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

/**
 * ILLUSTRATIVE — NOT SERVER DATA.
 *
 * No plan/entitlement endpoint exists on the billing router, so these prices,
 * feature lists and quota caps are hardcoded placeholders. They are labelled as
 * such wherever they render, and `selectedPlan` is only ever set from a live
 * `GET /billing/subscription` response, so this array can never be the source of
 * a claim about what the workspace is actually subscribed to.
 */
const ILLUSTRATIVE_PLANS = [
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

/**
 * ILLUSTRATIVE QUOTA CAPS — not from an entitlement API.
 * Usage below is live; the denominators these bars divide by are not.
 */
const ILLUSTRATIVE_CAPS = { apiCalls: 10000, storage: 10, users: 25, agents: 25 };

const invoiceColors: Record<string, StatusVariant> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
};

const invColor = (s: string): StatusVariant => invoiceColors[s] ?? 'neutral';

export default function BillingPage() {
  const enterpriseEnabled = useEnterpriseEnabled();
  // ── Hooks must be BEFORE early return guard (no conditional hooks) ─────────
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? null;

  // A pending, client-side selection only. It is NOT the workspace's plan: the
  // previous version persisted this to localStorage and rendered it as "Current
  // Plan", so a browser preference read as a subscription. It is never written to
  // storage, and it only becomes a rendered plan once the server confirms it.
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState('pro');
  const [changingPlan, setChangingPlan] = useState(false);

  // The fetchers must NOT swallow the rejection. `.catch(() => null)` turned a
  // 500 into `data === null`, which rendered the static plan catalog with no
  // indication that anything had failed.
  const {
    data: subscriptionData,
    error: subError,
    isLoading: subLoading,
  } = useSWR('billing-subscription', () => billingApi.subscription(), {
    revalidateOnFocus: false,
  });
  const {
    data: usageRecords,
    error: usageError,
    isLoading: usageLoading,
  } = useSWR('billing-usage', () => billingApi.usage(), { revalidateOnFocus: false });
  const {
    data: invoicesData,
    error: invoicesError,
    isLoading: invoicesLoading,
  } = useSWR('billing-invoices', () => billingApi.invoices(), { revalidateOnFocus: false });

  // Map live subscription -> selectedPlan (backend wins when present)
  useEffect(() => {
    const livePlan = (subscriptionData as { plan?: string } | undefined)?.plan;
    if (typeof livePlan === 'string' && ILLUSTRATIVE_PLANS.some((p) => p.id === livePlan)) {
      setSelectedPlan(livePlan);
      setPendingPlan(livePlan);
    } else if (typeof livePlan === 'string') {
      // A plan this build does not know about is still a real plan; do not
      // pretend it is one of the three catalog entries.
      setSelectedPlan(null);
      setPendingPlan(livePlan);
    }
  }, [subscriptionData]);

  const hasLiveSubscription = !!subscriptionData;
  const hasLiveUsage = Array.isArray(usageRecords) && usageRecords.length > 0;
  const isLive = hasLiveSubscription || hasLiveUsage;
  const currentPlan = ILLUSTRATIVE_PLANS.find((p) => p.id === selectedPlan) ?? null;

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

  const displayUsage = liveUsage ?? { apiCalls: 0, storage: 0, users: 0, agents: 0 };
  const hasLiveInvoices = Array.isArray(invoicesData) && invoicesData.length > 0;
  const displayInvoices: Invoice[] = hasLiveInvoices
    ? (invoicesData as unknown as Array<{
        id: string;
        plan: string;
        amount: number;
        status: string;
        periodStart: string;
      }>)!.map((inv) => ({
        id: inv.id,
        date: inv.periodStart ? new Date(inv.periodStart).toISOString().slice(0, 10) : inv.id,
        amount: `$${Number(inv.amount).toFixed(2)}`,
        status: inv.status as Invoice['status'],
        description: `${inv.plan} plan — ${inv.periodStart ? new Date(inv.periodStart).toLocaleDateString() : inv.id}`,
      }))
    : [];

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
                window.open(
                  dl.download_url || `/api/v1/billing/invoices/${inv.id}/download`,
                  '_blank',
                  'noopener,noreferrer',
                );
                toast({ tone: 'success', title: 'Invoice download ready', detail: inv.id });
              } catch (e) {
                toast({
                  tone: 'error',
                  title: 'Download failed',
                  detail: e instanceof ApiClientError ? e.message : 'Could not fetch invoice',
                });
              }
            } else {
              toast({
                tone: 'info',
                title: 'Invoice download unavailable',
                detail: 'No live billing records connected to this workspace.',
              });
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
  if (!enterpriseEnabled) return <EnterpriseGated feature="Billing" />;

  const header = (
    <PageHeader
      title="Billing"
      description="Subscription, usage and invoice history for this workspace."
      actions={
        <span className={`text-xs ${isLive ? 'text-success' : 'text-text-dim'}`}>
          {isLive ? 'Live data from backend' : 'Backend returned no billing records'}
        </span>
      }
    />
  );

  return (
    <div className="space-y-8">
      {header}

      {isLoading ? (
        <LoadingSpinner text="Loading billing data..." />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card padding="lg">
              <h2 className="text-lg font-display font-medium text-text mb-2">Current Plan</h2>
              {subError ? (
                <ErrorState
                  title="Failed to load subscription"
                  message={`${subError.message} Nothing is asserted about the plan below.`}
                />
              ) : hasLiveSubscription && currentPlan ? (
                <>
                  <div className="text-3xl font-display text-primary mt-2">{currentPlan.name}</div>
                  <div className="text-text-muted text-sm mt-1">{currentPlan.price}</div>
                  <ul className="mt-4 space-y-2">
                    {currentPlan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-text">
                        <svg
                          className="w-4 h-4 text-primary shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
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
                    Source: GET /billing/subscription (live) — plan <code>{selectedPlan}</code>.
                    Prices and feature lists shown are illustrative catalog placeholders, not a
                    server entitlement record.
                  </p>
                </>
              ) : hasLiveSubscription ? (
                <div className="space-y-2">
                  <div className="text-lg font-mono text-primary">
                    {(subscriptionData as { plan?: string })?.plan}
                  </div>
                  <p className="text-sm text-text-muted">
                    This plan is not in the illustrative catalog shown in the plan picker, so no
                    price or feature list can be displayed for it.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-lg font-display text-text-muted">Not reported</div>
                  <p className="text-sm text-text-muted">
                    GET /billing/subscription returned no subscription for this workspace. No plan
                    is claimed.
                  </p>
                </div>
              )}
              <Button
                variant="secondary"
                fullWidth
                className="mt-6"
                onClick={() => {
                  setPendingPlan(selectedPlan ?? 'pro');
                  setShowChangeModal(true);
                }}
              >
                {selectedPlan ? 'Change Plan' : 'Choose a Plan'}
              </Button>
            </Card>

            <Card padding="lg">
              <h2 className="text-lg font-display font-medium text-text mb-4">Usage This Month</h2>
              {usageError ? (
                <ErrorState
                  title="Failed to load usage"
                  message={`${usageError.message} No usage figures are shown.`}
                />
              ) : (
                <>
                  <div className="space-y-4">
                    <ProgressBar
                      value={displayUsage.apiCalls}
                      max={ILLUSTRATIVE_CAPS.apiCalls}
                      label="API Calls"
                      color="primary"
                    />
                    <ProgressBar
                      value={displayUsage.storage}
                      max={ILLUSTRATIVE_CAPS.storage}
                      label="Storage Used (GB)"
                      color="accent"
                    />
                    <ProgressBar
                      value={displayUsage.users}
                      max={ILLUSTRATIVE_CAPS.users}
                      label="Active Users"
                      color="success"
                    />
                    <ProgressBar
                      value={displayUsage.agents}
                      max={ILLUSTRATIVE_CAPS.agents}
                      label="Agents Deployed"
                      color="warning"
                    />
                  </div>
                  <p className="mt-4 text-xs text-text-dim font-mono">
                    {hasLiveUsage ? (
                      <span className="text-success">
                        Numerators are live from GET /billing/usage —{' '}
                        {Array.isArray(usageRecords) ? usageRecords.length : 0} record(s)
                      </span>
                    ) : (
                      <span>GET /billing/usage reported no records for this period.</span>
                    )}{' '}
                    Denominators are illustrative placeholders: no entitlement endpoint exists, so
                    these bars are not a utilisation measure.
                  </p>
                </>
              )}
            </Card>
          </div>

          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Invoice History</h2>
            {invoicesError ? (
              <ErrorState
                title="Failed to load invoices"
                message={`${invoicesError.message} No invoice records are shown, which is not the same as having none.`}
              />
            ) : displayInvoices.length > 0 ? (
              <Table
                columns={invoiceColumns}
                data={displayInvoices}
                keyExtractor={(inv) => inv.id}
              />
            ) : (
              <div className="p-8 text-center border border-dashed border-border rounded-lg">
                <p className="text-text-muted text-sm">No billing invoices returned.</p>
                <p className="text-text-dim text-xs mt-1">
                  GET /billing/invoices returned zero records for this workspace.
                </p>
              </div>
            )}
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Payment Method</h2>
            <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
              <div>
                <p className="text-text">No payment method on file</p>
                <p className="text-text-muted text-sm">
                  Payment collection is not configured for this environment.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      <Modal
        isOpen={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        title="Change Plan"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-text-muted text-sm">
            Select a plan to request. The list below is an illustrative catalog — the server decides
            what is actually available and what the change costs.
          </p>
          <div className="grid grid-cols-1 gap-4">
            {ILLUSTRATIVE_PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                aria-pressed={pendingPlan === plan.id}
                className={
                  pendingPlan === plan.id ? 'btn-primary text-left' : 'btn-secondary text-left'
                }
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
                      <span className="text-primary" aria-hidden="true">
                        ·
                      </span>{' '}
                      {f}
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
                  const updated = await billingApi.createSubscription(pendingPlan);
                  setSelectedPlan(updated?.plan ?? pendingPlan);
                  setShowChangeModal(false);
                  toast({
                    tone: 'success',
                    title: 'Plan updated',
                    detail: `Server confirmed plan "${updated?.plan ?? pendingPlan}".`,
                  });
                } catch (err) {
                  // No state is changed on failure, so the UI never shows a plan
                  // the server did not accept.
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
