'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Card, Badge, Breadcrumb } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { MemoryCorrectionPanel } from '@/components/memory/MemoryCorrectionPanel';

export default function MemoryCorrectionsPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const breadcrumbItems = [
    {
      label: 'Second Brain',
      href: `/workspace/${workspaceId}/memory`,
    },
    {
      label: 'Corrections & Lineage',
      current: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      <PageHeader
        title="Memory Corrections & Supersessions"
        description="Audit human corrections, inspect side-by-side diffs against previous beliefs, and trace immutable cognitive lineage."
        actions={
          <Badge variant="mono" size="sm">
            CONT-P12-R06 Spec
          </Badge>
        }
      />

      {/* Main Memory Correction & Supersession Panel */}
      <MemoryCorrectionPanel />

      {/* Governance & Provenance Rules */}
      <Card
        padding="md"
        className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            Zero-Trust Memory Immutability Guarantees
          </h3>
          <Badge variant="mono" size="sm">
            Zero Data Loss
          </Badge>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          When an agent belief or user fact is amended, previous memories are marked as{' '}
          <code className="font-mono text-[var(--color-text-primary)]">SUPERSEDED</code> with
          immutable pointers to their successors rather than being overwritten. This ensures
          complete temporal provenance, verifiable audits, and mathematical safety against
          hallucinated drift.
        </p>
      </Card>
    </div>
  );
}
