'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { ScaleMemoryViewer } from '@/components/memory/ScaleMemoryViewer';

export default function MemoryScalePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center space-x-2 text-sm text-[var(--color-text-secondary)]"
      >
        <Link
          href={`/workspace/${workspaceId}/memory`}
          className="hover:text-[var(--color-text-primary)] transition-colors inline-flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Memory Second Brain
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text-primary)] font-medium">
          Multiscale Temporal Hierarchy
        </span>
      </nav>

      <PageHeader
        title="SCALE Multiscale Temporal Memory"
        description="Hierarchical cognitive synthesis that compresses atomic interactions into episodic summaries, semantic clusters, and high-level behavioral heuristics."
      />

      {/* Main SCALE Viewer Component */}
      <ScaleMemoryViewer workspaceId={workspaceId} />

      {/* Cognitive Architecture Details */}
      <Card className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
          Cognitive Abstraction Tiers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-[var(--color-surface-subtle)] rounded-lg border border-[var(--color-border)]">
            <div className="font-semibold text-[var(--color-text-primary)] mb-1">
              Level 0: Raw Perceptions
            </div>
            <div className="text-[var(--color-text-muted)]">
              Ephemeral tool calls, user chat inputs, and atomic workspace events.
            </div>
          </div>
          <div className="p-3 bg-[var(--color-surface-subtle)] rounded-lg border border-[var(--color-border)]">
            <div className="font-semibold text-[var(--color-text-primary)] mb-1">
              Level 1: Episodic Sessions
            </div>
            <div className="text-[var(--color-text-muted)]">
              Summarized goal-directed conversations and cohesive work tasks.
            </div>
          </div>
          <div className="p-3 bg-[var(--color-surface-subtle)] rounded-lg border border-[var(--color-border)]">
            <div className="font-semibold text-[var(--color-text-primary)] mb-1">
              Level 2: Semantic Topics
            </div>
            <div className="text-[var(--color-text-muted)]">
              Persistent conceptual knowledge, skills, and validated domain facts.
            </div>
          </div>
          <div className="p-3 bg-[var(--color-surface-subtle)] rounded-lg border border-[var(--color-border)]">
            <div className="font-semibold text-[var(--color-text-primary)] mb-1">
              Level 3: Strategic Principles
            </div>
            <div className="text-[var(--color-text-muted)]">
              Overarching user preferences, ethics, and career trajectory goals.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
