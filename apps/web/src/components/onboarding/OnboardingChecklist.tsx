'use client';
import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { request } from '@/lib/api';
import type { Workspace } from '@vaeloom/shared-types';

export function OnboardingChecklist({ workspaceId }: { workspaceId?: string }) {
  const { data: workspaces } = useSWR<Workspace[]>('/workspaces', (url: string) =>
    request<Workspace[]>(url),
  );
  const { data: docs } = useSWR(
    workspaceId ? `/workspaces/${workspaceId}/document-actions` : null,
    () => request<unknown>(`/workspaces/${workspaceId}/document-actions`).catch(() => []),
  );
  const hasWorkspace = (workspaces?.length ?? 0) > 0;
  const hasDocs = Array.isArray(docs) ? docs.length > 0 : false;

  const steps = [
    { id: 'ws', label: 'Create workspace', done: hasWorkspace, href: '/workspaces', cta: 'Create' },
    {
      id: 'connect',
      label: 'Connect Gmail or Drive',
      done: false,
      href: workspaceId ? `/workspace/${workspaceId}/connectors` : '/connectors',
      cta: 'Connect',
    },
    {
      id: 'upload',
      label: 'Upload a file',
      done: hasDocs,
      href: workspaceId ? `/workspace/${workspaceId}/files` : '#',
      cta: 'Upload',
    },
    {
      id: 'agent',
      label: 'Run your first agent',
      done: false,
      href: workspaceId ? `/workspace/${workspaceId}/chat` : '#',
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
          className="h-full bg-primary transition-all"
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
            <p className="text-xs text-text-muted mt-1">{s.done ? 'Completed' : 'Next step'}</p>
            {!s.done && (
              <Link
                href={s.href}
                className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs text-black"
              >
                {s.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
