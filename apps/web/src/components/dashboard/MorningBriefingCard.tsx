'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { request } from '@/lib/api';

export interface MicroLearningNudge {
  title: string;
  concept: string;
  actionableTakeaway: string;
  estimatedReadSeconds: number;
}

export interface CommitmentAudit {
  commitment: string;
  status: 'FULFILLED' | 'PARTIAL' | 'UNFULFILLED';
  evidence?: string;
}

export interface RealityGapAnalysis {
  alignmentScore: number;
  discrepancyScore: number;
  totalCommitments: number;
  fulfilledCount: number;
  commitments: CommitmentAudit[];
  behavioralInsights: string[];
  frictionRecommendation: string;
}

export interface MorningBriefing {
  briefingDate: string;
  topPriorities: string[];
  realityGap: RealityGapAnalysis;
  resolvedFriction: string[];
  openFriction: string[];
  microLearning: MicroLearningNudge;
  createdAt: string;
}

interface MorningBriefingCardProps {
  workspaceId: string;
}

export function MorningBriefingCard({ workspaceId }: MorningBriefingCardProps) {
  const [completedPriorities, setCompletedPriorities] = useState<Record<number, boolean>>({});
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [cycleSuccessMessage, setCycleSuccessMessage] = useState<string | null>(null);

  const endpoint = workspaceId ? `/cognition/briefing/today?workspace_id=${workspaceId}` : null;

  const {
    data: briefing,
    error,
    mutate,
    isLoading,
  } = useSWR<MorningBriefing>(endpoint, (url: string) => request<MorningBriefing>(url), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const togglePriority = (idx: number) => {
    setCompletedPriorities((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleRunCycle = async () => {
    try {
      setIsRunningCycle(true);
      setCycleSuccessMessage(null);
      await request('/cognition/overnight/run', {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      await mutate();
      setCycleSuccessMessage('Overnight cognition cycle completed & refreshed!');
      setTimeout(() => setCycleSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Failed to run overnight cycle:', err);
    } finally {
      setIsRunningCycle(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-6 backdrop-blur-sm animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4" />
        <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
          No Morning Briefing compiled yet for today.
        </div>
        <button
          onClick={handleRunCycle}
          disabled={isRunningCycle}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
        >
          {isRunningCycle ? 'Synthesizing...' : '⚡ Trigger Cognition Cycle'}
        </button>
      </div>
    );
  }

  const alignmentPct = Math.round((briefing.realityGap?.alignmentScore ?? 1.0) * 100);
  const isHealthy = alignmentPct >= 75;
  const isModerate = alignmentPct >= 50 && alignmentPct < 75;

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/30 p-6 shadow-sm backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              PIOS Morning Briefing
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {briefing.briefingDate}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            Focus Architecture & Cognition Digest
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {cycleSuccessMessage && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {cycleSuccessMessage}
            </span>
          )}
          <button
            onClick={handleRunCycle}
            disabled={isRunningCycle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 dark:border-indigo-800 bg-white/80 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
            title="Runs the 02:00 AM background cognition cycle on-demand"
          >
            {isRunningCycle ? <span className="animate-spin text-xs">⟳</span> : <span>⚡</span>}
            {isRunningCycle ? 'Synthesizing...' : 'Run Cognition Cycle'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
        {/* Left Column: 3 Top Priorities */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Top Priorities Today
              </span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                {Object.values(completedPriorities).filter(Boolean).length} of{' '}
                {briefing.topPriorities.length} checked
              </span>
            </div>

            <div className="space-y-2">
              {briefing.topPriorities.map((priority, idx) => {
                const checked = !!completedPriorities[idx];
                return (
                  <label
                    key={idx}
                    onClick={() => togglePriority(idx)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      checked
                        ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 line-through'
                        : 'bg-white/80 dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium leading-snug">{priority}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Micro-Learning 30-Second Nudge */}
          {briefing.microLearning && (
            <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-600 dark:text-amber-400 text-sm">💡</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    30-Second Micro-Learning Nudge
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                  {briefing.microLearning.estimatedReadSeconds}s read
                </span>
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {briefing.microLearning.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                {briefing.microLearning.concept}
              </p>
              <div className="text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-900/30 p-2 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                <span className="font-bold">Takeaway:</span>{' '}
                {briefing.microLearning.actionableTakeaway}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Reality Gap Diagnostic & Friction */}
        <div className="space-y-4">
          {/* Reality Gap Score Meter */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/90 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Reality Gap (Intent vs Action)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  isHealthy
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : isModerate
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {isHealthy ? 'Aligned' : isModerate ? 'Calibration Needed' : 'Drift Alert'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {alignmentPct}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Execution Follow-Through
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHealthy ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${alignmentPct}%` }}
              />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              {briefing.realityGap?.frictionRecommendation}
            </p>

            {briefing.realityGap?.totalCommitments > 0 && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/60 pt-2">
                Fulfilled {briefing.realityGap.fulfilledCount} of{' '}
                {briefing.realityGap.totalCommitments} stated commitments
              </div>
            )}
          </div>

          {/* Friction & Bottlenecks */}
          {(briefing.openFriction?.length > 0 || briefing.resolvedFriction?.length > 0) && (
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/90 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                Friction Points & Conquered Blockers
              </span>
              <div className="space-y-1.5">
                {briefing.resolvedFriction?.slice(0, 2).map((res, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"
                  >
                    <span>✓</span>
                    <span className="truncate">{res}</span>
                  </div>
                ))}
                {briefing.openFriction?.slice(0, 2).map((fric, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
                  >
                    <span>⚠</span>
                    <span className="truncate">{fric}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
