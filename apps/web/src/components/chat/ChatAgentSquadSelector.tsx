'use client';

import React from 'react';

export interface SpecialistAgentDef {
  id: string;
  name: string;
  role: string;
  color: string;
  badgeClass: string;
  description: string;
}

export const SPECIALIST_AGENTS: SpecialistAgentDef[] = [
  {
    id: 'resume',
    name: 'Resume Specialist',
    role: 'Document Tailoring',
    color: '#3B82F6',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    description: 'Tailors resumes to job targets with quantifiable achievements and formatting.',
  },
  {
    id: 'ats',
    name: 'ATS Auditor',
    role: 'Score & Keywords',
    color: '#10B981',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Audits semantic keyword density, parseability, and heading compatibility.',
  },
  {
    id: 'job_search',
    name: 'Job Search Scout',
    role: 'Market Sourcing',
    color: '#8B5CF6',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    description: 'Finds verified openings, validates application links, and extracts requirements.',
  },
  {
    id: 'career',
    name: 'Career Strategist',
    role: 'Interview & Paths',
    color: '#F59E0B',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Executive interview coaching, compensation framing, and career roadmaps.',
  },
  {
    id: 'application',
    name: 'Application Agent',
    role: 'Submissions & Outreach',
    color: '#EC4899',
    badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    description: 'Tailors cover letters, prepares portfolio briefs, and drafts recruiter messages.',
  },
];

export interface ChatAgentSquadSelectorProps {
  selectedSquad: string[];
  onToggleAgent: (agentId: string) => void;
  onSelectSquad: (squad: string[]) => void;
}

export function ChatAgentSquadSelector({
  selectedSquad,
  onToggleAgent,
  onSelectSquad,
}: ChatAgentSquadSelectorProps): JSX.Element {
  const isMultiAgent = selectedSquad.length > 1;

  const presets = [
    { label: 'Single Agent (Auto)', squad: [] },
    { label: 'ATS & Resume Duo', squad: ['resume', 'ats'] },
    { label: 'Job Hunt Blitz', squad: ['job_search', 'application'] },
    { label: 'Career Campaign Squad', squad: ['resume', 'ats', 'job_search', 'career'] },
  ];

  return (
    <div className="space-y-3 p-3 rounded-xl border border-border/50 bg-surface-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text flex items-center gap-1.5">
            Specialist Agent Squad
            {isMultiAgent && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-action/15 text-action border border-action/30 animate-pulse">
                ⚡ Parallel Mode ({selectedSquad.length} Agents)
              </span>
            )}
          </h2>
          <p className="text-[11px] text-text-dim">
            Select specialists to execute concurrently and synthesize insights.
          </p>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1 flex-wrap">
          {presets.map((preset) => {
            const isPresetActive =
              (preset.squad.length === 0 && selectedSquad.length === 0) ||
              (preset.squad.length > 0 &&
                preset.squad.length === selectedSquad.length &&
                preset.squad.every((a) => selectedSquad.includes(a)));

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onSelectSquad(preset.squad)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  isPresetActive
                    ? 'border-action bg-action text-action-fg'
                    : 'border-border/60 bg-surface-100 text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Specialist Agent Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {SPECIALIST_AGENTS.map((agent) => {
          const isSelected = selectedSquad.includes(agent.id);

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onToggleAgent(agent.id)}
              className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                isSelected
                  ? 'border-action bg-action/10 ring-1 ring-action/40'
                  : 'border-border/50 bg-surface-100 hover:border-border hover:bg-surface-hover'
              }`}
              data-testid={`squad-agent-toggle-${agent.id}`}
              aria-pressed={isSelected}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: agent.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-text truncate">{agent.name}</span>
                  <span className="text-[10px] font-mono text-text-dim shrink-0">
                    {isSelected ? '✓ Active' : '+ Add'}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-text-muted mt-0.5">{agent.role}</p>
                <p className="text-[11px] text-text-dim line-clamp-2 mt-1">{agent.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
