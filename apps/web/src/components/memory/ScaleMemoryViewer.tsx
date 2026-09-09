'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { request } from '@/lib/api';

export interface ScaleMemoryNode {
  id: string;
  userId: string;
  workspaceId: string;
  tier: 'SUB_DAILY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'NORTH_STAR';
  periodStart: string;
  periodEnd: string;
  summary: string;
  keyInsights: string[];
  frictionPoints: string[];
  unresolvedQuestions: string[];
  actionCommitments: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ScaleMemoryViewerProps {
  workspaceId: string;
}

const TIERS: Array<{ key: string; label: string; description: string; badgeColor: string }> = [
  {
    key: 'ALL',
    label: 'All Wavelengths',
    description: 'Full multiscale temporal hierarchy',
    badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    key: 'DAILY',
    label: 'Daily Logs',
    description: 'Nightly consolidated episodic summaries',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  },
  {
    key: 'WEEKLY',
    label: 'Weekly Rollups',
    description: '7-day synthesized skill & velocity trends',
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  },
  {
    key: 'MONTHLY',
    label: 'Monthly Milestones',
    description: '30-day strategic project & capability progress',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  },
  {
    key: 'NORTH_STAR',
    label: 'North Star',
    description: 'Core personal values & non-negotiable direction',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
];

export function ScaleMemoryViewer({ workspaceId }: ScaleMemoryViewerProps) {
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [isRollingUp, setIsRollingUp] = useState(false);
  const [rollupMessage, setRollupMessage] = useState<string | null>(null);

  const queryTier = selectedTier === 'ALL' ? '' : `&tier=${selectedTier}`;
  const endpoint = workspaceId
    ? `/cognition/scale/nodes?workspace_id=${workspaceId}${queryTier}&limit=50`
    : null;

  const { data, error, mutate, isLoading } = useSWR<{ nodes: ScaleMemoryNode[]; total: number }>(
    endpoint,
    (url: string) => request<{ nodes: ScaleMemoryNode[]; total: number }>(url),
    { revalidateOnFocus: false },
  );

  const handleRollupWeekly = async () => {
    try {
      setIsRollingUp(true);
      setRollupMessage(null);
      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await request('/cognition/scale/rollup', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          target_tier: 'WEEKLY',
          period_start: weekStart.toISOString(),
          period_end: now.toISOString(),
        }),
      });

      await mutate();
      setRollupMessage('Weekly rollup synthesized successfully!');
      setTimeout(() => setRollupMessage(null), 4000);
    } catch (err) {
      console.error('Failed to trigger weekly rollup:', err);
    } finally {
      setIsRollingUp(false);
    }
  };

  const nodes = data?.nodes ?? [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>PIOS SCALE Multiscale Temporal Hierarchy</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
              Pillar 2
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Temporal wavelength consolidation: Sub-daily stream → Daily logs → Weekly rollups →
            Strategic milestones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {rollupMessage && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {rollupMessage}
            </span>
          )}
          <button
            onClick={handleRollupWeekly}
            disabled={isRollingUp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 shadow-sm"
          >
            {isRollingUp ? <span className="animate-spin text-xs">⟳</span> : <span>📊</span>}
            {isRollingUp ? 'Synthesizing...' : 'Synthesize Weekly Rollup'}
          </button>
        </div>
      </div>

      {/* Wavelength Tier Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {TIERS.map((tier) => {
          const active = selectedTier === tier.key;
          return (
            <button
              key={tier.key}
              onClick={() => setSelectedTier(tier.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tier.label}
            </button>
          );
        })}
      </div>

      {/* Nodes List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-5" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 text-sm">
          Failed to load SCALE memory nodes.
        </div>
      ) : nodes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
          <div className="text-2xl mb-2">⏳</div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            No SCALE nodes recorded in this tier yet
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            SCALE memory consolidates automatically at 02:00 AM or on demand. Trigger a weekly
            rollup above to synthesize your recent memories.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((node) => {
            const tierMeta = TIERS.find((t) => t.key === node.tier) || TIERS[0]!;
            const startDate = new Date(node.periodStart).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const endDate = new Date(node.periodEnd).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={node.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/80 p-5 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tierMeta?.badgeColor || 'bg-slate-100 text-slate-800'}`}
                  >
                    {node.tier}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {startDate} → {endDate}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed mb-3">
                  {node.summary}
                </p>

                {/* Key Insights Chips */}
                {node.keyInsights?.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Key Insights
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {node.keyInsights.slice(0, 3).map((insight, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-900/30"
                        >
                          {insight}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Commitments */}
                {node.actionCommitments?.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Commitments & Follow-Through
                    </span>
                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      {node.actionCommitments.slice(0, 2).map((commit, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-indigo-500 mt-0.5">›</span>
                          <span className="truncate">{commit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
