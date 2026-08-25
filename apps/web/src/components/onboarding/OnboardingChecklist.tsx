'use client';
import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { request } from '@/lib/api';
import type { Workspace } from '@vaeloom/shared-types';

/**
 * Onboarding checklist (Phase-02B / F-18).
 *
 * Every step reflects a REAL system signal:
 *  - workspace: the user is in a workspace (component only renders there)
 *  - connector: workspace connectors feed has ≥1 entry
 *  - upload:    workspace document-actions feed has ≥1 entry
 *  - agent:     workspace agent-actions feed has ≥1 entry (an agent actually acted)
 *
 * NOT IMPLEMENTED — BACKEND DEPENDENCY: an initial-scan / "here's what we
 * found" summary surface (MVP spec FR-05). The checklist links to Chat where
 * the user can request one, but no dedicated scan-summary API exists yet.
 */
export function OnboardingChecklist({ workspaceId }: { workspaceId?: string }) {
  const { data: workspaces } = useSWR<Workspace[]>('/workspaces', (url: string) =>
    request<Workspace[]>(url),
  );
  const { data: docs } = useSWR(
    workspaceId ? `/workspaces/${workspaceId}/document-actions` : null,
    () => request<unknown>(`/workspaces/${workspaceId}/document-actions`).catch(() => []),
  );
  const { data: connectors } = useSWR(
    workspaceId ? `/workspaces/${workspaceId}/connectors` : null,
    () => request<unknown>(`/workspaces/${workspaceId}/connectors`).catch(() => []),
  );
  const { data: agentActions } = useSWR(
    workspaceId ? `/workspaces/${workspaceId}/agent-actions` : null,
    () => request<unknown>(`/workspaces/${workspaceId}/agent-actions`).catch(() => []),
  );

  const count = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
  const hasWorkspace = (workspaces?.length ?? 0) > 0;
  const hasConnector = count(connectors) > 0;
  const hasDocs = count(docs) > 0;
  const hasAgentRun = count(agentActions) > 0;

  const steps = [
    {
      id: 'ws',
      label: 'Create workspace',
      done: hasWorkspace,
      href: '/dashboard',
      cta: 'Open dashboard',
    },
    {
      id: 'connect',
      label: 'Connect Gmail or Drive',
      done: hasConnector,
      href: workspaceId ? `/workspace/${workspaceId}/connectors` : '/connectors',
      cta: 'Connect',
    },
    {
      id: 'upload',
      label: 'Upload a file',
      done: hasDocs,
      href: workspaceId ? `/workspace/${workspaceId}/files` : '/files',
      cta: 'Upload',
    },
    {
      id: 'agent',
      label: 'Run your first agent',
      done: hasAgentRun,
      href: workspaceId ? `/workspace/${workspaceId}/chat` : '/chat',
      cta: 'Chat',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="card border-primary/20 bg-primary/5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-medium text-text">Get started</h2>
        <span className="text-xs font-mono text-text-muted">
          {doneCount}/{steps.length} completed
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover mb-4">
        <div
          className="h-full bg-action transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {steps.map((s) => (
          <div
            key={s.id}
            className={`rounded-lg border p-3 ${s.done ? 'border-success/30 bg-success/5' : 'border-border bg-surface'}`}
          >
            <p className="text-sm font-medium text-text">{s.label}</p>
            {/* Progress reflects real backend state — never hardcoded. */}
            <p className="text-xs text-text-muted mt-1">{s.done ? 'Completed' : 'Next step'}</p>
            {!s.done && (
              <Link
                href={s.href}
                className="mt-2 inline-block rounded-full bg-action px-3 py-1 text-xs text-action-fg hover:bg-action-hover"
              >
                {s.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-text-dim">
        Tip: after connecting sources, ask the agent in Chat for a summary of what it found.
      </p>
    </div>
  );
}
