'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ApprovalCard } from '@/components/shared/ApprovalCard';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { approvalApi, type ApprovalItem } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

export default function ApprovalsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const [active, setActive] = useState('pending');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    workspaceId ? `approvals-all-${workspaceId}-${active}` : null,
    () => approvalApi.list({ status: active === 'all' ? undefined : active.toUpperCase(), page: 1, page_size: 50 }),
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const agents = useMemo(() => Array.from(new Set(items.map((i) => i.agent_name))), [items]);
  const filtered = useMemo(() => {
    if (filterAgent === 'all') return items;
    return items.filter((i) => i.agent_name === filterAgent);
  }, [items, filterAgent]);

  const handleApprove = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await approvalApi.approve(id);
      toast({ tone: 'success', title: 'Approved' });
      await mutate();
    } catch (err) {
      toast({ tone: 'error', title: 'Approve failed', detail: err instanceof Error ? err.message : 'Please try again.' });
    } finally { setBusyId(null); }
  }, [mutate, toast]);

  const handleReject = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await approvalApi.reject(id);
      toast({ tone: 'success', title: 'Rejected' });
      await mutate();
    } catch (err) {
      toast({ tone: 'error', title: 'Reject failed', detail: err instanceof Error ? err.message : 'Please try again.' });
    } finally { setBusyId(null); }
  }, [mutate, toast]);

  const tabs = [
    { id: 'pending', label: `Pending${data?.total && active === 'pending' ? ` (${data.total})` : ''}` },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'expired', label: 'Expired' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Approvals</h1>
          <p className="text-text-muted text-sm">Unified inbox for all agent suggestions requiring approval. Least-privilege ΓÇö review scopes, risk, and expiry before acting. Use <kbd className="font-mono">A</kbd> to approve, <kbd className="font-mono">R</kbd> to reject.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
            <option value="all">All agents</option>
            {agents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => mutate()} className="btn-secondary text-sm">Refresh</button>
        </div>
      </header>

      <Tabs tabs={tabs} activeTab={active} onChange={setActive} />

      <TabPanel id={active} activeTab={active}>
        {isLoading ? <LoadingSpinner text="Loading approvals..." />
        : error ? <ErrorState title="Failed to load approvals" message={String((error as Error).message ?? error)} onRetry={() => mutate()} />
        : filtered.length === 0 ? <EmptyState title={active === 'pending' ? 'No pending approvals' : `No ${active} approvals`} description={active === 'pending' ? 'Agent suggestions will appear here ΓÇö Files renames, Gmail drafts, Schedule events, Job applications. All are reversible via History.' : `No ${active} items match the current filter.` } />
        : (
          <div className="space-y-4">
            {filtered.map((ap: ApprovalItem) => (
              <div key={ap.id} className={busyId === ap.id ? 'opacity-60 pointer-events-none' : ''}>
                <ApprovalCard
                  id={ap.id}
                  agentName={ap.agent_name}
                  actionType={ap.action_type}
                  description={ap.reason || `${ap.agent_name} requests approval for ${ap.action_type}`}
                  diff={ap.payload ? (() => { const payload = ap.payload as Record<string, unknown>; const oldT = payload['old_path'] ?? payload['oldPath']; const newT = payload['new_path'] ?? payload['newPath']; if (typeof oldT === 'string' && typeof newT === 'string') return { oldText: oldT, newText: newT }; return undefined; })() : undefined}
                  risk={undefined}
                  scopes={Array.isArray((ap.payload as Record<string, unknown>)?.['scopes']) ? (ap.payload as Record<string, unknown>)['scopes'] as string[] : []}
                  expiresAt={ap.expires_at ?? undefined}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
                <div className="mt-1 flex flex-wrap gap-2 text-xs font-mono text-text-dim px-1">
                  <span>{new Date(ap.created_at).toLocaleString()}</span>
                  <span>┬╖ {ap.status}</span>
                  {ap.requested_by && <span>┬╖ requested {ap.requested_by.slice(0, 8)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabPanel>
    </div>
  );
}
