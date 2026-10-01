'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { request } from '@/lib/api';
import { Card, Badge, Button, EmptyState, ErrorState, Modal, StatCard } from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';

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
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [isRollingUp, setIsRollingUp] = useState(false);
  const [rollupModalOpen, setRollupModalOpen] = useState(false);
  const [targetRollupTier, setTargetRollupTier] = useState<
    'DAILY' | 'WEEKLY' | 'MONTHLY' | 'NORTH_STAR'
  >('WEEKLY');
  const [selectedNode, setSelectedNode] = useState<ScaleMemoryNode | null>(null);

  const queryTier = selectedTier === 'ALL' ? '' : `&tier=${selectedTier}`;
  const endpoint = workspaceId
    ? `/cognition/scale/nodes?workspace_id=${workspaceId}${queryTier}&limit=50`
    : null;

  const { data, error, mutate, isLoading } = useSWR<{ nodes: ScaleMemoryNode[]; total: number }>(
    endpoint,
    (url: string) => request<{ nodes: ScaleMemoryNode[]; total: number }>(url),
    { revalidateOnFocus: false },
  );

  const triggerRollup = async (tier: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'NORTH_STAR') => {
    try {
      setIsRollingUp(true);
      const now = new Date();
      const days = tier === 'DAILY' ? 1 : tier === 'WEEKLY' ? 7 : tier === 'MONTHLY' ? 30 : 365;
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
      setRollupModalOpen(false);
      toast({
        tone: 'success',
        title: `${tier.replace('_', ' ')} Rollup Synthesized`,
        detail: `Higher-level cognitive insights, frictions, and action commitments generated.`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Rollup Synthesis Failed',
        detail: err instanceof Error ? err.message : 'Could not execute cognitive rollup.',
      });
    } finally {
      setIsRollingUp(false);
    }
  };

  const nodes = data?.nodes ?? [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-display font-medium text-[var(--color-text-primary)]">
              PIOS SCALE Multiscale Temporal Hierarchy
            </h3>
            <Badge variant="primary" size="sm">
              Cognitive Synthesis
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Hierarchical temporal wavelength consolidation: Atomic inputs → Daily logs → Weekly
            rollups → Monthly milestones → Strategic North Star.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Tier Filter Pills */}
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
                  ? 'bg-[var(--color-brand-primary,#818cf8)] text-white shadow-sm'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]'
              }`}
            >
              {tier.label}
            </button>
          );
        })}
      </div>

      {/* Nodes List or Error / Loading / Empty */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] p-5"
            />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load SCALE memory nodes"
          message={
            error instanceof Error ? error.message : 'Could not contact cognitive memory engine.'
          }
          onRetry={() => void mutate()}
        />
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
                className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand-primary,#818cf8)] transition cursor-pointer shadow-sm rounded-xl"
                onClick={() => setSelectedNode(node)}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={tierMeta.variant} size="sm">
                    {node.tier}
                  </Badge>
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    {startDate} — {endDate}
                  </span>
                </div>

                <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug line-clamp-2">
                  {node.summary}
                </p>

                {node.keyInsights && node.keyInsights.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                      Key Insights ({node.keyInsights.length})
                    </span>
                    <ul className="space-y-0.5">
                      {node.keyInsights.slice(0, 2).map((insight, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1.5"
                        >
                          <span className="text-[var(--color-brand-primary,#818cf8)] font-bold">
                            •
                          </span>
                          <span className="truncate">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {node.actionCommitments && node.actionCommitments.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-[var(--color-border)]">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                      Action Commitments
                    </span>
                    <ul className="space-y-0.5">
                      {node.actionCommitments.slice(0, 2).map((action, idx) => (
                        <li key={idx} className="text-xs text-emerald-400 flex items-start gap-1.5">
                          <span>✓</span>
                          <span className="truncate">{action}</span>
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
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Select the temporal wavelength for agentic synthesis. Lower tiers will be consolidated
            into high-level strategic takeaways, friction analysis, and action items.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">
              Target Wavelength Tier
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['DAILY', 'WEEKLY', 'MONTHLY', 'NORTH_STAR'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTargetRollupTier(tier)}
                  className={`p-3 rounded-lg border text-xs font-medium text-left transition ${
                    targetRollupTier === tier
                      ? 'border-[var(--color-brand-primary,#818cf8)] bg-[var(--color-brand-primary,#818cf8)]/10 text-[var(--color-text-primary)] ring-1 ring-[var(--color-brand-primary,#818cf8)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  <p className="font-semibold text-sm">{tier.replace('_', ' ')}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {tier === 'DAILY'
                      ? 'Past 24 Hours'
                      : tier === 'WEEKLY'
                        ? 'Past 7 Days'
                        : tier === 'MONTHLY'
                          ? 'Past 30 Days'
                          : 'Strategic 1-Year Horizon'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
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

      {/* Node Inspector Modal */}
      {selectedNode && (
        <Modal
          isOpen={Boolean(selectedNode)}
          onClose={() => setSelectedNode(null)}
          title={`SCALE Node: ${selectedNode.tier} (${new Date(selectedNode.periodStart).toLocaleDateString()} — ${new Date(selectedNode.periodEnd).toLocaleDateString()})`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                {selectedNode.tier}
              </Badge>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">
                Created {new Date(selectedNode.createdAt).toLocaleString()}
              </span>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
                Executive Synthesis
              </h4>
              <p className="text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-subtle)] p-3 rounded-lg border border-[var(--color-border)] leading-relaxed">
                {selectedNode.summary}
              </p>
            </div>

            {selectedNode.keyInsights && selectedNode.keyInsights.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1.5">
                  Key Insights
                </h4>
                <ul className="space-y-1 bg-[var(--color-surface-subtle)] p-3 rounded-lg border border-[var(--color-border)]">
                  {selectedNode.keyInsights.map((insight, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[var(--color-text-secondary)] flex items-start gap-2"
                    >
                      <span className="text-[var(--color-brand-primary,#818cf8)] font-bold">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedNode.frictionPoints && selectedNode.frictionPoints.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                  Friction Points & Obstacles
                </h4>
                <ul className="space-y-1 bg-amber-500/5 p-3 rounded-lg border border-amber-500/30">
                  {selectedNode.frictionPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[var(--color-text-secondary)] flex items-start gap-2"
                    >
                      <span className="text-amber-400 font-bold">!</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedNode.actionCommitments && selectedNode.actionCommitments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                  Action Commitments
                </h4>
                <ul className="space-y-1 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/30">
                  {selectedNode.actionCommitments.map((action, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[var(--color-text-secondary)] flex items-start gap-2"
                    >
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[var(--color-border)]">
              <Button variant="secondary" onClick={() => setSelectedNode(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
