'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Card, Badge, Breadcrumb } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { DynamicGraphViewer } from '@/lib/dynamic-imports';

export default function MemoryGraphWorkbenchPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const breadcrumbItems = [
    {
      label: 'Memory',
      href: `/workspace/${workspaceId}/memory`,
    },
    {
      label: 'Knowledge Graph Workbench',
      current: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      <PageHeader
        title="Knowledge Graph Workbench"
        description="Multi-hop semantic ontology connecting vault notes, cognitive memories, extracted skills, and verified entities."
        actions={
          <Badge variant="mono" size="sm">
            Semantic Graph Engine v2
          </Badge>
        }
      />

      {/* Main Full-Height Graph Workbench */}
      <div className="min-h-[700px] h-[75vh] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden relative shadow-sm">
        <DynamicGraphViewer workspaceId={workspaceId} />
      </div>

      {/* Conceptual Legend Card */}
      <Card
        padding="md"
        className="p-5 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            Semantic Node Taxonomy
          </h3>
          <Badge variant="mono" size="sm">
            Entity Types
          </Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#8b5cf6]" />
            <span className="text-[var(--color-text-secondary)]">Concept</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
            <span className="text-[var(--color-text-secondary)]">Document / Vault Note</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#06b6d4]" />
            <span className="text-[var(--color-text-secondary)]">Entity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#10b981]" />
            <span className="text-[var(--color-text-secondary)]">Topic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ec4899]" />
            <span className="text-[var(--color-text-secondary)]">Person</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#3b82f6]" />
            <span className="text-[var(--color-text-secondary)]">Project</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
