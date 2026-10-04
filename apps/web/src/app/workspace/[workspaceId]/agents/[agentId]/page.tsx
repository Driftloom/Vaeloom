'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { agentApi, agentCatalogApi } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/Page';
import { AgentErrorState, ScopePills } from '../AgentShared';
import { Badge, Button, ExternalLinkIcon, PlayIcon, Skeleton, StatusDot } from '@vaeloom/ui-kit';

function BackToFleet({ workspaceId }: { workspaceId?: string }) {
  return (
    <Link
      href={workspaceId ? `/workspace/${workspaceId}/agents` : '/agents'}
      className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
    >
      Back to agent fleet
    </Link>
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

  /** The stream reader is long-lived; unmounting must tear it down or the
   *  reader keeps the socket (and the response body) open after the route is
   *  gone. */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const agents = data?.agents ?? [];
  const agent = agents.find(
    (a) => a.name === agentId || a.name.replace(/[_\s-]/g, '-') === agentId,
  );

  const samplePrompts = useMemo(
    () =>
      (agent ? DEFAULT_SAMPLE_PROMPTS[agent.name] : null) ?? [
        `Run a diagnostic check with ${agentId}`,
        `Explain capabilities and declared tool scopes for ${agentId}`,
      ],
    [agent, agentId],
  );

  const handleRunTest = useCallback(
    async (promptToRun?: string) => {
      const prompt = promptToRun || testPrompt;
      if (!prompt.trim() || !workspaceId || !agent) return;

      // A second run supersedes the first; without this the two readers would
      // interleave their chunks into one event timeline.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setTestRunning(true);
      setTestOutput({
        phase: 'connecting',
        text: '',
        events: ['Connecting to agent orchestration stream...'],
      });

      const eventsCaptured: string[] = ['Stream established'];
      let accumulatedText = '';

      try {
        await agentApi.chatStream(
          { workspaceId, message: prompt, agentName: agent.name },
          (event, data) => {
            switch (event) {
              case 'intent':
                eventsCaptured.push(
                  `Intent classified: ${data['agent']} (${Math.round(
                    ((data['confidence'] as number) ?? 0) * 100,
                  )}% confidence)`,
                );
                break;
              case 'plan':
                eventsCaptured.push(
                  `Planning phase: ${(data['steps'] as unknown[] | undefined)?.length ?? 1} sub-goals planned`,
                );
                break;
              case 'act':
                eventsCaptured.push('Act phase: executing action');
                break;
              case 'tool_start':
              case 'tool_result':
                eventsCaptured.push(
                  `Tool ${event === 'tool_start' ? 'started' : 'finished'}: ${
                    (data['tool'] as string) ?? (data['name'] as string)
                  }`,
                );
                break;
              case 'observe':
              case 'reflect':
                eventsCaptured.push(`${event.toUpperCase()}: reasoning updated`);
                break;
              case 'token':
                accumulatedText += (data['token'] as string) ?? '';
                break;
              case 'done':
                eventsCaptured.push('Execution completed');
                break;
              case 'error':
                eventsCaptured.push(`Error: ${(data['message'] as string) || 'Stream error'}`);
                break;
              default:
                if (typeof data['raw'] === 'string') accumulatedText += data['raw'];
                break;
            }
            setTestOutput({
              phase: event || 'streaming',
              text: accumulatedText,
              events: [...eventsCaptured],
            });
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;
        setTestOutput({
          phase: 'complete',
          text: accumulatedText || 'Agent responded successfully without text payload.',
          events: [...eventsCaptured, 'Finished'],
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Stream failed';
        setTestOutput((prev) => ({
          phase: 'error',
          text: prev?.text || accumulatedText,
          events: [...(prev?.events || []), `Failed: ${message}`],
          error: message,
        }));
      } finally {
        if (!controller.signal.aborted) setTestRunning(false);
      }
    },
    [testPrompt, workspaceId, agent],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader title="Agent" breadcrumb={<BackToFleet workspaceId={workspaceId} />} />
        <Skeleton className="h-24 w-full rounded-xl" />
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
      <div className="space-y-6 max-w-4xl">
        <PageHeader title="Agent" breadcrumb={<BackToFleet workspaceId={workspaceId} />} />
        <AgentErrorState
          title="Could not load agent details"
          message={(error as Error).message || 'Unexpected error'}
          onRetry={() => void mutate()}
          className="max-w-xl mx-auto"
        />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title="Agent not found"
          breadcrumb={<BackToFleet workspaceId={workspaceId} />}
          description={`The agent "${agentId}" does not exist or is not available in this workspace.`}
          actions={
            <Link
              href={workspaceId ? `/workspace/${workspaceId}/agents` : '/agents'}
              className="btn-primary"
            >
              Back to agents
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={agent.name.replace(/[_-]/g, ' ')}
        titleId="agent-detail-title"
        breadcrumb={<BackToFleet workspaceId={workspaceId} />}
        description={agent.mission || 'Specialist autonomous worker'}
        eyebrow={agent.isCanonical ? 'Canonical (MVP)' : 'Enterprise (gated)'}
        actions={
          workspaceId ? (
            <Link
              href={`/workspace/${workspaceId}/chat?agent=${agent.name}`}
              className="btn-primary inline-flex items-center gap-1.5 text-sm"
            >
              <span>Open in Chat</span>
              <ExternalLinkIcon size={16} />
            </Link>
          ) : undefined
        }
      />

      {/* Interactive Agent Test Console */}
      <section className="card p-5 border-primary/30 bg-surface-hover/30">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-primary/10 text-primary" aria-hidden="true">
              <PlayIcon size={16} />
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
              type="button"
              onClick={() => {
                setTestPrompt(sp);
                void handleRunTest(sp);
              }}
              disabled={testRunning}
              className="text-xs rounded-full border border-border bg-surface px-2.5 py-1 text-text-muted hover:text-text hover:border-primary/40 transition-colors disabled:opacity-50 text-left"
            >
              <span aria-hidden="true">💡</span> {sp}
            </button>
          ))}
        </div>

        {/* Input & Run */}
        <div className="flex gap-2">
          <label htmlFor="agent-test-prompt" className="sr-only">
            Test prompt for {agent.name}
          </label>
          <input
            id="agent-test-prompt"
            value={testPrompt}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestPrompt(e.target.value)}
            placeholder={`Enter test prompt for ${agent.name}...`}
            disabled={testRunning}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleRunTest();
              }
            }}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary"
          />
          <Button
            onClick={() => void handleRunTest()}
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
              <span className="text-xs text-text-dim font-mono">
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
          <div className="rounded border border-border bg-surface-hover/50 p-2.5 text-xs text-text-dim">
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
                  className={`shrink-0 rounded px-2 py-0.5 text-xs font-mono border ${
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
        <p className="text-xs text-text-dim pt-1">
          Scope enforcement: tools require explicit{' '}
          <span className="font-mono">required_scope</span> authorization. Consequential
          side-effects trigger approval cards.
        </p>
      </div>
    </div>
  );
}
