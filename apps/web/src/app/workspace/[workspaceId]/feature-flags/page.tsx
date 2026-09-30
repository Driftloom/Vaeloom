'use client';
import React, { useState, useCallback } from 'react';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { Button, Card, Input } from '@vaeloom/ui-kit';
import { Toggle } from '@/components/shared/Toggle';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/Page';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { featureFlagsApi, type FeatureFlagItem } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

const CATEGORIES = ['general', 'ui', 'features', 'ai', 'integrations'];

type TabId = 'flags' | 'abtest' | 'session';

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? '';

  const [activeTab, setActiveTab] = useState<TabId>('flags');
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagDesc, setNewFlagDesc] = useState('');
  const [newFlagCategory, setNewFlagCategory] = useState('general');

  const [abTestName, setAbTestName] = useState('');
  const [abTestDesc, setAbTestDesc] = useState('');
  const [variantALabel, setVariantALabel] = useState('Control');
  const [variantBLabel, setVariantBLabel] = useState('Treatment');
  const [splitPct, setSplitPct] = useState(50);
  const [isCreatingTest, setIsCreatingTest] = useState(false);

  // `error` was never destructured, so a 500 left `flags` undefined and the page
  // rendered "No flags yet. Create one above." — indistinguishable from an
  // empty workspace.
  const {
    data: flags,
    error,
    mutate,
    isLoading,
  } = useSWR<FeatureFlagItem[]>(
    workspaceId ? `feature-flags:${workspaceId}` : null,
    () => featureFlagsApi.list(workspaceId),
    { revalidateOnFocus: false },
  );

  /**
   * SESSION-LOCAL CHANGE LOG — NOT AN AUDIT TRAIL.
   *
   * There is no audit endpoint on the feature-flag router. This array is React
   * state, so it holds only the changes made in this browser session and is lost
   * on refresh. It is presented under a "This session" tab for that reason; a
   * durable compliance trail needs a server-side endpoint first.
   */
  const [sessionLog, setSessionLog] = useState<
    Array<{ flag: string; action: string; timestamp: string }>
  >([]);

  const appendSession = useCallback((flagName: string, action: string) => {
    setSessionLog((prev) =>
      [{ flag: flagName, action, timestamp: new Date().toLocaleString() }, ...prev].slice(0, 50),
    );
  }, []);

  const handleToggle = useCallback(
    async (flag: FeatureFlagItem) => {
      try {
        const updated = await featureFlagsApi.toggle(flag.id);
        mutate((prev) => (prev ? prev.map((f) => (f.id === flag.id ? updated : f)) : prev), {
          revalidate: false,
        });
        appendSession(
          flag.name,
          updated.enabled ? `enabled (${updated.rollout_percentage}%)` : 'disabled',
        );
        toast({
          tone: 'success',
          title: `Flag ${updated.enabled ? 'enabled' : 'disabled'}`,
          detail: flag.name,
        });
      } catch {
        toast({ tone: 'error', title: 'Toggle failed', detail: 'Backend unavailable.' });
      }
    },
    [mutate, appendSession, toast],
  );

  const handleRollout = useCallback(
    async (flag: FeatureFlagItem, pct: number) => {
      const clamped = Math.max(0, Math.min(100, pct));
      try {
        const updated = await featureFlagsApi.update(flag.id, {
          rollout_percentage: clamped,
          enabled: clamped > 0,
        });
        mutate((prev) => (prev ? prev.map((f) => (f.id === flag.id ? updated : f)) : prev), {
          revalidate: false,
        });
        appendSession(flag.name, `rollout changed to ${clamped}%`);
      } catch {
        toast({ tone: 'error', title: 'Update failed', detail: 'Backend unavailable.' });
      }
    },
    [mutate, appendSession, toast],
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
      appendSession(created.name, 'created');
      toast({ tone: 'success', title: 'Flag created', detail: created.name });
      setNewFlagName('');
      setNewFlagDesc('');
    } catch {
      toast({ tone: 'error', title: 'Create failed', detail: 'Backend unavailable.' });
    }
  }, [workspaceId, newFlagName, newFlagDesc, newFlagCategory, mutate, appendSession, toast]);

  const handleDelete = useCallback(
    async (flag: FeatureFlagItem) => {
      try {
        await featureFlagsApi.delete(flag.id);
        mutate((prev) => (prev ? prev.filter((f) => f.id !== flag.id) : prev), {
          revalidate: false,
        });
        appendSession(flag.name, 'deleted');
        toast({ tone: 'info', title: 'Flag deleted', detail: flag.name });
      } catch {
        toast({ tone: 'error', title: 'Delete failed', detail: 'Backend unavailable.' });
      }
    },
    [mutate, appendSession, toast],
  );

  /**
   * Creates ONE feature flag, not an experiment.
   *
   * There is no experiment entity, no variant identity and no assignment or
   * metrics service. The two "variants" were only ever a string in the flag
   * description, while `rollout_percentage` — the number that actually gates
   * exposure — was set from the B slider while the UI printed the inverse for A,
   * so the two halves of the screen disagreed about the split. Here the single
   * slider is `treatmentSharePct`: it is written verbatim to `rollout_percentage`
   * and the same number is displayed for both rows.
   */
  const handleCreateAbTest = useCallback(async () => {
    if (!abTestName.trim()) {
      toast({
        tone: 'error',
        title: 'Test name required',
        detail: 'Please enter a name for the split test.',
      });
      return;
    }
    setIsCreatingTest(true);
    try {
      const controlShare = 100 - splitPct;
      const description = [
        abTestDesc.trim() || 'Split rollout',
        '',
        `NOT AN A/B EXPERIMENT. One flag, no variant assignment and no metrics.`,
        `Variant A ("${variantALabel}") ${controlShare}% — not represented as an entity.`,
        `Variant B ("${variantBLabel}") ${splitPct}% — equals this flag's rollout_percentage.`,
      ].join('\n');
      const created = await featureFlagsApi.create(workspaceId, {
        name: abTestName.trim(),
        description,
        category: 'features',
        rollout_percentage: splitPct,
        enabled: true,
      });
      mutate((prev) => (prev ? [...prev, created] : [created]), { revalidate: false });
      appendSession(created.name, `split rollout created at ${splitPct}% treatment share`);
      toast({
        tone: 'success',
        title: 'Split Rollout Created',
        detail: `Created ${created.name} exposed to ${splitPct}% of traffic.`,
      });
      setAbTestName('');
      setAbTestDesc('');
      setActiveTab('flags');
    } catch {
      toast({
        tone: 'error',
        title: 'Create failed',
        detail: 'Could not create the split rollout flag.',
      });
    } finally {
      setIsCreatingTest(false);
    }
  }, [
    abTestName,
    abTestDesc,
    variantALabel,
    variantBLabel,
    splitPct,
    workspaceId,
    mutate,
    appendSession,
    toast,
  ]);

  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Feature Flags" />;

  const flagList = flags ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Feature Flags"
        description="Manage feature rollouts and traffic splits."
        actions={
          <span
            className={`ml-2 ${error ? 'text-error' : flagList.length > 0 ? 'text-success' : 'text-text-dim'}`}
          >
            {isLoading
              ? 'Syncing…'
              : error
                ? 'Could not load flags from the backend'
                : flagList.length > 0
                  ? `${flagList.length} flags from backend`
                  : 'No flags returned'}
          </span>
        }
      />

      <Tabs
        tabs={[
          { id: 'flags', label: 'Flags' },
          { id: 'abtest', label: 'Traffic Split' },
          { id: 'session', label: 'This Session' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      <TabPanel id="flags" activeTab={activeTab}>
        <div className="space-y-4">
          {error ? (
            <ErrorState
              title="Failed to load feature flags"
              message={`${
                (error as Error).message || 'The feature flag service returned an error.'
              } No flags are listed, which is not the same as having none.`}
              onRetry={() => {
                void mutate();
              }}
            />
          ) : (
            <>
              <Card padding="md">
                <h3 className="text-sm font-medium text-text mb-3">Create New Flag</h3>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <Input
                    label="Flag name"
                    value={newFlagName}
                    onChange={(e) => setNewFlagName(e.target.value)}
                    placeholder="e.g. new-agent-ui"
                    className="flex-1"
                  />
                  <Input
                    label="Description"
                    value={newFlagDesc}
                    onChange={(e) => setNewFlagDesc(e.target.value)}
                    placeholder="What this flag controls"
                    className="flex-1"
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="new-flag-category"
                      className="block text-sm font-medium text-text"
                    >
                      Category
                    </label>
                    <select
                      id="new-flag-category"
                      className="bg-background border border-border rounded-md px-3 py-2 text-sm text-text w-full sm:w-auto"
                      value={newFlagCategory}
                      onChange={(e) => setNewFlagCategory(e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={handleCreate} className="w-full sm:w-auto">
                    Create
                  </Button>
                </div>
              </Card>

              {flagList.map((flag) => (
                <Card key={flag.id} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* `label` is what names the switch: Toggle renders it as a
                            <label htmlFor> and as aria-labelledby. An
                            `aria-label` prop would be dropped, and a bare Toggle
                            with no label is an unnamed control. The flag name is
                            therefore rendered once, as the switch's own label. */}
                        <Toggle
                          enabled={flag.enabled}
                          onChange={() => handleToggle(flag)}
                          label={flag.name}
                        />
                        <span className="text-xs text-text-muted bg-surface-active px-2 py-0.5 rounded">
                          {flag.category}
                        </span>
                        <StatusBadge
                          variant={flag.enabled ? 'success' : 'neutral'}
                          label={flag.enabled ? 'ON' : 'OFF'}
                        />
                        <span className="text-xs text-text-dim font-mono ml-auto hidden sm:inline">
                          {flag.updated_at?.slice(0, 10)}
                        </span>
                      </div>
                      {flag.description && (
                        <p className="text-sm text-text-muted mt-2 ml-11 whitespace-pre-line">
                          {flag.description}
                        </p>
                      )}
                      <div className="ml-11 mt-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <label
                            htmlFor={`rollout-${flag.id}`}
                            className="text-xs text-text-muted sm:w-32"
                          >
                            Rollout: {flag.rollout_percentage}%
                          </label>
                          <input
                            id={`rollout-${flag.id}`}
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={flag.rollout_percentage}
                            onChange={(e) => handleRollout(flag, parseInt(e.target.value, 10))}
                            className="flex-1 h-2 bg-surface-active rounded-lg appearance-none cursor-pointer accent-primary max-w-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(flag)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
              {flagList.length === 0 && !isLoading && (
                <EmptyState
                  title="No flags yet"
                  description="The backend returned zero flags for this workspace. Create one above to get started."
                />
              )}
            </>
          )}
        </div>
      </TabPanel>

      <TabPanel id="abtest" activeTab={activeTab}>
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">Traffic Split</h2>
          <div className="p-3 rounded-lg bg-ai-needs-review/10 border border-ai-needs-review/30 text-xs text-ai-needs-review mb-4">
            <strong>A/B testing is not implemented.</strong> This form creates a single feature flag
            and sets its rollout percentage. There is no experiment entity, no variant identity, no
            traffic assignment between variants and no metrics collection. The variant labels below
            are stored as free text in the flag description and nothing routes traffic to them.
          </div>
          <div className="space-y-4">
            <Input
              label="Flag name"
              value={abTestName}
              onChange={(e) => setAbTestName(e.target.value)}
              placeholder="e.g. new-onboarding-flow"
            />
            <Input
              label="Description"
              value={abTestDesc}
              onChange={(e) => setAbTestDesc(e.target.value)}
              placeholder="Describe what this rollout gates"
            />
            <div className="space-y-1">
              <span className="block text-sm font-medium text-text">Traffic share</span>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="split-variant-a" className="text-xs text-text-muted sm:w-40">
                    Variant A (held back)
                  </label>
                  <Input
                    id="split-variant-a"
                    placeholder="Variant A label (Control)"
                    value={variantALabel}
                    onChange={(e) => setVariantALabel(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-text-muted bg-surface-active rounded-md text-center font-mono px-3 py-2 sm:w-20">
                    {100 - splitPct}%
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="split-variant-b" className="text-xs text-text-muted sm:w-40">
                    Variant B (rollout_percentage)
                  </label>
                  <Input
                    id="split-variant-b"
                    placeholder="Variant B label (Treatment)"
                    value={variantBLabel}
                    onChange={(e) => setVariantBLabel(e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <label htmlFor="split-pct" className="sr-only">
                      Treatment share percentage
                    </label>
                    <input
                      id="split-pct"
                      type="number"
                      min={0}
                      max={100}
                      className="w-20 bg-background border border-border rounded-md px-3 py-2 text-sm text-text font-mono"
                      value={splitPct}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSplitPct(isNaN(val) ? 0 : Math.max(0, Math.min(100, val)));
                      }}
                    />
                    <span className="text-xs text-text-muted font-mono" aria-hidden="true">
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleCreateAbTest} disabled={isCreatingTest}>
              {isCreatingTest ? 'Creating…' : 'Create Split Rollout'}
            </Button>
          </div>
        </Card>
      </TabPanel>

      <TabPanel id="session" activeTab={activeTab}>
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-1">This Session</h2>
          <p className="text-xs text-text-muted mb-4">
            Changes you have made in this browser session, newest first. There is no server-side
            feature-flag audit endpoint, so nothing is persisted: this list is lost on refresh and
            cannot be used as a compliance record.
          </p>
          {sessionLog.length === 0 ? (
            <EmptyState
              title="No changes this session"
              description="Toggle, create or delete a flag and the change will be listed here for as long as this tab stays open."
            />
          ) : (
            <ul className="space-y-2">
              {sessionLog.map((a, i) => (
                <li
                  key={`${a.flag}-${a.timestamp}-${i}`}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 text-sm text-text border-b border-border/50 last:border-b-0"
                >
                  <span className="font-mono text-primary truncate">{a.flag}</span>
                  <span className="text-text-muted truncate">{a.action}</span>
                  <span className="text-text-muted text-xs truncate">{a.timestamp}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </TabPanel>
    </div>
  );
}
