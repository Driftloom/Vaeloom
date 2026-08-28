'use client';
import React, { useState, useCallback } from 'react';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { Button, Card, Input } from '@vaeloom/ui-kit';
import { Toggle } from '@/components/shared/Toggle';
import { StatusBadge } from '@/components/shared/StatusBadge';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { featureFlagsApi, type FeatureFlagItem } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

const CATEGORIES = ['general', 'ui', 'features', 'ai', 'integrations'];

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? '';

  const [activeTab, setActiveTab] = useState<'flags' | 'abtest' | 'audit'>('flags');
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagDesc, setNewFlagDesc] = useState('');
  const [newFlagCategory, setNewFlagCategory] = useState('general');

  const { data: flags, mutate, isLoading } = useSWR<FeatureFlagItem[]>(
    workspaceId ? `feature-flags:${workspaceId}` : null,
    () => featureFlagsApi.list(workspaceId),
    { revalidateOnFocus: false },
  );

  const [auditLog, setAuditLog] = useState<Array<{ flag: string; action: string; timestamp: string }>>([]);

  const appendAudit = useCallback((flagName: string, action: string) => {
    setAuditLog((prev) => [{ flag: flagName, action, timestamp: new Date().toLocaleString() }, ...prev].slice(0, 50));
  }, []);

  const handleToggle = useCallback(
    async (flag: FeatureFlagItem) => {
      try {
        const updated = await featureFlagsApi.toggle(flag.id);
        mutate((prev) => (prev ? prev.map((f) => (f.id === flag.id ? updated : f)) : prev), { revalidate: false });
        appendAudit(flag.name, updated.enabled ? `enabled (${updated.rollout_percentage}%)` : 'disabled');
        toast({ tone: 'success', title: `Flag ${updated.enabled ? 'enabled' : 'disabled'}`, detail: flag.name });
      } catch {
        toast({ tone: 'error', title: 'Toggle failed', detail: 'Backend unavailable.' });
      }
    },
    [mutate, appendAudit, toast],
  );

  const handleRollout = useCallback(
    async (flag: FeatureFlagItem, pct: number) => {
      const clamped = Math.max(0, Math.min(100, pct));
      try {
        const updated = await featureFlagsApi.update(flag.id, {
          rollout_percentage: clamped,
          enabled: clamped > 0,
        });
        mutate((prev) => (prev ? prev.map((f) => (f.id === flag.id ? updated : f)) : prev), { revalidate: false });
        appendAudit(flag.name, `rollout changed to ${clamped}%`);
      } catch {
        toast({ tone: 'error', title: 'Update failed', detail: 'Backend unavailable.' });
      }
    },
    [mutate, appendAudit, toast],
  );

  const handleCreate = useCallback(async () => {
    if (!newFlagName.trim()) return;
    try {
      const created = await featureFlagsApi.create(workspaceId, {
        name: newFlagName.trim(),
        description: newFlagDesc,
        category: newFlagCategory,
      });
      mutate((prev) => (prev ? [...prev, created] : [created]), { revalidate: false });
      appendAudit(created.name, 'created');
      toast({ tone: 'success', title: 'Flag created', detail: created.name });
      setNewFlagName('');
      setNewFlagDesc('');
    } catch {
      toast({ tone: 'error', title: 'Create failed', detail: 'Backend unavailable.' });
    }
  }, [workspaceId, newFlagName, newFlagDesc, newFlagCategory, mutate, appendAudit, toast]);

  const handleDelete = useCallback(
    async (flag: FeatureFlagItem) => {
      try {
        await featureFlagsApi.delete(flag.id);
        mutate((prev) => (prev ? prev.filter((f) => f.id !== flag.id) : prev), { revalidate: false });
        appendAudit(flag.name, 'deleted');
        toast({ tone: 'info', title: 'Flag deleted', detail: flag.name });
      } catch {
        toast({ tone: 'error', title: 'Delete failed', detail: 'Backend unavailable.' });
      }
    },
    [mutate, appendAudit, toast],
  );

  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Feature Flags" />;

  const flagList = flags ?? [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Feature Flags</h1>
        <p className="text-text-muted">
          Manage feature rollouts, A/B tests, and track changes.{' '}
          <span className={flagList.length > 0 ? 'text-success' : 'text-text-dim'}>
            {isLoading ? 'Syncing…' : flagList.length > 0 ? `${flagList.length} flags from backend` : 'No flags yet'}
          </span>
        </p>
      </header>

      <div className="flex gap-2 border-b border-border">
        {(['flags', 'abtest', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${activeTab === tab ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'flags' ? 'Flags' : tab === 'abtest' ? 'A/B Tests' : 'Audit Trail'}
          </button>
        ))}
      </div>

      {activeTab === 'flags' && (
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-medium text-text mb-3">Create New Flag</h3>
            <div className="flex gap-3 items-end">
              <Input label="Flag name" value={newFlagName} onChange={(e) => setNewFlagName(e.target.value)} placeholder="e.g. new-agent-ui" className="flex-1" />
              <Input label="Description" value={newFlagDesc} onChange={(e) => setNewFlagDesc(e.target.value)} placeholder="What this flag controls" className="flex-1" />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text">Category</label>
                <select
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm text-text"
                  value={newFlagCategory}
                  onChange={(e) => setNewFlagCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </Card>

          {flagList.map((flag) => (
            <Card key={flag.id} padding="md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Toggle enabled={flag.enabled} onChange={() => handleToggle(flag)} />
                    <div>
                      <span className="font-mono text-sm text-primary">{flag.name}</span>
                      <span className="ml-2 text-xs text-text-muted bg-surface-active px-2 py-0.5 rounded">{flag.category}</span>
                    </div>
                    <StatusBadge variant={flag.enabled ? 'success' : 'neutral'} label={flag.enabled ? 'ON' : 'OFF'} />
                    <span className="text-xs text-text-dim font-mono ml-auto hidden sm:inline">
                      {flag.updated_at?.slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mt-2 ml-11">{flag.description}</p>
                  <div className="ml-11 mt-3">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-text-muted w-32">Rollout: {flag.rollout_percentage}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={flag.rollout_percentage}
                        onChange={(e) => handleRollout(flag, parseInt(e.target.value, 10))}
                        className="flex-1 h-2 bg-surface-active rounded-lg appearance-none cursor-pointer accent-primary max-w-xs"
                      />
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(flag)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          {flagList.length === 0 && !isLoading && (
            <p className="text-text-dim text-sm text-center py-8">No flags yet. Create one above.</p>
          )}
        </div>
      )}

      {activeTab === 'abtest' && (
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">A/B Test Configuration</h2>
          <div className="space-y-4">
            <Input label="Test Name" placeholder="e.g. new-onboarding-flow" />
            <Input label="Description" placeholder="Describe what this test compares" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text">Variants</label>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Input placeholder="Variant A label" className="flex-1" />
                  <input type="number" min={0} max={100} className="w-20 bg-background border border-border rounded-md px-3 py-2 text-sm text-text" placeholder="50%" />
                </div>
                <div className="flex items-center gap-3">
                  <Input placeholder="Variant B label" className="flex-1" />
                  <input type="number" min={0} max={100} className="w-20 bg-background border border-border rounded-md px-3 py-2 text-sm text-text" placeholder="50%" />
                </div>
              </div>
            </div>
            <Button>Create Test</Button>
          </div>
          <p className="mt-4 text-xs text-text-dim font-mono">A/B tests use feature flags with rollout percentages. Create a flag above, then split traffic via rollout.</p>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">Audit Trail</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-4 text-xs font-mono text-text-muted uppercase tracking-wider pb-2 border-b border-border">
              <span>Flag</span>
              <span>Action</span>
              <span>Timestamp</span>
            </div>
            {auditLog.map((a, i) => (
              <div key={`${a.flag}-${a.timestamp}-${i}`} className="grid grid-cols-3 gap-4 py-2 text-sm text-text hover:bg-background/50 rounded px-2 -mx-2 transition-colors">
                <span className="font-mono text-primary">{a.flag}</span>
                <span className="text-text-muted">{a.action}</span>
                <span className="text-text-muted text-xs">{a.timestamp}</span>
              </div>
            ))}
            {auditLog.length === 0 && (
              <p className="text-text-dim text-sm text-center py-8">No audit entries yet. Toggle or create a flag to see changes here.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
