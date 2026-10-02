'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Badge, Card, Breadcrumb } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { VaultSyncPanel } from '@/components/memory/VaultSyncPanel';

export default function MemoryVaultPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const breadcrumbItems = [
    {
      label: 'Memory',
      href: `/workspace/${workspaceId}/memory`,
    },
    {
      label: 'Vault Git Sync',
      current: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Standard Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Page Header */}
      <PageHeader
        title="Vault Git Sync"
        description="Built-in zero-telemetry Git synchronization for local Markdown notes. Replaces Obsidian Sync out of the box with 30s debounce commits, 5m rebase pulls, and automatic Memory ingestion."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">
              ● Installed & Active
            </Badge>
            <Badge variant="mono" size="sm">
              v1.0.0 Native
            </Badge>
          </div>
        }
      />

      {/* Main Interactive Sync Control Plane */}
      <VaultSyncPanel workspaceId={workspaceId} />

      {/* Built-in Architecture Summary */}
      <Card
        padding="md"
        className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            How Vaeloom Vault Sync Works (Default Built-in Architecture)
          </h3>
          <Badge variant="mono">Enterprise Plumbing</Badge>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Vault Sync is an integral, native part of Vaeloom. You do not need any external services,
          extra subscriptions, or separate installations. The sync engine operates as background
          plumbing directly on your local Markdown vault.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-[var(--color-surface-subtle)] p-4 rounded-lg text-xs space-y-1.5 border border-[var(--color-border)]">
            <h4 className="font-semibold text-[var(--color-text-primary)]">1. Debounced Push</h4>
            <p className="text-[var(--color-text-secondary)]">
              Watches your markdown files. 30 seconds after you finish typing, changes are
              automatically committed and pushed to your private Git repository.
            </p>
          </div>

          <div className="bg-[var(--color-surface-subtle)] p-4 rounded-lg text-xs space-y-1.5 border border-[var(--color-border)]">
            <h4 className="font-semibold text-[var(--color-text-primary)]">
              2. 5-Minute Pull with Rebase
            </h4>
            <p className="text-[var(--color-text-secondary)]">
              Pulls remote updates with rebase every 5 minutes. On conflict, incoming notes are
              safely saved as <code>*.conflict-YYYY-MM-DD.md</code> without overwriting local work.
            </p>
          </div>

          <div className="bg-[var(--color-surface-subtle)] p-4 rounded-lg text-xs space-y-1.5 border border-[var(--color-border)]">
            <h4 className="font-semibold text-[var(--color-text-primary)]">3. Memory Ingestion</h4>
            <p className="text-[var(--color-text-secondary)]">
              Markdown notes are automatically indexed into Vaeloom Documents and the Multi-Scale
              Memory Graph, making all thoughts queryable by your AI copilot.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
