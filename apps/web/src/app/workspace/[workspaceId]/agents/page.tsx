'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { agentCatalogApi, type CatalogAgent } from '@/lib/api-client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Badge, StatusDot, Skeleton } from '@vaeloom/ui-kit';

interface AgentVisualMeta {
  color: string;
  badgeClass: string;
  iconSvg: React.ReactNode;
}

function getAgentVisualMeta(name: string): AgentVisualMeta {
  switch (name.toLowerCase()) {
    case 'organization':
      return {
        color: 'text-amber-500',
        badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        ),
      };
    case 'memory':
      return {
        color: 'text-purple-500',
        badgeClass: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        ),
      };
    case 'resume':
      return {
        color: 'text-sky-500',
        badgeClass: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
      };
    case 'ats':
      return {
        color: 'text-emerald-500',
        badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
      };
    case 'job_search':
      return {
        color: 'text-blue-500',
        badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        ),
      };
    case 'application':
      return {
        color: 'text-pink-500',
        badgeClass: 'bg-pink-500/10 text-pink-500 border-pink-500/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        ),
      };
    case 'gmail':
      return {
        color: 'text-rose-500',
        badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        ),
      };
    case 'scheduler':
      return {
        color: 'text-amber-600',
        badgeClass: 'bg-amber-600/10 text-amber-600 border-amber-600/30',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        ),
      };
    default:
      return {
        color: 'text-primary',
        badgeClass: 'bg-primary/10 text-primary border-primary/20',
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        ),
      };
  }
}

function CategoryBadge({ isCanonical }: { isCanonical: boolean }) {
  return (
    <Badge variant={isCanonical ? 'primary' : 'default'} size="sm">
      <StatusDot status={isCanonical ? 'active' : 'disabled'} pulse={isCanonical} size="sm" />
      <span>{isCanonical ? 'canonical (MVP)' : 'enterprise (gated)'}</span>
    </Badge>
  );
}

function ScopePills({ scopes }: { scopes: { readTypes: string[]; writeTypes: string[] } }) {
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.readTypes.map((t) => (
        <span
          key={`r-${t}`}
          className="rounded bg-success/10 border border-success/30 px-1.5 py-0.5 text-xs text-success"
        >
          read:{t}
        </span>
      ))}
      {scopes.writeTypes.map((t) => (
        <span
          key={`w-${t}`}
          className="rounded bg-warning/10 border border-warning/30 px-1.5 py-0.5 text-xs text-warning"
        >
          write:{t}
        </span>
      ))}
      {scopes.readTypes.length === 0 && scopes.writeTypes.length === 0 && (
        <span className="text-xs text-text-dim">no memory scope</span>
      )}
    </div>
  );
}

function AgentCard({ agent, workspaceId }: { agent: CatalogAgent; workspaceId?: string }) {
  const [open, setOpen] = useState(false);
  const visual = getAgentVisualMeta(agent.name);

  return (
    <div
      className={`card flex flex-col transition-all duration-200 hover:border-border-strong ${
        agent.isCanonical ? 'border-border' : 'border-dashed opacity-90'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-lg border shrink-0 ${visual.badgeClass} flex items-center justify-center`}
            aria-hidden="true"
          >
            {visual.iconSvg}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-medium text-text capitalize">
                {agent.name.replace(/[_-]/g, ' ')}
              </h2>
              <CategoryBadge isCanonical={agent.isCanonical} />
            </div>
            <p className="mt-1 text-sm text-text-muted line-clamp-2">
              {agent.mission || 'Specialist agent'}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded border border-border bg-surface-hover px-2 py-1 text-xs font-mono text-text-muted">
          {agent.defaultAutonomy}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {agent.skills.map((s) => (
          <span
            key={s}
            className="rounded-full bg-surface-hover border border-border px-2.5 py-1 text-xs text-text-muted"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-3">
        <p className="text-xs font-mono uppercase tracking-widest text-text-dim mb-1">
          Memory scopes
        </p>
        <ScopePills scopes={agent.memoryScopes} />
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          <span className="font-mono font-medium">{agent.tools.length}</span> tools •{' '}
          <span className="font-mono">{agent.toolNames.length}</span> declared
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-hover transition-colors"
          >
            {open ? 'Hide tools' : 'Tools'}
          </button>
          {workspaceId && (
            <>
              <Link
                href={`/workspace/${workspaceId}/agents/${agent.name}`}
                className="text-xs text-text-muted hover:text-text px-2 py-1 rounded border border-border hover:bg-surface-hover transition-colors"
                aria-label={`Inspect ${agent.name}`}
              >
                Inspect
              </Link>
              <Link
                href={`/workspace/${workspaceId}/chat?agent=${agent.name}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-action-fg bg-action hover:bg-action-hover px-2.5 py-1 rounded transition-colors"
                aria-label={`Chat with ${agent.name}`}
              >
                <span>Chat</span>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-border bg-background p-3 space-y-2">
          {agent.tools.length === 0 ? (
            <p className="text-xs text-text-muted">No tools declared</p>
          ) : (
            agent.tools.map((t) => (
              <div
                key={t.name}
                className="flex items-start justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0"
              >
                <div>
                  <p className="font-mono text-xs text-text font-medium">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.description || 'No description'}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                    t.category === 'memory_write' || t.category === 'connector_write'
                      ? 'bg-error/10 text-error border-error/30'
                      : t.category === 'memory_read' || t.category === 'connector_read'
                        ? 'bg-success/10 text-success border-success/30'
                        : 'bg-surface-hover text-text-muted border-border'
                  }`}
                >
                  {t.category}
                </span>
              </div>
            ))
          )}
          <p className="text-[11px] text-text-dim pt-1 border-t border-border/50">
            Scope: tools require <span className="font-mono">required_scope</span> grants. Agent
            runs in suggest-mode; consequential actions need approval.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { workspace } = useWorkspace(workspaceId);

  const { data, error, isLoading, mutate } = useSWR('agent-catalog', () => agentCatalogApi.get());

  const agents = useMemo<CatalogAgent[]>(() => data?.agents ?? [], [data?.agents]);
  const canonical = useMemo(() => agents.filter((a) => a.isCanonical), [agents]);
  const enterprise = useMemo(() => agents.filter((a) => !a.isCanonical), [agents]);

  const [filter, setFilter] = useState<'all' | 'canonical' | 'enterprise'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = agents;
    if (filter === 'canonical') list = canonical;
    if (filter === 'enterprise') list = enterprise;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.mission.toLowerCase().includes(q) ||
          a.skills.join(' ').toLowerCase().includes(q),
      );
    }
    return list;
  }, [agents, canonical, enterprise, filter, search]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center card"
        role="alert"
      >
        <div className="p-3 rounded-full bg-error/10 text-error mb-3">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-text font-medium text-lg">Could not load agent catalog</p>
        <p className="text-sm text-text-muted mt-1 max-w-md">
          {(error as Error).message || 'An unexpected connection issue occurred.'}
        </p>
        <button onClick={() => mutate()} className="btn-secondary mt-5">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner with Executive Telemetry */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-surface-100 via-surface to-surface-200 p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono font-medium mb-3">
              <StatusDot status="active" pulse size="sm" />
              <span>AGENT MESH & AUTONOMY RUNTIME</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-medium text-text tracking-tight">
              Specialist Agent Fleet
            </h1>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              {workspace?.name ? `${workspace.name} • ` : ''}
              Governed multi-agent copilot system running under human oversight, 42/42 zero-trust
              memory RLS, and strict suggest-mode approvals.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 shrink-0">
            <div className="card py-3 px-4 border border-border bg-surface/80 text-center">
              <p className="text-xs font-mono uppercase text-text-dim">Canonical</p>
              <p className="text-xl font-bold font-mono text-primary mt-0.5">
                {data?.canonicalCount ?? 0}
              </p>
            </div>
            <div className="card py-3 px-4 border border-border bg-surface/80 text-center">
              <p className="text-xs font-mono uppercase text-text-dim">Enterprise</p>
              <p className="text-xl font-bold font-mono text-text mt-0.5">
                {(data?.total ?? 0) - (data?.canonicalCount ?? 0)}
              </p>
            </div>
            <div className="card py-3 px-4 border border-border bg-surface/80 text-center">
              <p className="text-xs font-mono uppercase text-text-dim">MCP Tools</p>
              <p className="text-xl font-bold font-mono text-success mt-0.5">
                {data?.toolDefinitions ? Object.keys(data.toolDefinitions).length : 0}
              </p>
            </div>
            <div className="card py-3 px-4 border border-border bg-surface/80 text-center">
              <p className="text-xs font-mono uppercase text-text-dim">Autonomy</p>
              <p className="text-xs font-semibold text-warning mt-2 uppercase tracking-wider">
                Suggest
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full">
          <div className="flex rounded-lg bg-surface-hover p-1 shrink-0 border border-border">
            {(['all', 'canonical', 'enterprise'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                  filter === v
                    ? 'bg-action text-action-fg shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {v}{' '}
                {v === 'canonical'
                  ? `(${canonical.length})`
                  : v === 'enterprise'
                    ? `(${enterprise.length})`
                    : `(${agents.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, skills, tools..."
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((a) => (
          <AgentCard key={a.name} agent={a} workspaceId={workspaceId} />
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="card border-dashed flex flex-col items-center py-12 px-4 text-center">
          <div className="p-3 rounded-full bg-surface-hover text-text-dim mb-3">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-base font-medium text-text">No agents match your criteria</p>
          <p className="text-sm text-text-muted mt-1 max-w-sm">
            Try adjusting your search query or switching between canonical and enterprise filters.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="btn-secondary mt-4 text-xs"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Architectural Explainer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h2 className="font-mono text-xs uppercase tracking-widest text-text font-semibold">
              Intent Routing Gate
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            The orchestrator classifies intent with a 0.7 confidence threshold. Under-confident
            prompts trigger proactive clarification prompts.
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2 text-success">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h2 className="font-mono text-xs uppercase tracking-widest text-text font-semibold">
              MCP Tools & Sandboxing
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            All tools adhere to Model Context Protocol (MCP) specifications with required scope
            policies and zero execution leaks across tenant boundaries.
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2 text-warning">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h2 className="font-mono text-xs uppercase tracking-widest text-text font-semibold">
              Governance & Approvals
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Consequential actions (emails, document submission, deletions) are held in durable
            approval queues awaiting cryptographic human consent.
          </p>
        </div>
      </div>

      {/* Tool Definitions Drawer */}
      {data?.toolDefinitions && (
        <details className="card group">
          <summary className="cursor-pointer text-sm font-medium text-text flex items-center justify-between py-1">
            <span>All declared tool definitions ({Object.keys(data.toolDefinitions).length})</span>
            <span className="text-xs text-text-dim group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {Object.entries(data.toolDefinitions).map(([name, def]) => (
              <div key={name} className="rounded-lg border border-border bg-surface-hover/50 p-3">
                <p className="font-mono text-xs text-text font-semibold">{name}</p>
                <p className="text-xs text-text-muted mt-0.5">{def.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-dim border border-border">
                    scope: {def.requiredScope}
                  </span>
                  <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-primary border border-border">
                    {def.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
