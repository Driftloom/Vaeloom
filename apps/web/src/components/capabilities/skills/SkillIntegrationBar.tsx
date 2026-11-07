'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BrainIcon,
  Button,
  CpuIcon,
  FileTextIcon,
  MessageIcon,
  MIN_TOUCH_TARGET,
} from '@vaeloom/ui-kit';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import type { SkillRow } from './SkillCard';
import {
  SPECIALIST_AGENTS,
  type SpecialistAgentDef,
} from '@/components/chat/ChatAgentSquadSelector';

interface SkillIntegrationBarProps {
  row: SkillRow;
  workspaceId: string;
}

/**
 * Maps a skill slug or name to its primary Specialist Agent.
 *
 * Returns `undefined` when no specialist pattern matches: callers must then
 * omit the `agent` deep-link param and let the chat's automatic selection
 * pick the executor. Never invent an agent id the chat catalog may not have.
 */
export function getAgentForSkill(
  skillName: string,
): Pick<SpecialistAgentDef, 'id' | 'name' | 'role' | 'badgeClass'> | undefined {
  const name = (skillName || '').toLowerCase();
  const find = (id: string) => SPECIALIST_AGENTS.find((agent) => agent.id === id);

  if (
    name.includes('ats-audit') ||
    name.includes('ats-optimizer') ||
    name.includes('semantic-ats')
  ) {
    return find('ats');
  }

  if (name.includes('job-discovery') || name.includes('job-description')) {
    return find('job_search');
  }

  if (
    name.includes('form-filler') ||
    name.includes('cold-email') ||
    name.includes('cover-letter')
  ) {
    return find('application');
  }

  if (
    name.includes('coaching') ||
    name.includes('translator') ||
    name.includes('case-study') ||
    name.includes('reference') ||
    name.includes('salary') ||
    name.includes('offer') ||
    name.includes('star-interview') ||
    name.includes('linkedin')
  ) {
    return find('career');
  }

  if (name.includes('resume') || name.includes('cv')) {
    return find('resume');
  }

  return undefined;
}

export const SkillIntegrationBar: React.FC<SkillIntegrationBarProps> = ({ row, workspaceId }) => {
  const router = useSafeRouter();
  const agent = getAgentForSkill(row.item.name);
  const requiresMemory = (row.item.requiredScope || '').includes('memory');
  const isDocumentSkill =
    (row.item.requiredScope || '').includes('document') ||
    row.item.name.includes('resume') ||
    row.item.name.includes('cv');

  const defaultPrompt =
    row.item.triggers && row.item.triggers.length > 0
      ? `Use ${row.item.triggers[0]} to help me with my career workflow.`
      : `Execute ${row.item.name} for my current project.`;

  const handleLaunchChat = () => {
    const query = new URLSearchParams({ prompt: defaultPrompt });
    if (agent) query.set('agent', agent.id);
    query.set('skill', row.slug || row.item.name);
    router.push(`/workspace/${workspaceId}/chat?${query.toString()}`);
  };

  return (
    <div className="rounded-container border border-border-subtle bg-surface-elevated p-3 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Cross-Page Agent Wiring:
          </span>
          {agent ? (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-2xs font-medium border ${agent.badgeClass}`}
            >
              <CpuIcon size={12} className="shrink-0" />
              <span>{agent.name}</span>
              <span className="opacity-70 font-mono">({agent.role})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-2xs font-medium border bg-surface text-text-muted border-border">
              <CpuIcon size={12} className="shrink-0" />
              <span>Auto agent selection</span>
            </span>
          )}
        </div>

        {/* Integration Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            size="sm"
            variant="primary"
            onClick={handleLaunchChat}
            className="text-xs h-7 px-3 flex items-center gap-1"
          >
            <MessageIcon size={12} className="shrink-0" />
            <span>Launch in Chat</span>
          </Button>

          {requiresMemory && (
            <Link
              href={`/workspace/${workspaceId}/memory`}
              className={`inline-flex items-center gap-1 text-2xs font-medium text-text-secondary hover:text-primary px-2.5 py-1 rounded-control border border-border hover:border-primary/40 bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${MIN_TOUCH_TARGET}`}
            >
              <BrainIcon size={12} className="shrink-0" />
              <span>Vault Grounding</span>
            </Link>
          )}

          {isDocumentSkill && (
            <Link
              href={`/workspace/${workspaceId}/files`}
              className={`inline-flex items-center gap-1 text-2xs font-medium text-text-secondary hover:text-primary px-2.5 py-1 rounded-control border border-border hover:border-primary/40 bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${MIN_TOUCH_TARGET}`}
            >
              <FileTextIcon size={12} className="shrink-0" />
              <span>Documents Hub</span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-2xs text-text-muted pt-1 border-t border-border-subtle font-mono">
        <span className="truncate">
          {agent ? (
            <>
              Triggers routed via: <strong className="text-text">{agent.name}</strong>
            </>
          ) : (
            <>
              Agent selection: <strong className="text-text">automatic</strong>
            </>
          )}
        </span>
        <span className="shrink-0 text-text-secondary">
          Scope: <code className="text-primary font-bold">{row.item.requiredScope || 'none'}</code>
        </span>
      </div>
    </div>
  );
};
