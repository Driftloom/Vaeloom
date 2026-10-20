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
        description="Git synchronization for local Markdown notes, driven by the vaultsync client that runs on your machine. Commit and pull intervals are configurable below; Memory ingestion is optional."
      />

      {/* Main Interactive Sync Control Plane */}
      <VaultSyncPanel workspaceId={workspaceId} />

      {/* Built-in Architecture Summary */}
      <Card padding="md" className="p-6 bg-surface border border-border rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
            How Vaeloom Vault Sync Works
          </h3>
          <Badge variant="mono">Enterprise Plumbing</Badge>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">
          Vault Sync is an integral part of Vaeloom - no external subscriptions or hosted sync
          service. The vaultsync client runs on your machine and syncs your local Markdown vault to
          a private Git repository you control.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-surface-100 p-4 rounded-lg text-xs space-y-1.5 border border-border">
            <h4 className="font-semibold text-text">1. Debounced Push</h4>
            <p className="text-text-secondary">
              The vaultsync client watches your markdown files. After edits settle (default 30s,
              configurable), changes are committed and pushed to your private Git repository.
            </p>
          </div>

          <div className="bg-surface-100 p-4 rounded-lg text-xs space-y-1.5 border border-border">
            <h4 className="font-semibold text-text">2. Pull with Rebase</h4>
            <p className="text-text-secondary">
              Pulls remote updates with rebase on the configured interval (default 5m). On conflict,
              incoming notes are saved as <code>*.conflict-YYYY-MM-DD.md</code> without overwriting
              local work, and the conflict is reported in the panel above.
            </p>
          </div>

          <div className="bg-surface-100 p-4 rounded-lg text-xs space-y-1.5 border border-border">
            <h4 className="font-semibold text-text">3. Memory Ingestion</h4>
            <p className="text-text-secondary">
              When auto-indexing is enabled, notes you ingest are written into workspace Documents
              and the memory graph, where your agents can retrieve them.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
