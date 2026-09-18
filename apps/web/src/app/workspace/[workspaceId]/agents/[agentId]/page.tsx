'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { agentCatalogApi, type CatalogAgent } from '@/lib/api-client';
import { Badge, StatusDot, Skeleton, Button } from '@vaeloom/ui-kit';

function ScopePills({ scopes }: { scopes: { readTypes: string[]; writeTypes: string[] } }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {scopes.readTypes.map((t) => (
        <span
          key={`r-${t}`}
          className="rounded bg-success/10 border border-success/30 px-2 py-0.5 text-xs text-success"
        >
          read:{t}
        </span>
      ))}
      {scopes.writeTypes.map((t) => (
        <span
          key={`w-${t}`}
          className="rounded bg-warning/10 border border-warning/30 px-2 py-0.5 text-xs text-warning"
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

const DEFAULT_SAMPLE_PROMPTS: Record<string, string[]> = {
  organization: [
    'Organize all resume drafts and cover letters into designated folders',
    'Find and clean duplicate document entries in this workspace',
  ],
  memory: [
    'Extract career entities and technical achievements from uploaded documents',
    'Consolidate workspace knowledge graph around machine learning skills',
  ],
  resume: [
    'Tailor my resume summary for a Principal AI Engineer position',
    'Format my experience bullet points using STAR methodology',
  ],
  ats: [
    'Audit ATS parseability and format score for my latest resume',
    'Extract missing hard skills compared against cloud architect roles',
  ],
  job_search: [
    'Search for remote Staff Software Engineer openings in North America',
    'Rank matching opportunities by compensation and tech stack compatibility',
  ],
  application: [
    'Draft a targeted cover letter for a Senior Platform Engineer role',
    'Prepare application package answers with human approval gating',
  ],
  gmail: [
    'Scan inbox for recruiter responses and interview invitation deadlines',
    'Draft a thank-you note to the hiring manager awaiting my approval',
  ],
  scheduler: [
    'Identify conflicting calendar appointments and suggest optimal interview blocks',
    'Dispatch reminder notification for upcoming technical interview',
  ],
};

export default function AgentDetailPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const agentId = params?.['agentId'] as string | undefined;

  const { data, error, isLoading, mutate } = useSWR('agent-catalog', () => agentCatalogApi.get());

  // Interactive Test Runner State
  const [testPrompt, setTestPrompt] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<{
    phase?: string;
    text: string;
    events: string[];
    error?: string;
  } | null>(null);

  const agents = data?.agents ?? [];
  const agent = agents.find(
    (a) => a.name === agentId || a.name.replace(/[_\s-]/g, '-') === agentId,
  );

  const samplePrompts = (agent ? DEFAULT_SAMPLE_PROMPTS[agent.name] : null) ?? [
    `Run a diagnostic check with ${agentId}`,
    `Explain capabilities and declared tool scopes for ${agentId}`,
  ];

  const handleRunTest = async (promptToRun?: string) => {
    const prompt = promptToRun || testPrompt;
    if (!prompt.trim() || !workspaceId || !agent) return;

    setTestRunning(true);
    setTestOutput({
      phase: 'connecting',
      text: '',
      events: ['Connecting to agent orchestration stream...'],
    });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch('/api/v1/agents/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          workspaceId,
          message: prompt,
          agentName: agent.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Readable stream not supported by browser');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      const eventsCaptured: string[] = ['Stream established'];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const rawData = line.slice(6).trim();
            try {
              const dataObj = JSON.parse(rawData);
              if (currentEvent === 'intent') {
                eventsCaptured.push(
                  `Intent classified: ${dataObj.agent} (${Math.round((dataObj.confidence ?? 0) * 100)}% confidence)`,
                );
              } else if (currentEvent === 'plan') {
                eventsCaptured.push(
                  `Planning phase: ${dataObj.steps?.length ?? 1} sub-goals planned`,
                );
              } else if (currentEvent === 'act') {
                eventsCaptured.push(`Act phase: executing action`);
              } else if (currentEvent === 'tool_start') {
                eventsCaptured.push(`Tool started: ${dataObj.tool || dataObj.name}`);
              } else if (currentEvent === 'tool_result') {
                eventsCaptured.push(`Tool finished: ${dataObj.tool || dataObj.name}`);
              } else if (currentEvent === 'observe' || currentEvent === 'reflect') {
                eventsCaptured.push(`${currentEvent.toUpperCase()}: reasoning updated`);
              } else if (currentEvent === 'token') {
                accumulatedText += dataObj.token ?? '';
              } else if (currentEvent === 'done') {
                eventsCaptured.push('Execution completed');
              } else if (currentEvent === 'error') {
                eventsCaptured.push(`Error: ${dataObj.message || 'Stream error'}`);
              }
            } catch {
              if (rawData) accumulatedText += rawData;
            }

            setTestOutput({
              phase: currentEvent || 'streaming',
              text: accumulatedText,
              events: [...eventsCaptured],
            });
          }
        }
      }

      setTestOutput((prev) => ({
        phase: 'complete',
        text: prev?.text || accumulatedText || 'Agent responded successfully without text payload.',
        events: [...eventsCaptured, 'Finished'],
      }));
    } catch (err) {
      setTestOutput((prev) => ({
        phase: 'error',
        text: prev?.text || '',
        events: [...(prev?.events || []), `Failed: ${(err as Error).message}`],
        error: (err as Error).message,
      }));
    } finally {
      setTestRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center card max-w-xl mx-auto"
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
        <p className="text-text font-medium text-lg">Could not load agent details</p>
        <p className="text-sm text-text-muted mt-1">
          {(error as Error).message || 'Unexpected error'}
        </p>
        <button onClick={() => mutate()} className="btn-secondary mt-4">
          Retry
        </button>
      </div>
    );
  }

  if (!agent) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center card max-w-md mx-auto"
        role="status"
      >
        <div className="p-3 rounded-full bg-surface-hover text-text-dim mb-4" aria-hidden="true">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-display font-medium mb-2 text-text">Agent not found</h2>
        <p className="text-text-muted text-sm max-w-sm mb-6">
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
          Back to agent fleet
        </Link>
      </nav>

      {/* Header with Quick Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-3xl font-display font-medium text-text capitalize">
              {agent.name.replace(/[_-]/g, ' ')}
            </h1>
            <Badge variant={agent.isCanonical ? 'primary' : 'default'}>
              <StatusDot
                status={agent.isCanonical ? 'active' : 'disabled'}
                pulse={agent.isCanonical}
                size="sm"
              />
              <span>{agent.isCanonical ? 'canonical (MVP)' : 'enterprise (gated)'}</span>
            </Badge>
          </div>
          <p className="text-text-muted text-sm max-w-2xl">
            {agent.mission || 'Specialist autonomous worker'}
          </p>
        </div>

        {workspaceId && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/workspace/${workspaceId}/chat?agent=${agent.name}`}
              className="btn-primary inline-flex items-center gap-1.5 text-sm"
            >
              <span>Open in Chat</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        )}
      </header>

      {/* Interactive Agent Test Console */}
      <section className="card p-5 border-primary/30 bg-surface-hover/30">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-primary/10 text-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider font-mono">
              Interactive Test Runner
            </h2>
          </div>
          <span className="text-xs text-text-dim font-mono">SSE Stream Loop</span>
        </div>

        <p className="text-xs text-text-muted mb-3">
          Execute a prompt directly against {agent.name}&apos;s 5-phase agentic loop and observe
          real-time tool calls, reflections, and confidence scores.
        </p>

        {/* Sample Prompts */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {samplePrompts.map((sp, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTestPrompt(sp);
                handleRunTest(sp);
              }}
              disabled={testRunning}
              className="text-[11px] rounded-full border border-border bg-surface px-2.5 py-1 text-text-muted hover:text-text hover:border-primary/40 transition-colors disabled:opacity-50 text-left"
            >
              💡 {sp}
            </button>
          ))}
        </div>

        {/* Input & Run */}
        <div className="flex gap-2">
          <input
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            placeholder={`Enter test prompt for ${agent.name}...`}
            disabled={testRunning}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleRunTest();
              }
            }}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary"
          />
          <Button
            onClick={() => handleRunTest()}
            loading={testRunning}
            disabled={!testPrompt.trim()}
            size="sm"
          >
            Run Test
          </Button>
        </div>

        {/* Stream output display */}
        {testOutput && (
          <div className="mt-4 rounded-lg border border-border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <StatusDot
                  status={
                    testOutput.phase === 'error'
                      ? 'error'
                      : testOutput.phase === 'complete'
                        ? 'active'
                        : 'idle'
                  }
                  pulse={testRunning}
                  size="sm"
                />
                <span className="font-mono text-text uppercase font-semibold">
                  Phase: {testOutput.phase}
                </span>
              </div>
              <span className="text-[11px] text-text-dim font-mono">
                {testOutput.events.length} stream events
              </span>
            </div>

            {/* Event Timeline */}
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {testOutput.events.map((ev, i) => (
                <div key={i} className="text-xs font-mono text-text-muted flex items-start gap-1.5">
                  <span className="text-primary select-none">›</span>
                  <span>{ev}</span>
                </div>
              ))}
            </div>

            {/* Stream Content */}
            {testOutput.text && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-mono uppercase text-text-dim mb-1">Agent Response:</p>
                <div className="text-sm text-text whitespace-pre-wrap rounded bg-surface/50 p-3 border border-border/50">
                  {testOutput.text}
                </div>
              </div>
            )}

            {testOutput.error && (
              <div className="text-xs text-error rounded bg-error/10 border border-error/20 p-2.5">
                {testOutput.error}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Main details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info card */}
        <div className="card space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim font-semibold">
            Governance & Identity
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-text-muted mb-0.5">System Name</dt>
              <dd className="text-sm text-text font-mono font-medium">{agent.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted mb-0.5">Category</dt>
              <dd className="text-sm text-text capitalize">{agent.category}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted mb-0.5">Autonomy Mode</dt>
              <dd>
                <Badge variant={agent.defaultAutonomy === 'suggest' ? 'primary' : 'warning'}>
                  {agent.defaultAutonomy} (human approval required for consequential side-effects)
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted mb-0.5">Mission Description</dt>
              <dd className="text-sm text-text leading-relaxed">{agent.mission}</dd>
            </div>
          </dl>
        </div>

        {/* Memory scopes card */}
        <div className="card space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim font-semibold">
            Memory Scopes & Zero-Trust Boundary
          </h2>
          <ScopePills scopes={agent.memoryScopes} />
          <p className="text-xs text-text-muted leading-relaxed">
            Memory queries are strictly scoped to the caller&apos;s workspace through PostgreSQL
            42/42 Row-Level Security (RLS). Agent context cannot bleed across tenant lines.
          </p>
          <div className="rounded border border-border bg-surface-hover/50 p-2.5 text-[11px] text-text-dim">
            Resolved LLM Keys: workspace &rarr; user &rarr; system (BYOK enabled in Settings &rarr;
            API Keys).
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="card space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim font-semibold">
          Declared Skills ({agent.skills.length})
        </h2>
        {agent.skills.length === 0 ? (
          <p className="text-sm text-text-muted">No skills declared</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {agent.skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-surface-hover border border-border px-3 py-1 text-xs text-text"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="card space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim font-semibold">
          MCP Tools Granted ({agent.tools.length})
        </h2>
        {agent.tools.length === 0 ? (
          <p className="text-sm text-text-muted">No tools declared for this agent.</p>
        ) : (
          <div className="space-y-2">
            {agent.tools.map((t) => (
              <div
                key={t.name}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-hover/50 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-text font-semibold">{t.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t.description || 'No description provided'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-mono border ${
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
        <p className="text-[11px] text-text-dim pt-1">
          Scope enforcement: tools require explicit{' '}
          <span className="font-mono">required_scope</span> authorization. Consequential
          side-effects trigger approval cards.
        </p>
      </div>
    </div>
  );
}
