'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { request } from '@/lib/api';
import { Card, Badge, Button, EmptyState, Modal, Select } from '@vaeloom/ui-kit';

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

const TIERS: Array<{
  key: string;
  label: string;
  description: string;
  variant: 'default' | 'primary' | 'warning' | 'info' | 'success' | 'mono';
}> = [
  {
    key: 'ALL',
    label: 'All Wavelengths',
    description: 'Full multiscale temporal hierarchy',
    variant: 'default',
  },
  {
    key: 'DAILY',
    label: 'Daily Logs',
    description: 'Nightly consolidated episodic summaries',
    variant: 'info',
  },
  {
    key: 'WEEKLY',
    label: 'Weekly Rollups',
    description: '7-day synthesized skill & velocity trends',
    variant: 'primary',
  },
  {
    key: 'MONTHLY',
    label: 'Monthly Milestones',
    description: '30-day strategic project & capability progress',
    variant: 'warning',
  },
  {
    key: 'NORTH_STAR',
    label: 'North Star',
    description: 'Core personal values & non-negotiable direction',
    variant: 'success',
  },
];

export function ScaleMemoryViewer({ workspaceId }: ScaleMemoryViewerProps) {
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [isRollingUp, setIsRollingUp] = useState(false);
  const [rollupModalOpen, setRollupModalOpen] = useState(false);
  const [targetRollupTier, setTargetRollupTier] = useState<'WEEKLY' | 'MONTHLY' | 'NORTH_STAR'>(
    'WEEKLY',
  );
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

  const triggerRollup = async (tier: 'WEEKLY' | 'MONTHLY' | 'NORTH_STAR') => {
    try {
      setIsRollingUp(true);
      setRollupMessage(null);
      const now = new Date();
      const days = tier === 'WEEKLY' ? 7 : tier === 'MONTHLY' ? 30 : 365;
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      await request('/cognition/scale/rollup', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          target_tier: tier,
          period_start: start.toISOString(),
          period_end: now.toISOString(),
        }),
      });

      await mutate();
      setRollupMessage(`${tier.replace('_', ' ')} rollup synthesized successfully.`);
      setRollupModalOpen(false);
      setTimeout(() => setRollupMessage(null), 4000);
    } catch (err) {
      console.error('Failed to trigger rollup:', err);
    } finally {
      setIsRollingUp(false);
    }
  };

  const nodes = data?.nodes ?? [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-display font-medium text-text">
              PIOS SCALE Temporal Hierarchy
            </h3>
            <Badge variant="primary" size="sm">
              Multiscale Cognition
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Temporal wavelength consolidation: Sub-daily stream → Daily logs → Weekly rollups →
            Strategic milestones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {rollupMessage && (
            <span className="text-xs text-success font-medium">{rollupMessage}</span>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={isRollingUp}
            onClick={() => setRollupModalOpen(true)}
          >
            Synthesize Rollup
          </Button>
        </div>
      </div>

      {/* Wavelength Tier Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {TIERS.map((tier) => {
          const active = selectedTier === tier.key;
          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => setSelectedTier(tier.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                active
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'bg-surface-200 text-text-muted hover:bg-surface-hover hover:text-text'
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
            <div key={i} className="h-44 rounded-xl bg-surface-hover p-5" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl border border-dashed border-border text-text-muted text-sm">
          Failed to load SCALE memory nodes.
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState
          title="No SCALE nodes recorded in this tier yet"
          description="SCALE memory consolidates automatically nightly or on demand. Trigger a rollup above to synthesize your recent memories into high-level insights."
          action={{
            label: 'Synthesize Weekly Rollup',
            onClick: () => void triggerRollup('WEEKLY'),
          }}
        />
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
              <Card
                key={node.id}
                padding="md"
                className="space-y-3 border-border bg-surface hover:border-border-strong transition shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={tierMeta.variant} size="sm">
                    {node.tier}
                  </Badge>
                  <span className="text-2xs font-mono text-text-dim">
                    {startDate} — {endDate}
                  </span>
                </div>

                <p className="text-sm font-medium text-text leading-snug">{node.summary}</p>

                {node.keyInsights && node.keyInsights.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
                      Key Insights
                    </span>
                    <ul className="space-y-0.5">
                      {node.keyInsights.map((insight, idx) => (
                        <li key={idx} className="text-xs text-text-muted flex items-start gap-1.5">
                          <span className="text-primary">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {node.actionCommitments && node.actionCommitments.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border">
                    <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
                      Action Commitments
                    </span>
                    <ul className="space-y-0.5">
                      {node.actionCommitments.map((action, idx) => (
                        <li key={idx} className="text-xs text-success flex items-start gap-1.5">
                          <span>✓</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Synthesis Rollup Modal */}
      <Modal
        isOpen={rollupModalOpen}
        onClose={() => setRollupModalOpen(false)}
        title="Synthesize Multiscale Memory Rollup"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted leading-relaxed">
            Select the temporal wavelength for agentic synthesis. Lower tiers will be consolidated
            into high-level strategic takeaways, friction analysis, and action items.
          </p>

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5">
              Target Wavelength Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['WEEKLY', 'MONTHLY', 'NORTH_STAR'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTargetRollupTier(tier)}
                  className={`p-3 rounded-lg border text-xs font-medium text-center transition ${
                    targetRollupTier === tier
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface-200 text-text-muted hover:border-border-strong'
                  }`}
                >
                  <p className="font-semibold">{tier.replace('_', ' ')}</p>
                  <p className="text-2xs text-text-dim mt-0.5">
                    {tier === 'WEEKLY' ? '7 days' : tier === 'MONTHLY' ? '30 days' : '1 year'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setRollupModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isRollingUp}
              onClick={() => void triggerRollup(targetRollupTier)}
            >
              Start Synthesis
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
