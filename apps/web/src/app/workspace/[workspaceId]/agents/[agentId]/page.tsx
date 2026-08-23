'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { agentCatalogApi, type CatalogAgent } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Badge } from '@/components/shared/Badge';

function CategoryBadge({ isCanonical }: { isCanonical: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-mono ${
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
    <div className="flex flex-wrap gap-1.5">
      {scopes.readTypes.map((t) => (
        <span
          key={`r-${t}`}
          className="rounded bg-success/10 border border-success/30 px-2 py-0.5 text-xs text-success dark:text-success"
        >
          read:{t}
        </span>
      ))}
      {scopes.writeTypes.map((t) => (
        <span
          key={`w-${t}`}
          className="rounded bg-warning/10 border border-warning/30 px-2 py-0.5 text-xs text-warning dark:text-warning"
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

export default function AgentDetailPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const agentId = params?.['agentId'] as string | undefined;

  const { data, error, isLoading, mutate } = useSWR('agent-catalog', () => agentCatalogApi.get());

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-24 bg-surface-hover rounded" />
        <div className="h-10 w-64 bg-surface-hover rounded" />
        <div className="card h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
        <p className="text-text font-medium">Could not load agent details</p>
        <p className="text-sm text-text-muted mt-1">
          {(error as Error).message || 'Unexpected error'}
        </p>
        <button onClick={() => mutate()} className="btn-secondary mt-4">
          Retry
        </button>
      </div>
    );
  }

  const agents = data?.agents ?? [];
  const agent = agents.find(
    (a) => a.name === agentId || a.name.replace(/[_\s-]/g, '-') === agentId,
  );

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
        <div className="text-text-muted mb-4 text-4xl">&#128269;</div>
        <h2 className="text-xl font-display font-medium mb-2 text-text">Agent not found</h2>
        <p className="text-text-muted max-w-sm mb-6">
          The agent &quot;{agentId}&quot; does not exist or is not available in this workspace.
        </p>
        <Link
          href={workspaceId ? `/workspace/${workspaceId}/agents` : '/agents'}
          className="btn-primary"
        >
          Back to agents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <nav aria-label="Breadcrumb">
        <Link
          href={workspaceId ? `/workspace/${workspaceId}/agents` : '/agents'}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to agents
        </Link>
      </nav>

      {/* Header */}
      <header>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-3xl font-display font-medium text-text capitalize">
            {agent.name.replace(/[_-]/g, ' ')}
          </h1>
          <CategoryBadge isCanonical={agent.isCanonical} />
        </div>
        <p className="text-text-muted">{agent.mission || 'Specialist agent'}</p>
      </header>

      {/* Main details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info card */}
        <div className="card space-y-4">
          <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">Agent Info</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-text-muted mb-1">Name</dt>
              <dd className="text-sm text-text font-mono">{agent.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted mb-1">Category</dt>
              <dd className="text-sm text-text">{agent.category}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted mb-1">Default Autonomy</dt>
              <dd>
                <Badge variant={agent.defaultAutonomy === 'suggest' ? 'info' : 'warning'}>
                  {agent.defaultAutonomy}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted mb-1">Mission</dt>
              <dd className="text-sm text-text">{agent.mission}</dd>
            </div>
          </dl>
        </div>

        {/* Memory scopes card */}
        <div className="card space-y-4">
          <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">
            Memory Scopes
          </h2>
          <ScopePills scopes={agent.memoryScopes} />
          <p className="text-xs text-text-dim">
            Agents use resolved LLM keys: workspace &rarr; user &rarr; system. Configure in Settings
            &rarr; API Keys.
          </p>
        </div>
      </div>

      {/* Skills */}
      <div className="card space-y-3">
        <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">
          Skills ({agent.skills.length})
        </h2>
        {agent.skills.length === 0 ? (
          <p className="text-sm text-text-muted">No skills declared</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {agent.skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-surface-hover border border-border px-3 py-1.5 text-sm text-text-muted"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="card space-y-3">
        <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">
          Tools ({agent.tools.length})
        </h2>
        {agent.tools.length === 0 ? (
          <p className="text-sm text-text-muted">No tools declared</p>
        ) : (
          <div className="space-y-2">
            {agent.tools.map((t) => (
              <div
                key={t.name}
                className="flex items-start justify-between gap-3 rounded border border-border bg-surface-hover px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-text">{t.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t.description || 'No description'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                    t.category === 'memory_write' || t.category === 'connector_write'
                      ? 'bg-error/10 text-error border-error/30'
                      : t.category === 'memory_read' || t.category === 'connector_read'
                        ? 'bg-success/10 text-success border-success/30'
                        : 'bg-surface text-text-muted border-border'
                  }`}
                >
                  {t.category}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-text-dim">
          Scope: tools require <span className="font-mono">required_scope</span> grants. Agent runs
          in suggest-mode; consequential actions need approval.
        </p>
      </div>
    </div>
  );
}
