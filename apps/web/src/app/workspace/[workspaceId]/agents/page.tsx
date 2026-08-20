'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { agentCatalogApi, type CatalogAgent } from '@/lib/api-client';
import { useWorkspace } from '@/hooks/useWorkspace';

function CategoryBadge({ isCanonical }: { isCanonical: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono ${
        isCanonical
          ? 'bg-primary/10 text-primary border-primary/20'
          : 'bg-surface-hover text-text-muted border-border'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isCanonical ? 'bg-primary' : 'bg-text-dim'}`} />
      {isCanonical ? 'canonical (MVP)' : 'enterprise (gated)'}
    </span>
  );
}

function ScopePills({ scopes }: { scopes: { readTypes: string[]; writeTypes: string[] } }) {
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.readTypes.map((t) => (
        <span
          key={`r-${t}`}
          className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
        >
          read:{t}
        </span>
      ))}
      {scopes.writeTypes.map((t) => (
        <span
          key={`w-${t}`}
          className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400"
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

function AgentCard({ agent }: { agent: CatalogAgent }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`card flex flex-col ${agent.isCanonical ? 'border-border' : 'border-dashed opacity-90'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-medium text-text capitalize">
              {agent.name.replace(/[_-]/g, ' ')}
            </h3>
            <CategoryBadge isCanonical={agent.isCanonical} />
          </div>
          <p className="mt-1 text-sm text-text-muted line-clamp-2">
            {agent.mission || 'Specialist agent'}
          </p>
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

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-text-muted">
          <span className="font-mono">{agent.tools.length}</span> tools •{' '}
          <span className="font-mono">{agent.toolNames.length}</span> declared
        </p>
        <button onClick={() => setOpen((v) => !v)} className="text-xs text-primary hover:underline">
          {open ? 'Hide tools' : 'Show tools'}
        </button>
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
                  <p className="font-mono text-xs text-text">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.description || 'No description'}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                    t.category === 'memory_write' || t.category === 'connector_write'
                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                      : t.category === 'memory_read' || t.category === 'connector_read'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-surface-hover text-text-muted border-border'
                  }`}
                >
                  {t.category}
                </span>
              </div>
            ))
          )}
          <p className="text-[11px] text-text-dim">
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

  const { data, error, isLoading } = useSWR('agent-catalog', () => agentCatalogApi.get());

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
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-surface-hover rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-surface-hover rounded card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-text font-medium">Could not load agents</p>
        <p className="text-sm text-text-muted mt-1">
          {(error as Error).message || 'Unexpected error'}
        </p>
        <button onClick={() => window.location.reload()} className="btn-secondary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-medium text-text">Agents</h1>
            <p className="text-sm text-text-muted mt-1">
              {workspace?.name ? `${workspace.name} — ` : ''}
              {data?.canonicalCount ?? 0} canonical (MVP) +{' '}
              {(data?.total ?? 0) - (data?.canonicalCount ?? 0)} enterprise — tools & skills matrix
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-text-dim">8 required for MVP</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-400">
              suggest-mode-first
            </span>
          </div>
        </div>
      </header>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded bg-surface-hover p-1">
            {(['all', 'canonical', 'enterprise'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-3 py-1 text-xs rounded capitalize ${filter === v ? 'bg-primary text-white' : 'text-text-muted hover:text-text'}`}
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
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, skills, tools..."
            className="w-64 bg-background border border-border rounded-md px-3 py-1.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((a) => (
          <AgentCard key={a.name} agent={a} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="card border-dashed flex flex-col items-center py-10 text-center">
          <p className="text-sm text-text">No agents match your filter</p>
          <p className="text-xs text-text-muted mt-1">Try clearing search or switching tabs.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            How routing works
          </h3>
          <p className="text-xs text-text-muted">
            Orchestrator classifies intent (keywords → category → agent) with 0.7 confidence gate.
            Low confidence → asks clarification. Enterprise agents are gated when{' '}
            <span className="font-mono">mvp_scope_enforced=true</span>.
          </p>
        </div>
        <div className="card">
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            Tools = MCP-shaped
          </h3>
          <p className="text-xs text-text-muted">
            Each tool has{' '}
            <span className="font-mono">
              name, description, input_schema, required_scope, category
            </span>
            . Treat all retrieved/tool content as untrusted — it cannot change policy. (Defs in{' '}
            <span className="font-mono">api/tools/definitions.py</span>).
          </p>
        </div>
        <div className="card">
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            Keys (BYOK)
          </h3>
          <p className="text-xs text-text-muted">
            Agents use resolved LLM keys: workspace → user → system. Configure in{' '}
            <span className="font-mono">Settings → API Keys</span>. Embeddings require OpenAI.
          </p>
        </div>
      </div>

      {data?.toolDefinitions && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium text-text">
            All tool definitions ({Object.keys(data.toolDefinitions).length})
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(data.toolDefinitions).map(([name, def]) => (
              <div key={name} className="rounded border border-border bg-surface-hover px-3 py-2">
                <p className="font-mono text-xs text-text">{name}</p>
                <p className="text-xs text-text-muted">{def.description}</p>
                <p className="mt-1 font-mono text-[10px] text-text-dim">
                  scope:{def.requiredScope} • {def.category}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
