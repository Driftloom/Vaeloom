'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Card, Badge, Breadcrumb } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { DynamicGraphViewer } from '@/lib/dynamic-imports';
import {
  GRAPH_NODE_STYLES,
  GRAPH_NODE_TYPE_ORDER,
  GraphNodeShape,
  type GraphNodeType,
} from '@/components/memory/GraphViewer';

const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  entity: 'Entity',
  concept: 'Concept',
  document: 'Document / Vault Note',
  event: 'Event',
  topic: 'Topic',
  project: 'Project',
  person: 'Person',
  organization: 'Organization',
};

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
            {GRAPH_NODE_TYPE_ORDER.length} Node Types
          </Badge>
        }
      />

      {/* Main Full-Height Graph Workbench */}
      <div className="min-h-[700px] h-[75vh] bg-surface border border-border rounded-xl overflow-hidden relative shadow-sm">
        <DynamicGraphViewer workspaceId={workspaceId} />
      </div>

      {/* Node Taxonomy Legend — rendered from the same constant map the canvas
          uses, so shapes, dashes, and colours can never drift from the graph. */}
      <Card padding="md" className="p-5 border border-border rounded-xl bg-surface">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
            Semantic Node Taxonomy
          </h3>
          <Badge variant="mono" size="sm">
            Shape · Dash · Colour
          </Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          {GRAPH_NODE_TYPE_ORDER.map((type) => {
            const style = GRAPH_NODE_STYLES[type];
            return (
              <div key={type} className="flex items-center gap-1.5" data-legend-type={type}>
                <svg
                  width="14"
                  height="14"
                  viewBox="-9 -9 18 18"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <GraphNodeShape
                    shape={style.shape}
                    size={6}
                    fill={style.fill}
                    stroke={style.stroke}
                    dashed={style.dashed}
                    strokeWidth={1.5}
                  />
                </svg>
                <span className="text-text-secondary">{NODE_TYPE_LABELS[type]}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
