'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  cognitionApi,
  type ScaleMemoryNode,
  type MorningBriefing,
  type RealityGapAnalysis,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Tabs, TabPanel } from '@/components/shared/Tabs';

type ScaleTier = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'NORTH_STAR';

export default function CognitionPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'briefing' | 'reality_gap' | 'scale'>('briefing');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [isTriggeringOvernight, setIsTriggeringOvernight] = useState<boolean>(false);
  const [isCreatingNode, setIsCreatingNode] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = useState<string>('');

  // New Node Form State
  const [newTitle, setNewTitle] = useState('');
  const [newTier, setNewTier] = useState<ScaleTier>('DAILY');
  const [newSummary, setNewSummary] = useState('');

  // 1. Morning Briefing SWR
  const {
    data: briefing,
    error: briefingError,
    isLoading: briefingLoading,
    mutate: mutateBriefing,
  } = useSWR<MorningBriefing>(
    workspaceId ? `cognition-briefing-${workspaceId}` : null,
    () => cognitionApi.getTodayBriefing(workspaceId!),
    { revalidateOnFocus: false },
  );

  // 2. Reality Gap SWR
  const {
    data: realityGap,
    error: gapError,
    isLoading: gapLoading,
  } = useSWR<RealityGapAnalysis>(
    workspaceId && activeTab === 'reality_gap' ? `cognition-gap-${workspaceId}` : null,
    () => cognitionApi.getRealityGap(workspaceId!),
    { revalidateOnFocus: false },
  );

  // 3. SCALE Memory Nodes SWR
  const {
    data: scaleData,
    error: scaleError,
    isLoading: scaleLoading,
    mutate: mutateScale,
  } = useSWR<{ nodes: ScaleMemoryNode[]; total: number }>(
    workspaceId && activeTab === 'scale' ? `cognition-scale-${workspaceId}-${selectedTier}` : null,
    () =>
      cognitionApi.listScaleNodes(workspaceId!, {
        tier: selectedTier === 'ALL' ? undefined : selectedTier,
      }),
    { revalidateOnFocus: false },
  );

  const handleTriggerOvernight = async () => {
    if (!workspaceId) return;
    setIsTriggeringOvernight(true);
    try {
      const res = await cognitionApi.triggerOvernight(workspaceId);
      await mutateBriefing(res, false);
      toast({
        tone: 'success',
        title: 'Overnight Cycle Completed',
        detail: 'Synthesized fresh morning briefing from temporal memory traces.',
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Cycle Failed',
        detail: err instanceof Error ? err.message : 'Overnight daemon execution failed.',
      });
    } finally {
      setIsTriggeringOvernight(false);
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !newTitle.trim() || !newSummary.trim()) return;

    try {
      await cognitionApi.createScaleNode(workspaceId, {
        tier: newTier,
        title: newTitle.trim(),
        summary: newSummary.trim(),
      });
      toast({ tone: 'success', title: 'Memory Node Registered' });
      setNewTitle('');
      setNewSummary('');
      setIsCreatingNode(false);
      await mutateScale();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Creation Failed',
        detail: err instanceof Error ? err.message : 'Could not save memory node.',
      });
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!workspaceId) return;
    try {
      await cognitionApi.deleteScaleNode(workspaceId, nodeId);
      toast({ tone: 'success', title: 'Node Deleted' });
      await mutateScale();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Could not delete node.',
      });
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Temporal Memory"
        title="PIOS Cognition & SCALE Memory"
        description="5-Tier multiscale temporal memory, overnight background daemon, and reality gap auditing."
        actions={
          <button
            type="button"
            disabled={isTriggeringOvernight}
            onClick={handleTriggerOvernight}
            className="btn-primary text-xs"
          >
            {isTriggeringOvernight ? (
              <span
                aria-hidden="true"
                className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"
              />
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
            Run Overnight Daemon
          </button>
        }
      />

      <Tabs
        tabs={[
          { id: 'briefing', label: 'Morning Briefing' },
          { id: 'reality_gap', label: 'Reality Gap Diagnostics' },
          { id: 'scale', label: '5-Tier Memory Hierarchy' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

      {/* Tab 1: Morning Briefing */}
      <TabPanel id="briefing" activeTab={activeTab}>
        <div className="space-y-6">
          {briefingLoading ? (
            <LoadingSpinner text="Synthesizing Morning Briefing..." />
          ) : briefingError ? (
            <ErrorState
              title="Failed to load morning briefing"
              message={briefingError.message || 'The briefing service returned an error.'}
              onRetry={() => {
                void mutateBriefing();
              }}
            />
          ) : briefing ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Briefing Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Headlines */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-warning"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      Today&apos;s Strategic Headlines
                    </h2>
                    <span className="text-xs text-muted-foreground font-mono">{briefing.date}</span>
                  </div>
                  <ul className="space-y-2">
                    {briefing.headlines?.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                        <svg
                          className="w-4 h-4 text-primary mt-0.5 shrink-0"
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
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Key Accomplishments */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-ai-verified"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Recent Accomplishments
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {briefing.keyAccomplishments?.map((acc, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-secondary/40 border border-border/60 text-xs text-muted-foreground"
                      >
                        {acc}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Priorities & Blockers Sidebar */}
              <div className="space-y-6">
                {/* Recommended Priorities */}
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                    Recommended Priorities
                  </h3>
                  <div className="space-y-2">
                    {briefing.recommendedPriorities?.map((p, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs font-medium text-foreground"
                      >
                        {i + 1}. {p}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blockers & Risks */}
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-ai-blocked"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    Detected Blockers & Risks
                  </h3>
                  <div className="space-y-2">
                    {briefing.blockersAndRisks?.map((risk, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-ai-blocked/10 border border-ai-blocked/20 text-xs text-ai-blocked"
                      >
                        {risk}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No briefing found for today"
              description="The briefing endpoint returned no briefing for this workspace. Run the overnight daemon to synthesize one."
            />
          )}
        </div>
      </TabPanel>

      {/* Tab 2: Reality Gap Diagnostics */}
      <TabPanel id="reality_gap" activeTab={activeTab}>
        <div className="space-y-6">
          {gapLoading ? (
            <LoadingSpinner text="Evaluating Reality Gap Traces..." />
          ) : gapError ? (
            <ErrorState
              title="Failed to load reality gap analysis"
              message={gapError.message || 'The reality gap service returned an error.'}
            />
          ) : realityGap ? (
            <div className="space-y-6">
              {/* Scorecard */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Alignment Score: {realityGap.overallScore}/100
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Measures divergence between declared user commitments and actual agent action
                    traces.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Analyzed: {new Date(realityGap.analyzedAt).toLocaleDateString()}
                </div>
              </div>

              {/* Gaps List */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Identified Discrepancies</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {realityGap.gaps?.map((gap, i) => (
                    <div
                      key={i}
                      className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {gap.commitment}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            gap.gapSeverity === 'CRITICAL'
                              ? 'bg-ai-blocked/20 text-ai-blocked'
                              : gap.gapSeverity === 'HIGH'
                                ? 'bg-warning/20 text-warning'
                                : 'bg-info/20 text-info'
                          }`}
                        >
                          {gap.gapSeverity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {gap.observation}
                      </p>
                      <div className="text-xs font-mono text-muted-foreground/80 pt-1 border-t border-border/40">
                        Evidence: {gap.evidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No reality gap analysis reported"
              description="The analysis endpoint returned no result. This is not evidence that commitments and actions are aligned — no analysis was performed."
            />
          )}
        </div>
      </TabPanel>

      {/* Tab 3: SCALE Memory Nodes */}
      <TabPanel id="scale" activeTab={activeTab}>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label
                htmlFor="scale-tier-filter"
                className="text-xs text-muted-foreground font-medium"
              >
                Filter Tier:
              </label>
              <select
                id="scale-tier-filter"
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="bg-background border border-border rounded px-2.5 py-1 text-xs text-foreground focus:outline-none"
              >
                <option value="ALL">All Tiers</option>
                <option value="SUB_DAILY">Sub-Daily (Intra-day)</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
                <option value="NORTH_STAR">North Star</option>
              </select>
            </div>

            <button
              type="button"
              aria-expanded={isCreatingNode}
              aria-controls="scale-node-form"
              onClick={() => setIsCreatingNode(!isCreatingNode)}
              className="btn-secondary text-xs"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {isCreatingNode ? 'Cancel' : 'Add Memory Node'}
            </button>
          </div>

          {/* New Node Inline Form */}
          {isCreatingNode && (
            <form
              id="scale-node-form"
              onSubmit={handleCreateNode}
              className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-foreground">Create SCALE Memory Node</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="scale-node-title"
                    className="text-xs text-muted-foreground block mb-1"
                  >
                    Title
                  </label>
                  <input
                    id="scale-node-title"
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Distributed System Refactoring Progress"
                    className="w-full rounded bg-background border border-border px-3 py-1.5 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="scale-node-tier"
                    className="text-xs text-muted-foreground block mb-1"
                  >
                    Scale Tier
                  </label>
                  <select
                    id="scale-node-tier"
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as ScaleTier)}
                    className="w-full rounded bg-background border border-border px-3 py-1.5 text-xs text-foreground focus:outline-none"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="NORTH_STAR">North Star</option>
                  </select>
                </div>
              </div>
              <div>
                <label
                  htmlFor="scale-node-summary"
                  className="text-xs text-muted-foreground block mb-1"
                >
                  Summary
                </label>
                <textarea
                  id="scale-node-summary"
                  required
                  rows={3}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Key decisions, architectural milestones, and active learnings..."
                  className="w-full rounded bg-background border border-border p-2.5 text-xs text-foreground focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="submit" className="btn-primary text-xs">
                  Save Node
                </button>
              </div>
            </form>
          )}

          {/* Nodes List */}
          {scaleLoading ? (
            <LoadingSpinner text="Loading SCALE Memory Nodes..." />
          ) : scaleError ? (
            <ErrorState
              title="Failed to load SCALE nodes"
              message={scaleError.message || 'The memory service returned an error.'}
              onRetry={() => {
                void mutateScale();
              }}
            />
          ) : scaleData && scaleData.nodes?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scaleData.nodes.map((node) => (
                <div
                  key={node.id}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {node.tier}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDeleteId(node.id);
                          setPendingDeleteTitle(node.title);
                        }}
                        className="text-muted-foreground hover:text-error transition-colors p-1"
                        title="Delete memory node"
                        aria-label={`Delete memory node: ${node.title}`}
                        aria-haspopup="dialog"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                    <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                      {node.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-4">
                      {node.summary}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono pt-2 border-t border-border/30">
                    {new Date(node.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No memory nodes recorded in this tier. Add a node or trigger overnight rollup.
            </div>
          )}
        </div>
      </TabPanel>

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) return handleDeleteNode(pendingDeleteId);
        }}
        title="Delete memory node"
        message={`Permanently delete "${pendingDeleteTitle}"? This cannot be undone and the node is removed from the SCALE hierarchy.`}
        confirmLabel="Delete node"
        variant="danger"
      />
    </div>
  );
}
