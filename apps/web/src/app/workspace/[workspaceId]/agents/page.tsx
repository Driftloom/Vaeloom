'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { agentCatalogApi, type CatalogAgent } from '@/lib/api-client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/components/shared/Page';
import { AgentErrorState, ScopePills } from './AgentShared';
import {
  Badge,
  BrainIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  EditIcon,
  FileTextIcon,
  LockIcon,
  MailIcon,
  SearchIcon,
  ShieldIcon,
  Skeleton,
  SparklesIcon,
  StatusDot,
  type IconProps,
} from '@vaeloom/ui-kit';

type AgentIcon = React.ComponentType<IconProps>;

interface AgentVisualMeta {
  /**
   * Written out in full rather than interpolated from a token name: Tailwind's
   * content scanner only sees literal strings, so `bg-${tone}/10` would purge
   * every one of these. Raw palette shades (`-500`/`-600`) are avoided because
   * they vanish on the near-black dark canvas.
   */
  badgeClass: string;
  Icon: AgentIcon;
}

const AGENT_VISUALS: Record<string, AgentVisualMeta> = {
  organization: {
    badgeClass: 'bg-warning/10 text-warning border-warning/30',
    Icon: BuildingIcon,
  },
  memory: { badgeClass: 'bg-accent/10 text-accent border-accent/30', Icon: BrainIcon },
  resume: { badgeClass: 'bg-info/10 text-info border-info/30', Icon: FileTextIcon },
  ats: { badgeClass: 'bg-success/10 text-success border-success/30', Icon: CheckIcon },
  job_search: { badgeClass: 'bg-action/10 text-action border-action/30', Icon: SearchIcon },
  application: { badgeClass: 'bg-primary/10 text-primary border-primary/30', Icon: EditIcon },
  gmail: { badgeClass: 'bg-accent/10 text-accent border-accent/30', Icon: MailIcon },
  scheduler: { badgeClass: 'bg-action/10 text-action border-action/30', Icon: CalendarIcon },
};

const DEFAULT_VISUAL: AgentVisualMeta = {
  badgeClass: 'bg-primary/10 text-primary border-primary/30',
  Icon: SparklesIcon,
};

function getAgentVisualMeta(name: string): AgentVisualMeta {
  return AGENT_VISUALS[name.toLowerCase()] ?? DEFAULT_VISUAL;
}

function CategoryBadge({ isCanonical }: { isCanonical: boolean }) {
  return (
    <Badge variant={isCanonical ? 'primary' : 'default'} size="sm">
      <StatusDot status={isCanonical ? 'active' : 'disabled'} pulse={isCanonical} size="sm" />
      <span>{isCanonical ? 'canonical (MVP)' : 'enterprise (gated)'}</span>
    </Badge>
  );
}

function AgentCard({ agent, workspaceId }: { agent: CatalogAgent; workspaceId?: string }) {
  const [open, setOpen] = useState(false);
  const { badgeClass, Icon } = getAgentVisualMeta(agent.name);

  return (
    <div
      className={`card flex flex-col transition-all duration-200 hover:border-border-strong ${
        agent.isCanonical ? 'border-border' : 'border-dashed opacity-90'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-lg border shrink-0 flex items-center justify-center ${badgeClass}`}
            aria-hidden="true"
          >
            <Icon size={20} />
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
                className="btn-primary text-xs"
                aria-label={`Chat with ${agent.name}`}
              >
                <span>Chat</span>
                <ChevronRightIcon size={12} />
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
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-mono border ${
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
          <p className="text-xs text-text-dim pt-1 border-t border-border/50">
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
        <PageHeader
          title="Agents"
          description={workspace?.name ? `${workspace.name} agent fleet` : undefined}
        />
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
      <div className="space-y-6">
        <PageHeader
          title="Agents"
          description={workspace?.name ? `${workspace.name} agent fleet` : undefined}
        />
        <AgentErrorState
          title="Could not load agent catalog"
          message={(error as Error).message || 'An unexpected connection issue occurred.'}
          onRetry={() => void mutate()}
          retryLabel="Retry Connection"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Specialist Agent Fleet"
        eyebrow="Autonomy"
        description={`${
          workspace?.name ? `${workspace.name} • ` : ''
        }Governed multi-agent copilot system running under human oversight, 42/42 zero-trust memory RLS, and strict suggest-mode approvals.`}
      />
      {/* Consolidated into Capabilities Hub Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-primary/10 border border-primary/25 text-xs">
        <div className="flex items-center gap-3">
          <span
            className="p-2 rounded-lg bg-primary/20 text-primary text-base font-bold shrink-0"
            aria-hidden="true"
          >
            ✦
          </span>
          <div>
            <span className="font-semibold text-text">
              Autonomous Agents are now part of the unified Capabilities Studio
            </span>
            <p className="text-text-muted mt-0.5">
              Manage Jinja2 prompts, memory scopes, function-calling tools, and run direct agent
              chat sessions from Capabilities.
            </p>
          </div>
        </div>
        <Link
          href={`/workspace/${workspaceId}/capabilities?category=agents`}
          className="btn-primary text-xs shrink-0"
        >
          <span>Open in Capabilities Hub</span>
          <ChevronRightIcon size={12} />
        </Link>
      </div>

      {/* Hero Banner with Executive Telemetry */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-surface-100 via-surface to-surface-200 p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono font-medium mb-3">
              <StatusDot status="active" pulse size="sm" />
              <span>AGENT MESH &amp; AUTONOMY RUNTIME</span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
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
        <div
          role="group"
          aria-label="Filter agents by availability"
          className="flex rounded-lg bg-surface-hover p-1 shrink-0 border border-border"
        >
          {(['all', 'canonical', 'enterprise'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                filter === v ? 'btn-primary' : 'text-text-muted hover:text-text'
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
        <div className="relative w-full sm:w-72">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
          />
          <label htmlFor="agent-search" className="sr-only">
            Search agents by name, mission, or skill
          </label>
          <input
            id="agent-search"
            type="search"
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
          <div className="p-3 rounded-full bg-surface-hover text-text-dim mb-3" aria-hidden="true">
            <SearchIcon size={32} />
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
            <SparklesIcon size={16} />
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
            <ShieldIcon size={16} />
            <h2 className="font-mono text-xs uppercase tracking-widest text-text font-semibold">
              MCP Tools &amp; Sandboxing
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            All tools adhere to Model Context Protocol (MCP) specifications with required scope
            policies and zero execution leaks across tenant boundaries.
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2 text-warning">
            <LockIcon size={16} />
            <h2 className="font-mono text-xs uppercase tracking-widest text-text font-semibold">
              Governance &amp; Approvals
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
                  <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-text-dim border border-border">
                    scope: {def.requiredScope}
                  </span>
                  <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-primary border border-border">
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
