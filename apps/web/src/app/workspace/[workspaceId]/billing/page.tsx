'use client';
import React, { useState } from 'react';
import { Button, Card, Modal } from '@vaeloom/ui-kit';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

const plans = [
  { id: 'starter', name: 'Starter', price: '$29/mo', features: ['5 agents', '1 GB storage', '1,000 API calls/mo', 'Community support'], popular: false },
  { id: 'pro', name: 'Professional', price: '$99/mo', features: ['25 agents', '10 GB storage', '10,000 API calls/mo', 'Priority support', 'Custom integrations'], popular: true },
  { id: 'enterprise', name: 'Enterprise', price: '$299/mo', features: ['Unlimited agents', '100 GB storage', 'Unlimited API calls', 'Dedicated support', 'On-premise option', 'SLA guarantee'], popular: false },
];

const invoices: Invoice[] = [
  { id: 'inv_001', date: 'Jul 1, 2026', amount: '$99.00', status: 'paid', description: 'Professional Plan - Monthly' },
  { id: 'inv_002', date: 'Jun 1, 2026', amount: '$99.00', status: 'paid', description: 'Professional Plan - Monthly' },
  { id: 'inv_003', date: 'May 1, 2026', amount: '$99.00', status: 'paid', description: 'Professional Plan - Monthly' },
  { id: 'inv_004', date: 'Apr 1, 2026', amount: '$29.00', status: 'paid', description: 'Starter Plan - Monthly' },
  { id: 'inv_005', date: 'Mar 1, 2026', amount: '$29.00', status: 'pending', description: 'Starter Plan - Monthly' },
];

const invoiceColors: Record<string, StatusVariant> = { paid: 'success', pending: 'warning', failed: 'error' };

const invColor = (s: string): StatusVariant => invoiceColors[s] ?? 'neutral';

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState('pro');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const invoiceColumns: Column<Invoice>[] = [
    { key: 'date', header: 'Date', className: 'text-text-muted' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', className: 'font-mono' },
    { key: 'status', header: 'Status', render: (inv) => <StatusBadge variant={invColor(inv.status)} label={inv.status} /> },
    { key: 'id', header: '', render: (inv) => <Button variant="ghost" size="sm" onClick={() => window.open('#')}>Download</Button>, className: 'text-right' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Billing</h1>
        <p className="text-text-muted">Manage your subscription, usage, and payment methods.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-2">Current Plan</h2>
          <div className="text-3xl font-display text-primary mt-2">{plans.find(p => p.id === selectedPlan)?.name}</div>
          <div className="text-text-muted text-sm mt-1">{plans.find(p => p.id === selectedPlan)?.price}</div>
          <ul className="mt-4 space-y-2">
            {plans.find(p => p.id === selectedPlan)?.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-text">
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {f}
              </li>
            ))}
          </ul>
          <Button variant="secondary" fullWidth className="mt-6" onClick={() => { setPendingPlan(selectedPlan); setShowChangeModal(true); }}>
            Change Plan
          </Button>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">Usage This Month</h2>
          <div className="space-y-4">
            <ProgressBar value={4200} max={10000} label="API Calls" color="primary" />
            <ProgressBar value={3.2} max={10} label="Storage Used (GB)" color="accent" />
            <ProgressBar value={8} max={25} label="Active Users" color="success" />
            <ProgressBar value={12} max={25} label="Agents Deployed" color="warning" />
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <h2 className="text-lg font-display font-medium text-text mb-4">Invoice History</h2>
        <Table columns={invoiceColumns} data={invoices} keyExtractor={(inv) => inv.id} />
      </Card>

      <Card padding="lg">
        <h2 className="text-lg font-display font-medium text-text mb-4">Payment Method</h2>
        <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
          <div className="w-12 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center text-white text-xs font-bold">VISA</div>
          <div>
            <p className="text-text">Visa ending in 4242</p>
            <p className="text-text-muted text-sm">Expires 12/2027</p>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowPaymentModal(true)}>
            Update
          </Button>
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
                    {plan.popular && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Most Popular</span>}
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
            <Button variant="secondary" onClick={() => setShowChangeModal(false)}>Cancel</Button>
            <Button onClick={() => { setSelectedPlan(pendingPlan); setShowChangeModal(false); }}>Confirm Change</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Update Payment Method">
        <div className="space-y-4">
          <div className="p-4 bg-background rounded-lg border border-border text-text-muted text-sm text-center">
            Payment method integration would open here (Stripe Elements, etc.)
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button onClick={() => setShowPaymentModal(false)}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
