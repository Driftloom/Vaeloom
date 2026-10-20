'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Card, Badge, Breadcrumb } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { ScaleMemoryViewer } from '@/components/memory/ScaleMemoryViewer';

export default function MemoryScalePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const breadcrumbItems = [
    {
      label: 'Memory',
      href: `/workspace/${workspaceId}/memory`,
    },
    {
      label: 'SCALE Temporal Hierarchy',
      current: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      <PageHeader
        title="SCALE Multiscale Temporal Memory"
        description="Hierarchical cognitive synthesis that compresses atomic interactions into episodic summaries, semantic clusters, and high-level behavioral heuristics."
        actions={
          <Badge variant="mono" size="sm">
            PIOS Multiscale Cognition
          </Badge>
        }
      />

      {/* Main SCALE Viewer Component */}
      <ScaleMemoryViewer workspaceId={workspaceId} />

      {/* Cognitive Architecture Details */}
      <Card padding="md" className="p-6 bg-surface border border-border rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
            Cognitive Abstraction Tiers
          </h3>
          <Badge variant="mono" size="sm">
            Sub-Daily → North Star
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-surface-100 rounded-lg border border-border space-y-1">
            <div className="font-semibold text-text">Level 0: Raw Perceptions</div>
            <div className="text-text-muted leading-relaxed">
              Ephemeral tool calls, user chat inputs, and atomic workspace events.
            </div>
          </div>
          <div className="p-3 bg-surface-100 rounded-lg border border-border space-y-1">
            <div className="font-semibold text-text">Level 1: Episodic Sessions</div>
            <div className="text-text-muted leading-relaxed">
              Summarized goal-directed conversations and cohesive work tasks.
            </div>
          </div>
          <div className="p-3 bg-surface-100 rounded-lg border border-border space-y-1">
            <div className="font-semibold text-text">Level 2: Semantic Topics</div>
            <div className="text-text-muted leading-relaxed">
              Persistent conceptual knowledge, skills, and validated domain facts.
            </div>
          </div>
          <div className="p-3 bg-surface-100 rounded-lg border border-border space-y-1">
            <div className="font-semibold text-text">Level 3: Strategic Principles</div>
            <div className="text-text-muted leading-relaxed">
              Overarching user preferences, ethics, and career trajectory goals.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
