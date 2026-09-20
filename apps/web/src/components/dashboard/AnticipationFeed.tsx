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
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-error/20 text-error border border-error/30">
            HIGH URGENCY
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-info/20 text-info border border-info/30">
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
      className="rounded-xl border border-border bg-surface p-6 shadow-card transition-all"
      data-testid="anticipation-feed"
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-action text-action-fg font-medium shadow-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-display font-medium text-text">
                Proactive Anticipation Feed
              </h3>
              <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-md bg-primary/15 text-primary">
                PIOS DAEMON
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Autonomous horizon scanning, speculative brief preparation & trajectory guidance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <span className={isScanning ? 'animate-spin' : ''}>🔄</span>
            {isScanning ? 'Scanning Horizons...' : 'Scan Trajectories'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-4 text-xs font-medium px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
          {statusMessage}
        </div>
      )}

      {/* Content Section */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-surface-200 rounded-xl" />
          <div className="h-20 bg-surface-200 rounded-xl" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center bg-surface-100/50">
          <div className="text-2xl mb-2">✨</div>
          <h4 className="text-sm font-semibold text-text mb-1">All trajectories aligned</h4>
          <p className="text-xs text-text-muted max-w-md mx-auto mb-4">
            The anticipation daemon has scanned upcoming calendar events, job applications, and
            memory commitments. No pending interventions require action right now.
          </p>
          <button onClick={handleScan} disabled={isScanning} className="btn-primary text-xs">
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
                className="group relative rounded-xl border border-border bg-surface-100 p-4 shadow-sm hover:border-border-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getUrgencyBadge(prop.urgency)}
                    <span className="text-xs font-semibold text-text-muted">
                      {getTriggerLabel(prop.triggerType)}
                    </span>
                    <span className="text-2xs font-mono text-primary">
                      Score: {Math.round(prop.relevanceScore * 100)}%
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-text leading-tight">{prop.title}</h4>

                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                    {prop.summary}
                  </p>

                  {prop.actionPayload && (
                    <div className="text-xs text-text-muted flex items-center gap-2 pt-0.5">
                      <span className="font-semibold text-text-secondary">Action:</span>
                      <code className="bg-surface-200 px-1.5 py-0.5 rounded text-2xs text-primary font-mono">
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
                    className="btn-ghost text-xs px-3 py-1.5"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleAccept(prop.id)}
                    disabled={inAction}
                    className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
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
