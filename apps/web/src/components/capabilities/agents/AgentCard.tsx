'use client';

import React from 'react';
import { Badge, Switch } from '@vaeloom/ui-kit';
import type { CapabilityItem } from '@/lib/capabilities-data';
import type { CatalogAgent } from '@/lib/api-client';
import { AgentGlyph, agentHue, coerceAutonomy, formatAgentTitle } from './types';

export interface AgentCardProps {
  agent: CapabilityItem;
  catalogEntry?: CatalogAgent;
  hasCatalogLoaded?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  catalogEntry,
  hasCatalogLoaded = false,
  isSelected,
  onSelect,
  onToggle,
}) => {
  const hue = agentHue(agent.name);
  const toolCount = catalogEntry?.tools.length ?? agent.toolsUsed?.length ?? 0;

  return (
    <div
      className={`group flex items-start justify-between gap-2 p-3 rounded-lg transition-colors border ${
        isSelected
          ? 'bg-primary/10 border-l-2 border-l-primary border-primary/30 text-primary'
          : 'hover:bg-surface-hover border-transparent text-text'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
        className="flex items-start gap-2.5 min-w-0 flex-1 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span
          className="p-2 rounded-md shrink-0 border flex items-center justify-center"
          style={{
            color: hue.color,
            backgroundColor: hue.background,
            borderColor: hue.border,
          }}
          aria-hidden="true"
        >
          <AgentGlyph name={agent.name} />
        </span>
        <span className="min-w-0 flex-1 block">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-xs font-sans font-semibold tracking-tight truncate ${
                isSelected ? 'text-primary' : 'text-text'
              }`}
            >
              {formatAgentTitle(agent.name)}
            </span>
            <span className="text-2xs font-mono text-text-muted bg-surface-elevated px-1 py-0.5 rounded border border-border">
              {agent.name}
            </span>
            {catalogEntry?.isCanonical === true && (
              <Badge variant="primary" size="sm">
                Canonical
              </Badge>
            )}
            {catalogEntry === undefined && hasCatalogLoaded && !agent.isSeed && (
              <Badge variant="warning" size="sm">
                Not in registry
              </Badge>
            )}
            {agent.isSeed && (
              // A seeded row exists only in the client bundle. It is not in this
              // workspace and the API never returned it, so it is labelled
              // rather than presented as a real capability.
              <Badge variant="default" size="sm">
                Sample
              </Badge>
            )}
          </span>
          <span className="block text-xs text-text-secondary font-sans line-clamp-2 mt-0.5 leading-relaxed">
            {agent.description}
          </span>
          <span className="flex items-center gap-2 mt-1.5">
            <span className="text-2xs font-mono text-text-muted">
              {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
            </span>
            <span className="text-text-muted" aria-hidden="true">
              •
            </span>
            <span className="text-2xs font-sans text-text-secondary">
              {coerceAutonomy(catalogEntry?.defaultAutonomy, agent.autonomy ?? 'autonomous')}
            </span>
          </span>
        </span>
      </button>

      <div className="shrink-0 pt-0.5">
        <span
          title={
            agent.isSeed
              ? 'Sample capability — not present in this workspace, so it cannot be enabled.'
              : undefined
          }
        >
          <Switch
            checked={agent.enabled}
            onChange={onToggle}
            // Disabled rather than left clickable. Toggling a seeded row reaches
            // the write path with no workspace capability row to update, so the
            // click can only ever fail. The reason is carried by the Sample
            // badge and this title rather than behind a click that always errors.
            disabled={agent.isSeed === true}
            label={<span className="sr-only">{`Toggle ${agent.name}`}</span>}
          />
        </span>
      </div>
    </div>
  );
};
