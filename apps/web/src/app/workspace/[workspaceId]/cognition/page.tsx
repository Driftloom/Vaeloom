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

export default function CognitionPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'briefing' | 'reality_gap' | 'scale'>('briefing');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [isTriggeringOvernight, setIsTriggeringOvernight] = useState<boolean>(false);
  const [isCreatingNode, setIsCreatingNode] = useState<boolean>(false);

  // New Node Form State
  const [newTitle, setNewTitle] = useState('');
  const [newTier, setNewTier] = useState('DAILY');
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
        title: 'Delete Failed',
        detail: err instanceof Error ? err.message : 'Could not delete node.',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                PIOS Cognition & SCALE Memory
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                5-Tier multiscale temporal memory, overnight background daemon, and reality gap
                auditing.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isTriggeringOvernight}
            onClick={handleTriggerOvernight}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isTriggeringOvernight ? (
              <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('briefing')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'briefing'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Morning Briefing
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reality_gap')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'reality_gap'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          Reality Gap Diagnostics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scale')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'scale'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          5-Tier Memory Hierarchy
        </button>
      </div>

      {/* Tab 1: Morning Briefing */}
      {activeTab === 'briefing' && (
        <div className="space-y-6">
          {briefingLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Synthesizing Morning Briefing...
            </div>
          ) : briefingError ? (
            <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Failed to load briefing: {briefingError.message || 'Error occurred.'}</span>
            </div>
          ) : briefing ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Briefing Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Headlines */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
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
                      className="w-5 h-5 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
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
                      className="w-4 h-4 text-rose-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
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
                        className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"
                      >
                        {risk}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No briefing found for today. Run the overnight daemon to synthesize one.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Reality Gap Diagnostics */}
      {activeTab === 'reality_gap' && (
        <div className="space-y-6">
          {gapLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Evaluating Reality Gap Traces...
            </div>
          ) : gapError ? (
            <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Failed to load reality gap analysis: {gapError.message}</span>
            </div>
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
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            gap.gapSeverity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400'
                              : gap.gapSeverity === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {gap.gapSeverity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {gap.observation}
                      </p>
                      <div className="text-[11px] font-mono text-muted-foreground/80 pt-1 border-t border-border/40">
                        Evidence: {gap.evidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Tab 3: SCALE Memory Nodes */}
      {activeTab === 'scale' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Filter Tier:</span>
              <select
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
              onClick={() => setIsCreatingNode(!isCreatingNode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors border border-border"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              onSubmit={handleCreateNode}
              className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-foreground">Create SCALE Memory Node</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Distributed System Refactoring Progress"
                    className="w-full rounded bg-background border border-border px-3 py-1.5 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Scale Tier</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
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
                <label className="text-xs text-muted-foreground block mb-1">Summary</label>
                <textarea
                  required
                  rows={3}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Key decisions, architectural milestones, and active learnings..."
                  className="w-full rounded bg-background border border-border p-2.5 text-xs text-foreground focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Save Node
                </button>
              </div>
            </form>
          )}

          {/* Nodes List */}
          {scaleLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading SCALE Memory Nodes...
            </div>
          ) : scaleError ? (
            <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              Failed to load SCALE nodes: {scaleError.message}
            </div>
          ) : scaleData && scaleData.nodes?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scaleData.nodes.map((node) => (
                <div
                  key={node.id}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {node.tier}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteNode(node.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete memory node"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
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
                  <div className="text-[10px] text-muted-foreground font-mono pt-2 border-t border-border/30">
                    {new Date(node.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No memory nodes recorded in this tier yet. Add a node or trigger overnight rollup.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
