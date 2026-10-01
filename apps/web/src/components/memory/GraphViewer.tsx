'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { knowledgeGraphApi } from '@/lib/api-client';
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@vaeloom/shared-types';
import { Badge, Button, Drawer, EmptyState, ErrorState } from '@vaeloom/ui-kit';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

function nodeColor(type: string): string {
  const m: Record<string, string> = {
    concept: '#8b5cf6',
    entity: '#06b6d4',
    document: '#f59e0b',
    topic: '#10b981',
    person: '#ec4899',
    organization: '#6366f1',
    event: '#f97316',
    project: '#3b82f6',
  };
  return m[type] ?? '#818cf8';
}

export function GraphViewer({ workspaceId }: { workspaceId: string }) {
  const [nodes, setNodes] = useState<KnowledgeGraphNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeGraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<KnowledgeGraphNode | null>(null);
  const [isListMode, setIsListMode] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const prefersReduced = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  const fetchGraph = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsListMode(mq.matches && nodes.length > 20);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [nodes.length]);

  const types = useMemo(() => Array.from(new Set(nodes.map((n) => n.type))), [nodes]);

  // Filtered nodes based on typeFilter
  const typeFilteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      return true;
    });
  }, [nodes, typeFilter]);

  // Set of node IDs that match the search query for highlighting
  const matchedNodeIds = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const set = new Set<string>();
    nodes.forEach((n) => {
      if (n.label.toLowerCase().includes(q) || (n.description ?? '').toLowerCase().includes(q)) {
        set.add(n.id);
      }
    });
    return set;
  }, [nodes, search]);

  const filteredNodes = typeFilteredNodes;

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));
  }, [edges, filteredNodes]);

  // Radial layout computation
  const layout = useMemo(() => {
    const n = filteredNodes.length;
    if (n === 0) return new Map<string, { x: number; y: number }>();
    const cx = 400;
    const cy = 260;
    const radius = Math.min(220, Math.max(120, n * 12));
    const map = new Map<string, { x: number; y: number }>();
    filteredNodes.forEach((node, i) => {
      if (n === 1) {
        map.set(node.id, { x: cx, y: cy });
      } else {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const jitter = (node.importance ?? 0.5) * 30;
        const r = radius + jitter;
        map.set(node.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
      }
    });
    return map;
  }, [filteredNodes]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Viewport culling for large graphs
  const visibleNodes = useMemo(() => {
    if (filteredNodes.length <= 80) return filteredNodes;
    return filteredNodes.filter((n) => {
      const p = layout.get(n.id);
      if (!p) return false;
      const sx = p.x * transform.k + transform.x;
      const sy = p.y * transform.k + transform.y;
      return sx > -120 && sx < 920 && sy > -120 && sy < 640;
    });
  }, [filteredNodes, layout, transform]);

  const visibleEdges = useMemo(() => {
    const visIds = new Set(visibleNodes.map((n) => n.id));
    return filteredEdges.filter((e) => visIds.has(e.sourceId) && visIds.has(e.targetId));
  }, [filteredEdges, visibleNodes]);

  // Mouse pan controls
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001 * (prefersReduced.current ? 0.5 : 1);
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setTransform((t) => {
          const nk = Math.min(3, Math.max(0.25, t.k + delta));
          return { ...t, k: nk };
        });
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Touch pan
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      last.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0]!.clientX - last.current.x;
    const dy = e.touches[0]!.clientY - last.current.y;
    last.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    });
  }, []);

  const onTouchEnd = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleZoomIn = useCallback(() => {
    setTransform((t) => ({ ...t, k: Math.min(3, t.k + 0.2) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((t) => ({ ...t, k: Math.max(0.25, t.k - 0.2) }));
  }, []);

  const resetView = useCallback(() => setTransform({ x: 0, y: 0, k: 1 }), []);

  const focusNodeInView = useCallback(
    (node: KnowledgeGraphNode) => {
      const p = layout.get(node.id);
      if (p) {
        const targetX = 400 - p.x;
        const targetY = 260 - p.y;
        setTransform({ x: targetX, y: targetY, k: 1.2 });
      }
    },
    [layout],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-8">
        <LoadingSpinner size="lg" text="Loading Knowledge Graph ontology..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorState title="Failed to load graph" message={error} onRetry={fetchGraph} />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="No memories in Knowledge Graph yet"
          description="Index vault notes or create memories to allow the AI Agent to build your multi-hop semantic graph."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Top Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Multi-Hop Knowledge Graph
            </h2>
            <Badge variant="mono" size="sm">
              {nodes.length} Nodes · {edges.length} Edges
            </Badge>
            {matchedNodeIds && (
              <Badge variant="primary" size="sm">
                {matchedNodeIds.size} Matched
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Drag to pan • Scroll to zoom • Click node to inspect relationships
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search with Highlighting */}
          <div className="relative">
            <input
              placeholder="Search & highlight nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] w-48 font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-1.5 text-xs text-[var(--color-text-primary)]"
          >
            <option value="all">All Types ({nodes.length})</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()} ({nodes.filter((n) => n.type === t).length})
              </option>
            ))}
          </select>

          {/* Zoom & Reset Buttons */}
          <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-0.5">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              className="px-2 py-1 text-xs font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              className="px-2 py-1 text-xs font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset View"
              className="px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded border-l border-[var(--color-border)]"
            >
              Reset
            </button>
          </div>

          {/* Mobile Switcher */}
          <button
            type="button"
            onClick={() => setIsListMode((v) => !v)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] md:hidden"
          >
            {isListMode ? 'Show Graph' : 'Show List'}
          </button>
        </div>
      </header>

      {/* Main Canvas / List View */}
      {isListMode ? (
        <div className="grid gap-2 overflow-y-auto max-h-[600px] p-2">
          {filteredNodes.map((node) => {
            const isMatch = !matchedNodeIds || matchedNodeIds.has(node.id);
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelected(node)}
                className={`p-3 rounded-lg text-left border transition ${
                  selected?.id === node.id
                    ? 'border-[var(--color-brand-primary,#818cf8)] ring-1 ring-[var(--color-brand-primary,#818cf8)] bg-[var(--color-surface-hover)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
                } ${!isMatch ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: nodeColor(node.type) }}
                  />
                  <Badge variant="mono" size="sm">
                    {node.type}
                  </Badge>
                  {node.importance != null && (
                    <span className="ml-auto text-xs text-[var(--color-text-muted)] font-mono">
                      Weight: {Math.round(node.importance * 100)}%
                    </span>
                  )}
                </div>
                <p className="font-medium text-sm text-[var(--color-text-primary)] mt-1.5">
                  {node.label}
                </p>
                {node.description && (
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
                    {node.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[550px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] touch-none overscroll-contain select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <svg
            viewBox="0 0 800 520"
            className="h-full w-full cursor-grab active:cursor-grabbing"
            role="img"
            aria-label="Knowledge graph ontology canvas"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="12"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-border-strong, #545464)" />
              </marker>
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
              {/* Edges */}
              {visibleEdges.map((edge) => {
                const s = layout.get(edge.sourceId);
                const t = layout.get(edge.targetId);
                if (!s || !t) return null;
                const isEdgeHighlighted =
                  selected?.id === edge.sourceId || selected?.id === edge.targetId;
                const isDimmed =
                  matchedNodeIds &&
                  (!matchedNodeIds.has(edge.sourceId) || !matchedNodeIds.has(edge.targetId));

                return (
                  <g key={edge.id} opacity={isDimmed ? 0.2 : isEdgeHighlighted ? 1 : 0.6}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={
                        isEdgeHighlighted
                          ? 'var(--color-brand-primary, #818cf8)'
                          : 'var(--color-border, #343440)'
                      }
                      strokeWidth={isEdgeHighlighted ? 2.5 : Math.max(1, (edge.weight ?? 1) * 1.5)}
                      markerEnd="url(#arrow)"
                    />
                    <text
                      x={(s.x + t.x) / 2}
                      y={(s.y + t.y) / 2 - 6}
                      textAnchor="middle"
                      className="fill-[var(--color-text-muted)] text-[9px] font-mono select-none"
                    >
                      {edge.relationship}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {visibleNodes.map((node) => {
                const p = layout.get(node.id)!;
                const isSelected = selected?.id === node.id;
                const isMatched = !matchedNodeIds || matchedNodeIds.has(node.id);
                const connected = visibleEdges.some(
                  (e) => e.sourceId === node.id || e.targetId === node.id,
                );

                const radius = isSelected ? 26 : connected ? 20 : 16;
                const strokeColor = isSelected
                  ? '#ffffff'
                  : isMatched && matchedNodeIds
                    ? 'var(--color-brand-primary, #818cf8)'
                    : 'transparent';

                return (
                  <g
                    key={node.id}
                    transform={`translate(${p.x} ${p.y})`}
                    onClick={() => setSelected(node)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={node.label}
                    opacity={!isMatched ? 0.25 : 1}
                    filter={isMatched && matchedNodeIds ? 'url(#glow)' : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelected(node);
                    }}
                  >
                    <circle
                      r={radius}
                      fill={nodeColor(node.type)}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : isMatched && matchedNodeIds ? 2.5 : 0}
                      className="transition-all duration-150"
                    />
                    <text
                      textAnchor="middle"
                      dy={isSelected ? 38 : 34}
                      className="fill-[var(--color-text-primary)] text-xs font-medium select-none pointer-events-none"
                      style={{ fontSize: 11 }}
                    >
                      {node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}
                    </text>
                    <text
                      textAnchor="middle"
                      dy={isSelected ? 50 : 46}
                      className="fill-[var(--color-text-muted)] text-[9px] font-mono uppercase select-none pointer-events-none"
                    >
                      {node.type}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Canvas Status Indicator (bottom-left) */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-sm px-3 py-1 text-xs text-[var(--color-text-secondary)] font-mono shadow-sm">
            <span>{Math.round(transform.k * 100)}% zoom</span>
            <span>•</span>
            <span>
              {visibleNodes.length} of {nodes.length} nodes
            </span>
          </div>
        </div>
      )}

      {/* Node Inspector Drawer */}
      <Drawer
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.label || 'Node Details'}
        description={
          selected ? `Knowledge Graph Entity • ID ${selected.id.slice(0, 8)}` : undefined
        }
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            {selected && (
              <Button variant="outline" size="sm" onClick={() => focusNodeInView(selected)}>
                Focus in Graph
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
              Close Inspector
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-5">
            {/* Header attributes */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="mono" size="sm">
                <span
                  className="w-2 h-2 rounded-full mr-1.5 inline-block"
                  style={{ background: nodeColor(selected.type) }}
                />
                {selected.type.toUpperCase()}
              </Badge>
              {selected.importance != null && (
                <Badge variant="primary" size="sm">
                  Relevance: {Math.round(selected.importance * 100)}%
                </Badge>
              )}
            </div>

            {/* Description */}
            {selected.description && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
                  Entity Description
                </h4>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-subtle)] p-3 rounded-lg border border-[var(--color-border)]">
                  {selected.description}
                </p>
              </div>
            )}

            {/* Connected Relationships */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">
                Connected Relationships
              </h4>
              {filteredEdges.filter((e) => e.sourceId === selected.id || e.targetId === selected.id)
                .length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] italic">
                  No relationships connected in this graph view.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {filteredEdges
                    .filter((e) => e.sourceId === selected.id || e.targetId === selected.id)
                    .map((e) => {
                      const isOutgoing = e.sourceId === selected.id;
                      const otherId = isOutgoing ? e.targetId : e.sourceId;
                      const otherNode = nodeMap.get(otherId);

                      return (
                        <div
                          key={e.id}
                          className="flex items-center justify-between p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[var(--color-brand-primary,#818cf8)] font-semibold shrink-0">
                              {isOutgoing ? '→' : '←'} {e.relationship}
                            </span>
                            <span className="text-[var(--color-text-primary)] font-medium truncate">
                              {otherNode?.label || otherId.slice(0, 8)}
                            </span>
                          </div>
                          {otherNode && (
                            <button
                              type="button"
                              onClick={() => setSelected(otherNode)}
                              className="text-[11px] text-[var(--color-brand-primary,#818cf8)] hover:underline shrink-0 ml-2"
                            >
                              Inspect
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Extended Metadata Properties */}
            {selected.properties && Object.keys(selected.properties).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">
                  Metadata & Properties
                </h4>
                <div className="space-y-1 font-mono text-xs bg-[var(--color-surface-subtle)] p-3 rounded-lg border border-[var(--color-border)]">
                  {Object.entries(selected.properties).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-2 border-b border-[var(--color-border)]/50 pb-1"
                    >
                      <span className="text-[var(--color-text-muted)] truncate">{k}</span>
                      <span className="text-[var(--color-text-primary)] font-medium truncate">
                        {typeof v === 'string' ? v : JSON.stringify(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
