'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { knowledgeGraphApi } from '@/lib/api-client';
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@vaeloom/shared-types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';

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
  return m[type] ?? '#6b7280';
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

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.label.toLowerCase().includes(q) && !(n.description ?? '').toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [nodes, typeFilter, search]);

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));
  }, [edges, filteredNodes]);

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

  // Odissian polish: viewport culling for large graphs (>80 nodes) + label declutter
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
  const onWheel = useCallback((e: React.WheelEvent) => {
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
  }, []);
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

  const resetView = useCallback(() => setTransform({ x: 0, y: 0, k: 1 }), []);

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
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-1">Memory Graph</h1>
          <p className="text-text-muted text-sm">
            {filteredNodes.length} of {nodes.length} nodes · {filteredEdges.length} edges · drag to
            pan · scroll to zoom
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Filter nodes…"
            aria-label="Filter graph nodes by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary w-40"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter graph nodes by type"
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={resetView}
            className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface-hover"
          >
            Reset view
          </button>
          <button
            onClick={() => setIsListMode((v) => !v)}
            className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface-hover md:hidden"
          >
            {isListMode ? 'Show graph' : 'Show list'}
          </button>
        </div>
      </header>

      {isListMode ? (
        <div className="grid gap-2">
          {filteredNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelected(node)}
              className={`card text-left p-4 hover:border-primary/30 ${selected?.id === node.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: nodeColor(node.type) }}
                />
                <span className="text-xs font-mono uppercase tracking-wider text-text-dim">
                  {node.type}
                </span>
                {node.importance != null && (
                  <span className="ml-auto text-xs text-text-dim">
                    {Math.round(node.importance * 100)}%
                  </span>
                )}
              </div>
              <p className="font-medium text-text mt-1">{node.label}</p>
              {node.description && (
                <p className="text-sm text-text-muted line-clamp-2">{node.description}</p>
              )}
            </button>
          ))}
          {filteredNodes.length === 0 && (
            <p className="text-sm text-text-muted">No nodes match the filter.</p>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border border-border bg-surface/50"
          style={{ height: 'min(65vh, 560px)' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <svg
            viewBox="0 0 800 520"
            className="h-full w-full cursor-grab active:cursor-grabbing"
            role="img"
            aria-label="Knowledge graph"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-border" />
              </marker>
            </defs>
            <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
              {visibleEdges.map((edge) => {
                const s = layout.get(edge.sourceId);
                const t = layout.get(edge.targetId);
                if (!s || !t) return null;
                const showLabel = !(filteredNodes.length > 60 && transform.k < 0.7);
                return (
                  <g key={edge.id}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="currentColor"
                      className="text-border"
                      strokeWidth={Math.max(1, (edge.weight ?? 1) * 1.5)}
                      opacity={0.6}
                      markerEnd="url(#arrow)"
                    />
                    {showLabel && (
                      <text
                        x={(s.x + t.x) / 2}
                        y={(s.y + t.y) / 2 - 6}
                        textAnchor="middle"
                        className="fill-text-dim text-[9px] font-mono"
                      >
                        {edge.relationship}
                      </text>
                    )}
                  </g>
                );
              })}
              {visibleNodes.map((node) => {
                const p = layout.get(node.id)!;
                const isSelected = selected?.id === node.id;
                const connected = visibleEdges.some(
                  (e) => e.sourceId === node.id || e.targetId === node.id,
                );
                return (
                  <g
                    key={node.id}
                    transform={`translate(${p.x} ${p.y})`}
                    onClick={() => setSelected(node)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={node.label}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelected(node);
                    }}
                  >
                    <circle
                      r={isSelected ? 28 : connected ? 22 : 18}
                      fill={nodeColor(node.type)}
                      opacity={isSelected ? 1 : 0.9}
                      stroke={isSelected ? 'white' : 'transparent'}
                      strokeWidth={isSelected ? 2 : 0}
                      className="drop-shadow-sm"
                    />
                    <text
                      textAnchor="middle"
                      dy={isSelected ? 42 : 36}
                      className="fill-text text-xs font-medium"
                      style={{ fontSize: 11 }}
                    >
                      {node.label.length > 18 ? `${node.label.slice(0, 18)}…` : node.label}
                    </text>
                    <text
                      textAnchor="middle"
                      dy={isSelected ? 54 : 48}
                      className="fill-text-dim text-[10px] font-mono uppercase"
                    >
                      {node.type}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-xs text-text-dim">
            <span>{Math.round(transform.k * 100)}%</span>
            <span>·</span>
            <span>
              {visibleNodes.length === filteredNodes.length
                ? `${filteredNodes.length} nodes`
                : `${visibleNodes.length}/${filteredNodes.length} visible`}
            </span>
          </div>
        </div>
      )}

      {selected && (
        <div className="card mt-4 border-primary/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: nodeColor(selected.type) }}
                />
                <span className="text-xs font-mono uppercase tracking-wider text-text-dim">
                  {selected.type}
                </span>
                <span className="text-xs text-text-dim">
                  · importance {Math.round((selected.importance ?? 0) * 100)}%
                </span>
              </div>
              <h3 className="text-lg font-medium text-text mt-1">{selected.label}</h3>
              {selected.description && (
                <p className="text-sm text-text-muted mt-1">{selected.description}</p>
              )}
              {Object.keys(selected.properties ?? {}).length > 0 && (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-surface-hover p-2 font-mono text-xs text-text-muted">
                  {JSON.stringify(selected.properties, null, 2)}
                </pre>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {filteredEdges
                  .filter((e) => e.sourceId === selected.id || e.targetId === selected.id)
                  .slice(0, 6)
                  .map((e) => {
                    const otherId = e.sourceId === selected.id ? e.targetId : e.sourceId;
                    const other = nodeMap.get(otherId);
                    const dir = e.sourceId === selected.id ? '→' : '←';
                    return (
                      <span
                        key={e.id}
                        className="rounded-full border border-border bg-surface px-2 py-1 text-xs"
                      >
                        {dir} {e.relationship} {dir} {other?.label ?? otherId.slice(0, 8)}
                      </span>
                    );
                  })}
                {filteredEdges.filter(
                  (e) => e.sourceId === selected.id || e.targetId === selected.id,
                ).length === 0 && (
                  <span className="text-xs text-text-dim">No relationships in current filter</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-text-dim mt-2">
        Tip: filter by type or search, click a node for detail, drag to pan, scroll to zoom. On
        mobile the list view is default for larger graphs.
      </p>
    </div>
  );
}
