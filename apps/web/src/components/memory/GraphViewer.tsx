'use client';

import React, { useState, useEffect } from 'react';
import { knowledgeGraphApi } from '@/lib/api-client';
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@vaeloom/shared-types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';

export function GraphViewer({ workspaceId }: { workspaceId: string }) {
  const [nodes, setNodes] = useState<KnowledgeGraphNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeGraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nodeRes, edgeRes] = await Promise.all([
        knowledgeGraphApi.listNodes(),
        knowledgeGraphApi.listAllEdges(),
      ]);
      setNodes(nodeRes.items);
      setEdges(edgeRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [workspaceId]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n.label]));

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Memory Graph</h1>
          <p className="text-text-muted">Explore the knowledge extracted from your documents.</p>
        </header>
        <LoadingSpinner size="lg" text="Loading memory graph..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Memory Graph</h1>
          <p className="text-text-muted">Explore the knowledge extracted from your documents.</p>
        </header>
        <ErrorState title="Failed to load" message={error} onRetry={fetchGraph} />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Memory Graph</h1>
          <p className="text-text-muted">Explore the knowledge extracted from your documents.</p>
        </header>
        <EmptyState
          title="No memories extracted yet"
          description="Upload documents to allow the Memory Agent to build your knowledge graph."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Memory Graph</h1>
        <p className="text-text-muted">Explore the knowledge extracted from your documents.</p>
      </header>

      <div className="flex gap-8">
        <div className="flex-1">
          <h2 className="text-xl font-display font-medium text-text mb-4">
            Nodes ({nodes.length})
          </h2>
          <div className="space-y-2">
            {nodes.map(node => (
              <div key={node.id} className="card border-primary/50 bg-surface/80 p-4">
                <div className="text-xs font-mono text-primary uppercase tracking-wider mb-1">{node.type}</div>
                <div className="text-lg text-text font-medium">{node.label}</div>
                {node.description && (
                  <p className="text-sm text-text-muted mt-1">{node.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-xl font-display font-medium text-text mb-4">
            Edges ({edges.length})
          </h2>
          {edges.length === 0 ? (
            <p className="text-text-muted text-sm">No relationships extracted yet.</p>
          ) : (
            <div className="space-y-2">
              {edges.map(edge => (
                <div key={edge.id} className="card border-accent/50 bg-surface/80 p-4 text-sm">
                  <span className="font-medium text-text">{nodeMap.get(edge.sourceId) ?? edge.sourceId.slice(0, 8)}</span>
                  <span className="mx-2 text-accent">—{edge.relationship}→</span>
                  <span className="font-medium text-text">{nodeMap.get(edge.targetId) ?? edge.targetId.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
