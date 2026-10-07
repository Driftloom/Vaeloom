'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Tooltip } from '@vaeloom/ui-kit';
import type { SkillRow } from './SkillCard';
import { SPECIALIST_AGENTS } from '@/components/chat/ChatAgentSquadSelector';

interface SkillIntegrationBarProps {
  row: SkillRow;
  workspaceId: string;
}

/**
 * Maps a skill slug or name to its primary Specialist Agent.
 */
export function getAgentForSkill(skillName: string): {
  id: string;
  name: string;
  role: string;
  badgeClass: string;
} {
  const name = (skillName || '').toLowerCase();

  if (
    name.includes('ats-audit') ||
    name.includes('ats-optimizer') ||
    name.includes('semantic-ats')
  ) {
    const a = SPECIALIST_AGENTS.find((agent) => agent.id === 'ats')!;
    return { id: a.id, name: a.name, role: a.role, badgeClass: a.badgeClass };
  }

  if (name.includes('job-discovery') || name.includes('job-description')) {
    const a = SPECIALIST_AGENTS.find((agent) => agent.id === 'job_search')!;
    return { id: a.id, name: a.name, role: a.role, badgeClass: a.badgeClass };
  }

  if (
    name.includes('form-filler') ||
    name.includes('cold-email') ||
    name.includes('cover-letter')
  ) {
    const a = SPECIALIST_AGENTS.find((agent) => agent.id === 'application')!;
    return { id: a.id, name: a.name, role: a.role, badgeClass: a.badgeClass };
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
    const a = SPECIALIST_AGENTS.find((agent) => agent.id === 'career')!;
    return { id: a.id, name: a.name, role: a.role, badgeClass: a.badgeClass };
  }

  if (name.includes('resume') || name.includes('cv')) {
    const a = SPECIALIST_AGENTS.find((agent) => agent.id === 'resume')!;
    return { id: a.id, name: a.name, role: a.role, badgeClass: a.badgeClass };
  }

  return {
    id: 'general',
    name: 'Autonomous Agent Orchestrator',
    role: 'Full Lifecycle',
    badgeClass: 'bg-primary/10 text-primary border-primary/30',
  };
}

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return {
      push: (_url: string) => {},
      replace: (_url: string) => {},
      prefetch: (_url: string) => {},
    };
  }
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
    const query = new URLSearchParams({
      agent: agent.id,
      prompt: defaultPrompt,
    });
    router.push(`/workspace/${workspaceId}/chat?${query.toString()}`);
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-hover/20 p-3 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Cross-Page Agent Wiring:
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${agent.badgeClass}`}
          >
            <span>🤖</span>
            <span>{agent.name}</span>
            <span className="opacity-70 font-mono">({agent.role})</span>
          </span>
        </div>

        {/* Integration Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            size="sm"
            variant="primary"
            onClick={handleLaunchChat}
            className="text-xs h-7 px-3 flex items-center gap-1"
          >
            <span>💬 Launch in Chat</span>
          </Button>

          {requiresMemory && (
            <Link
              href={`/workspace/${workspaceId}/memory`}
              className="inline-flex items-center gap-1 text-2xs font-medium text-text-secondary hover:text-primary px-2.5 py-1 rounded-md border border-border hover:border-primary/40 bg-surface transition-colors"
            >
              <span>🧠 Vault Grounding</span>
            </Link>
          )}

          {isDocumentSkill && (
            <Link
              href={`/workspace/${workspaceId}/files`}
              className="inline-flex items-center gap-1 text-2xs font-medium text-text-secondary hover:text-primary px-2.5 py-1 rounded-md border border-border hover:border-primary/40 bg-surface transition-colors"
            >
              <span>📄 Documents Hub</span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-2xs text-text-muted pt-1 border-t border-border/40 font-mono">
        <span className="truncate">
          Triggers routed via: <strong className="text-text">{agent.name}</strong>
        </span>
        <span className="shrink-0 text-text-secondary">
          Scope: <code className="text-primary font-bold">{row.item.requiredScope || 'none'}</code>
        </span>
      </div>
    </div>
  );
};
