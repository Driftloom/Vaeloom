'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';

export interface ProactiveProposal {
  id: string;
  triggerType: string;
  title: string;
  summary: string;
  proposedAction: string;
  actionPayload: Record<string, any>;
  urgency: string;
  status: string;
  relevanceScore: number;
  scheduledFor?: string | null;
  dismissedReason?: string | null;
  createdAt: string;
}

interface AnticipationFeedProps {
  workspaceId: string;
}

export function AnticipationFeed({ workspaceId }: AnticipationFeedProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const endpoint = workspaceId
    ? `/anticipation/proposals?workspace_id=${workspaceId}&status=PENDING`
    : null;

  const { data, mutate, isLoading } = useSWR<{ proposals: ProactiveProposal[]; total: number }>(
    endpoint,
    () => api.anticipation.listProposals(workspaceId, 'PENDING'),
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );

  const proposals = data?.proposals || [];

  const handleScan = async () => {
    try {
      setIsScanning(true);
      setStatusMessage(null);
      const res = await api.anticipation.scan(workspaceId);
      await mutate();
      setStatusMessage(`Trajectory scan completed: ${res.total} active proposal(s) available.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Failed to trigger scan:', err);
      setStatusMessage('Scan failed to complete. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAccept = async (proposalId: string) => {
    try {
      setActionInProgress(proposalId);
      await api.anticipation.acceptProposal(workspaceId, proposalId);
      await mutate();
      setStatusMessage('Proposal accepted and delegated to agent execution.');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Failed to accept proposal:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDismiss = async (proposalId: string) => {
    try {
      setActionInProgress(proposalId);
      await api.anticipation.dismissProposal(
        workspaceId,
        proposalId,
        'Dismissed by user from dashboard',
      );
      await mutate();
    } catch (err) {
      console.error('Failed to dismiss proposal:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency.toUpperCase()) {
      case 'HIGH':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            HIGH URGENCY
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
            OPPORTUNITY
          </span>
        );
    }
  };

  const getTriggerLabel = (type: string) => {
    switch (type) {
      case 'UPCOMING_EVENT':
        return 'Calendar Trajectory';
      case 'APPLICATION_DEADLINE':
        return 'Career Follow-up';
      case 'COMMITMENT_GAP':
        return 'Memory Gap Nudge';
      default:
        return 'Proactive Anticipation';
    }
  };

  return (
    <div
      className="rounded-2xl border border-indigo-200/80 dark:border-indigo-950/70 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20 p-6 shadow-sm transition-all"
      data-testid="anticipation-feed"
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-indigo-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Proactive Anticipation Feed
              </h3>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300">
                PIOS DAEMON
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Autonomous horizon scanning, speculative brief preparation & trajectory guidance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className={isScanning ? 'animate-spin' : ''}>🔄</span>
            {isScanning ? 'Scanning Horizons...' : 'Scan Trajectories'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-4 text-xs font-medium px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40">
          {statusMessage}
        </div>
      )}

      {/* Content Section */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white/40 dark:bg-slate-900/40">
          <div className="text-2xl mb-2">✨</div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            All trajectories aligned
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            The anticipation daemon has scanned upcoming calendar events, job applications, and
            memory commitments. No pending interventions require action right now.
          </p>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
          >
            Trigger Real-Time Trajectory Scan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((prop) => {
            const inAction = actionInProgress === prop.id;
            return (
              <div
                key={prop.id}
                className="group relative rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-850 p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getUrgencyBadge(prop.urgency)}
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {getTriggerLabel(prop.triggerType)}
                    </span>
                    <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                      Score: {Math.round(prop.relevanceScore * 100)}%
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {prop.title}
                  </h4>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                    {prop.summary}
                  </p>

                  {prop.actionPayload && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Action:
                      </span>
                      <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-indigo-700 dark:text-indigo-300">
                        {prop.proposedAction}
                      </code>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleDismiss(prop.id)}
                    disabled={inAction}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleAccept(prop.id)}
                    disabled={inAction}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {inAction ? 'Activating...' : 'Accept & Dispatch'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
