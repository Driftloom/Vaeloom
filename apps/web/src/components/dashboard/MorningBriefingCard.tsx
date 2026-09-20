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
      <div className="rounded-xl border border-border bg-surface/50 p-6 backdrop-blur-sm animate-pulse">
        <div className="h-6 w-48 bg-surface-300 rounded mb-4" />
        <div className="h-20 bg-surface-200 rounded-xl mb-4 animate-pulse" />
        <div className="h-12 bg-surface-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center">
        <div className="text-sm font-medium text-text-secondary mb-3">
          No Morning Briefing compiled yet for today.
        </div>
        <button
          onClick={handleRunCycle}
          disabled={isRunningCycle}
          className="btn-primary inline-flex items-center gap-2"
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
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              PIOS Morning Briefing
            </span>
            <span className="text-xs text-text-muted">·</span>
            <span className="text-xs text-text-muted">{briefing.briefingDate}</span>
          </div>
          <h2 className="text-lg font-display font-medium text-text mt-1">
            Focus Architecture & Cognition Digest
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {cycleSuccessMessage && (
            <span className="text-xs text-success font-medium">{cycleSuccessMessage}</span>
          )}
          <button
            onClick={handleRunCycle}
            disabled={isRunningCycle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface-100 text-text hover:bg-surface-200 transition disabled:opacity-50"
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
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Top Priorities Today
              </span>
              <span className="text-xs text-primary font-medium">
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
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      checked
                        ? 'bg-surface-50 border-border text-text-muted line-through'
                        : 'bg-surface-100 border-border hover:border-border-strong text-text shadow-sm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-accent"
                    />
                    <span className="text-sm font-medium leading-snug">{priority}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Micro-Learning 30-Second Nudge */}
          {briefing.microLearning && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-warning text-sm">💡</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-warning">
                    30-Second Micro-Learning Nudge
                  </span>
                </div>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning">
                  {briefing.microLearning.estimatedReadSeconds}s read
                </span>
              </div>
              <h4 className="text-sm font-semibold text-text mb-1">
                {briefing.microLearning.title}
              </h4>
              <p className="text-xs text-text-secondary mb-2 leading-relaxed">
                {briefing.microLearning.concept}
              </p>
              <div className="text-xs font-medium text-warning bg-warning/15 p-2 rounded-lg border border-warning/30">
                <span className="font-bold">Takeaway:</span>{' '}
                {briefing.microLearning.actionableTakeaway}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Reality Gap Diagnostic & Friction */}
        <div className="space-y-4">
          {/* Reality Gap Score Meter */}
          <div className="rounded-xl border border-border bg-surface-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Reality Gap (Intent vs Action)
              </span>
              <span
                className={`text-2xs font-bold px-2 py-0.5 rounded-full uppercase ${
                  isHealthy
                    ? 'bg-success/20 text-success'
                    : isModerate
                      ? 'bg-warning/20 text-warning'
                      : 'bg-error/20 text-error'
                }`}
              >
                {isHealthy ? 'Aligned' : isModerate ? 'Calibration Needed' : 'Drift Alert'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-display font-semibold text-text">{alignmentPct}%</span>
              <span className="text-xs text-text-muted">Execution Follow-Through</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-surface-200 h-2 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHealthy ? 'bg-success' : isModerate ? 'bg-warning' : 'bg-error'
                }`}
                style={{ width: `${alignmentPct}%` }}
              />
            </div>

            <p className="text-xs text-text-secondary leading-relaxed mb-3">
              {briefing.realityGap?.frictionRecommendation}
            </p>

            {briefing.realityGap?.totalCommitments > 0 && (
              <div className="text-xs text-text-muted border-t border-border pt-2">
                Fulfilled {briefing.realityGap.fulfilledCount} of{' '}
                {briefing.realityGap.totalCommitments} stated commitments
              </div>
            )}
          </div>

          {/* Friction & Bottlenecks */}
          {(briefing.openFriction?.length > 0 || briefing.resolvedFriction?.length > 0) && (
            <div className="rounded-xl border border-border bg-surface-100 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                Friction Points & Conquered Blockers
              </span>
              <div className="space-y-1.5">
                {briefing.resolvedFriction?.slice(0, 2).map((res, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-success">
                    <span>✓</span>
                    <span className="truncate">{res}</span>
                  </div>
                ))}
                {briefing.openFriction?.slice(0, 2).map((fric, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-warning">
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
