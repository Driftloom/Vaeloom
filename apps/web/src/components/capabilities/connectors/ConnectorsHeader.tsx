'use client';

import React from 'react';
import { Button } from '@vaeloom/ui-kit';
import { PlusIcon } from '@/lib/connectors-catalog';

export type ConnectorSubTab = 'discover' | 'yours' | 'studio';

export interface ConnectorsHeaderProps {
  activeSubTab: ConnectorSubTab;
  onTabChange: (tab: ConnectorSubTab) => void;
  composioTotalCount: number | null;
  composioEnabled: boolean | null;
  installedCount: number;
  composioSyncing: boolean;
  onSyncAllComposio: () => void;
  onOpenAddModal: () => void;
}

export function ConnectorsHeader({
  activeSubTab,
  onTabChange,
  composioTotalCount,
  composioEnabled,
  installedCount,
  composioSyncing,
  onSyncAllComposio,
  onOpenAddModal,
}: ConnectorsHeaderProps) {
  const SUBTABS = [
    { id: 'discover' as const, label: 'Explore Directory' },
    { id: 'yours' as const, label: 'Installed' },
    { id: 'studio' as const, label: 'Custom Protocols' },
  ] as const;

  // Roving tabindex per the tab pattern: the tablist owns one Tab stop, and
  // ArrowRight/ArrowLeft move selection and focus, wrapping at both ends.
  const handleTablistKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const ids = SUBTABS.map((tab) => tab.id);
    const index = ids.indexOf(activeSubTab);
    const next = ids[(index + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
    if (next === undefined) return;
    if (next !== activeSubTab) onTabChange(next);
    document.getElementById(`connector-tab-${next}`)?.focus();
  };

  return (
    <div className="border-b border-border bg-surface px-4 sm:px-6 py-2.5 shrink-0 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans">
          Connectors Studio
        </h2>

        <div
          role="tablist"
          aria-label="Connector view"
          onKeyDown={handleTablistKeyDown}
          className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-elevated border border-border overflow-x-auto no-scrollbar shrink-0"
        >
          {SUBTABS.map((tab) => {
            const badge =
              tab.id === 'discover'
                ? composioTotalCount
                : tab.id === 'yours'
                  ? installedCount || null
                  : null;
            return (
              <button
                key={tab.id}
                id={`connector-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeSubTab === tab.id}
                aria-controls={`connector-panel-${tab.id}`}
                tabIndex={activeSubTab === tab.id ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  activeSubTab === tab.id
                    ? 'bg-action text-action-fg font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                {tab.label}
                {badge !== null && badge !== undefined && badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-2xs font-mono border ${
                      activeSubTab === tab.id
                        ? 'bg-black/30 text-white border-white/20'
                        : tab.id === 'yours'
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-surface-elevated text-text-secondary border-border'
                    }`}
                  >
                    {tab.id === 'discover' && composioEnabled === false
                      ? 'Composio off'
                      : badge.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            loading={composioSyncing}
            onClick={onSyncAllComposio}
          >
            {composioSyncing ? 'Syncing SaaS...' : 'Sync SaaS Tools'}
          </Button>
          <Button size="sm" onClick={onOpenAddModal}>
            <PlusIcon />
            Add Custom Connector
          </Button>
        </div>
      </div>
    </div>
  );
}
