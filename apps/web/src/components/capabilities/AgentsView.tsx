'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { ButtonGroup, EmptyState } from '@vaeloom/ui-kit';
import { CapabilityItem } from '@/lib/capabilities-data';
import {
  agentCatalogApi,
  capabilitiesApi,
  type CapabilityItemRecord,
  type CatalogAgent,
} from '@/lib/api-client';

import { formatAgentTitle } from './agents/types';
import { AgentCard } from './agents/AgentCard';
import { AgentDetailPane } from './agents/AgentDetailPane';

export interface AgentsViewProps {
  agents: CapabilityItem[];
  workspaceId: string;
  searchQuery?: string;
  initialAgentName?: string;
  onToggleAgent: (id: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  workspaceId,
  searchQuery = '',
  initialAgentName,
  onToggleAgent,
}) => {
  const {
    data: catalog,
    error: catalogError,
    isLoading: catalogLoading,
  } = useSWR('agent-catalog', () => agentCatalogApi.get(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const catalogByName = useMemo(() => {
    const map = new Map<string, CatalogAgent>();
    if (catalog?.agents && Array.isArray(catalog.agents)) {
      for (const agent of catalog.agents) map.set(agent.name.toLowerCase(), agent);
    }
    return map;
  }, [catalog]);

  const {
    data: agentCapabilityRows,
    error: agentCapabilityRowsError,
    mutate: mutateAgentCapabilityRows,
  } = useSWR(
    workspaceId ? ['agent-capability-rows', workspaceId] : null,
    () => capabilitiesApi.list('agent', workspaceId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const agentCapabilityByName = useMemo(() => {
    const map = new Map<string, CapabilityItemRecord>();
    for (const row of agentCapabilityRows ?? []) map.set(row.name, row);
    return map;
  }, [agentCapabilityRows]);

  const defaultAgentId = useMemo(() => {
    if (initialAgentName) {
      const wanted = initialAgentName.toLowerCase();
      const match = agents.find(
        (a) =>
          a.name.toLowerCase() === wanted ||
          a.id === initialAgentName ||
          a.id === `agent-${wanted}`,
      );
      if (match) return match.id;
    }
    return agents[0]?.id ?? null;
  }, [agents, initialAgentName]);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(defaultAgentId);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'canonical' | 'other'>('all');

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId],
  );

  const selectedCatalogEntry = useMemo(
    () => (selectedAgent ? (catalogByName.get(selectedAgent.name.toLowerCase()) ?? null) : null),
    [catalogByName, selectedAgent],
  );

  const selectedCapabilityRow = selectedAgent
    ? (agentCapabilityByName.get(selectedAgent.name) ?? null)
    : null;

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      const entry = catalogByName.get(agent.name.toLowerCase());
      const canonical = entry?.isCanonical ?? false;
      if (activeTypeFilter === 'canonical' && !canonical) return false;
      if (activeTypeFilter === 'other' && canonical) return false;

      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        formatAgentTitle(agent.name).toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.tags.some((t) => t.toLowerCase().includes(q)) ||
        (entry?.mission ?? '').toLowerCase().includes(q)
      );
    });
  }, [agents, catalogByName, searchQuery, activeTypeFilter]);

  if (agents.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-6">
        <EmptyState
          title="No agents in this workspace"
          description="The capability list for this workspace contains no agent entries. Agents become available once one is registered as a capability."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 bg-background text-text overflow-hidden">
      <section
        className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[410px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0"
        aria-labelledby="agents-directory-heading"
      >
        <div className="p-3 border-b border-border bg-surface shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="agents-directory-heading"
              className="text-xs font-semibold text-text uppercase tracking-wider font-sans"
            >
              Agents
            </h2>
            <span className="text-2xs font-sans text-text-muted">
              {filteredAgents.length} of {agents.length}
            </span>
          </div>

          <ButtonGroup
            attached
            className="w-full [&>button]:flex-1 [&>button]:text-xs [&>button]:px-2"
            aria-label="Filter agents by registry classification"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'canonical', label: 'Canonical' },
                { id: 'other', label: 'Other' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTypeFilter(tab.id)}
                aria-pressed={activeTypeFilter === tab.id}
                className={`py-1 rounded-md text-xs font-sans font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  activeTypeFilter === tab.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </ButtonGroup>

          {catalogError && (
            <p role="status" className="text-2xs font-sans text-warning leading-relaxed">
              Agent registry unavailable: {catalogError.message}. Scopes and tools below come from
              the workspace capability row, not the registry.
            </p>
          )}
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain divide-y divide-border p-1.5 pb-12">
          {filteredAgents.length === 0 && (
            <li className="p-2">
              <EmptyState
                title="No agents match"
                description={
                  searchQuery.trim()
                    ? `Nothing in this workspace matches “${searchQuery.trim()}”.`
                    : 'No agent has this registry classification.'
                }
              />
            </li>
          )}

          {filteredAgents.map((agent) => {
            const entry = catalogByName.get(agent.name.toLowerCase());
            const isSelected = agent.id === selectedAgent?.id;
            return (
              <li key={agent.id}>
                <AgentCard
                  agent={agent}
                  catalogEntry={entry}
                  hasCatalogLoaded={Boolean(catalog)}
                  isSelected={isSelected}
                  onSelect={() => setSelectedAgentId(agent.id)}
                  onToggle={() => onToggleAgent(agent.id)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <AgentDetailPane
        selectedAgent={selectedAgent}
        selectedCatalogEntry={selectedCatalogEntry}
        selectedCapabilityRow={selectedCapabilityRow}
        catalogLoading={catalogLoading}
        workspaceId={workspaceId}
        agentCapabilityRowsError={agentCapabilityRowsError}
        mutateAgentCapabilityRows={mutateAgentCapabilityRows}
      />
    </div>
  );
};
