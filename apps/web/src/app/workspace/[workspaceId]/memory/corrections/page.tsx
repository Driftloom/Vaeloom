'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { MemoryCorrectionPanel } from '@/components/memory/MemoryCorrectionPanel';

export default function MemoryCorrectionsPage() {
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
        <span className="text-[var(--color-text-primary)] font-medium">Corrections & Lineage</span>
      </nav>

      <PageHeader
        title="Memory Corrections & Supersessions"
        description="Audit human corrections, inspect side-by-side diffs against previous beliefs, and trace immutable cognitive lineage."
      />

      {/* Main Memory Correction & Supersession Panel */}
      <MemoryCorrectionPanel />

      {/* Governance & Provenance Rules */}
      <Card className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            Zero-Trust Memory Immutability Guarantees
          </h3>
          <Badge variant="mono">CONT-P12-R06 Spec</Badge>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          When an agent belief or user fact is amended, previous memories are marked as{' '}
          <code>SUPERSEDED</code> with pointers to their successors rather than being overwritten.
          This ensures complete temporal provenance, verifiable audits, and mathematical safety
          against hallucinated drift.
        </p>
      </Card>
    </div>
  );
}
