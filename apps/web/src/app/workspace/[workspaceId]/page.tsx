'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useWorkspace } from '../../../hooks/useWorkspace';
import { api } from '../../../lib/api';
import type { Agent, Memory, PaginatedResponse } from '@vaeloom/shared-types';

export default function DashboardPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const { workspace, isLoading } = useWorkspace(workspaceId);
  const { data: agentsRes } = useSWR<PaginatedResponse<Agent>>(
    workspaceId ? `/workspaces/${workspaceId}/agents` : null,
    () => api.agents.list({ workspaceId }),
  );
  const { data: memoriesRes } = useSWR<PaginatedResponse<Memory>>(
    workspaceId ? `/workspaces/${workspaceId}/memories` : null,
    () => api.memories.list({ workspaceId }),
  );

  if (isLoading) {
    return <div className="p-8 text-center text-text-muted">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">
          {workspace?.name ?? 'Dashboard'}
        </h1>
        <p className="text-text-muted">Welcome back. Here&apos;s what your {(agentsRes?.data ?? []).length} agents have been up to.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">Active Agents</h3>
          <div className="text-4xl font-display text-primary">{(agentsRes?.data ?? []).length}</div>
        </div>
        <div className="card">
          <h3 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">Memory Nodes</h3>
          <div className="text-4xl font-display text-accent">{(memoriesRes?.data ?? []).length}</div>
        </div>
        <div className="card">
          <h3 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">Tasks Pending</h3>
          <div className="text-4xl font-display text-text">0</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card h-96 flex flex-col">
          <h3 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">Recent Activity</h3>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="flex gap-4 items-start">
              <span className="text-2xl">💡</span>
              <div>
                <p className="text-text">Organization Agent suggested renaming 3 files</p>
                <p className="text-xs text-text-muted font-mono mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-text">Resume Agent drafted a new master resume</p>
                <p className="text-xs text-text-muted font-mono mt-1">Yesterday</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card h-96 flex flex-col">
          <h3 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">Upcoming Deadlines</h3>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="flex justify-between items-center p-3 bg-background rounded border border-border">
              <div>
                <p className="text-text font-medium">Google Interview</p>
                <p className="text-xs text-text-muted mt-1">Technical Phone Screen</p>
              </div>
              <div className="text-right">
                <p className="text-accent font-mono text-sm">Tomorrow</p>
                <p className="text-xs text-text-muted mt-1">10:00 AM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
