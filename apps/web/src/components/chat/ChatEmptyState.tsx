'use client';

import React from 'react';
import type { LoadState } from './chat-api';
import type { SlashCommand } from './types';

export interface ChatEmptyStateProps {
  commands: SlashCommand[];
  commandsState: LoadState;
  commandsError?: string;
  onPickCommand: (trigger: string, agent: string) => void;
  onSend: (text: string) => void;
  activeAgent?: string;
}

const MAX_VISIBLE_COMMANDS = 8;
const UNAVAILABLE_MESSAGE = 'Agent commands are unavailable right now';

interface PromptStarter {
  label: string;
  prompt: string;
  category: 'all' | 'career' | 'vault' | 'docs';
  agentTag?: string;
}

const ALL_STARTERS: PromptStarter[] = [
  {
    label: 'Run ATS Resume Audit',
    prompt: 'Audit my resume for ATS parseability, heading structure, and keyword density.',
    category: 'career',
    agentTag: 'resume',
  },
  {
    label: 'Optimize Experience Bullets',
    prompt: 'Transform my experience bullets into quantified impact statements with metrics.',
    category: 'career',
    agentTag: 'resume',
  },
  {
    label: 'Query Memory & Vault',
    prompt: 'What key insights, projects, and notes are in my Memory and Obsidian vault?',
    category: 'vault',
  },
  {
    label: 'Summarise Uploaded Document',
    prompt: 'Summarise the uploaded document into key entities, decisions, and action items.',
    category: 'docs',
  },
  {
    label: 'Plan Targeted Job Search',
    prompt:
      'Help me plan a strategic job search campaign step by step. Ask clarifying questions first.',
    category: 'career',
  },
  {
    label: 'What can you do?',
    prompt: 'What can you do here? Which agents are available to me?',
    category: 'all',
  },
];

export function ChatEmptyState({
  commands,
  commandsState,
  commandsError,
  onPickCommand,
  onSend,
  activeAgent,
}: ChatEmptyStateProps): JSX.Element {
  const [activeCategory, setActiveCategory] = React.useState<'all' | 'career' | 'vault' | 'docs'>(
    'all',
  );
  const visibleCommands = commands.slice(0, MAX_VISIBLE_COMMANDS);

  const isResumeAgent = activeAgent === 'resume' || activeAgent === 'resume_agent';

  const filteredStarters = ALL_STARTERS.filter((s) => {
    if (isResumeAgent) {
      return s.category === 'career' || s.agentTag === 'resume' || s.category === 'all';
    }
    if (activeCategory === 'all') return true;
    return s.category === activeCategory;
  });

  return (
    <div className="py-8 md:py-14 text-center max-w-2xl mx-auto px-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-200 text-base font-bold text-text shadow-sm border border-border/60">
        V
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold text-text tracking-tight">
        How can we help?
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Ask anything, or mention <span className="font-mono text-primary">@agent</span> and run{' '}
        <span className="font-mono text-primary">/command</span>
      </p>

      {/* Deep-link banner when resume agent is selected */}
      {isResumeAgent && (
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-action/40 bg-action/10 text-xs text-action font-medium">
          <span>⚡</span>
          <span>Resume & Career Focused — Grounded with verified CV templates</span>
        </div>
      )}

      {/* Category Filter Pills (if not auto-pinned to resume agent) */}
      {!isResumeAgent && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
          {[
            { id: 'all', label: 'All Prompts' },
            { id: 'career', label: 'Career & ATS' },
            { id: 'vault', label: 'Obsidian Vault' },
            { id: 'docs', label: 'Documents' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as 'all' | 'career' | 'vault' | 'docs')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-action text-action-fg'
                  : 'bg-surface-100 text-text-muted hover:text-text hover:bg-surface-200 border border-border/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Dynamic Starters Grid */}
      <div className="mt-6">
        <p className="text-2xs uppercase tracking-widest text-text-dim mb-3 font-semibold">
          Recommended Starters
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {filteredStarters.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onSend(p.prompt)}
              className="rounded-full border border-border/60 bg-surface-50 px-4 py-2 text-xs font-medium text-text transition-all hover:bg-surface-hover hover:border-action/40 hover:shadow-xs active:bg-surface-200 motion-reduce:transition-none"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Slash Commands Grid */}
      <div className="mt-8 pt-6 border-t border-border/40">
        <p className="text-2xs uppercase tracking-widest text-text-dim mb-3 font-semibold">
          Agent Commands
        </p>
        {commandsState === 'loading' ? (
          <p role="status" className="text-xs text-text-dim">
            Loading commands…
          </p>
        ) : commandsState === 'error' ? (
          <p className="text-xs text-text-dim">
            {commandsError !== undefined && commandsError.trim().length > 0
              ? commandsError
              : UNAVAILABLE_MESSAGE}
          </p>
        ) : visibleCommands.length === 0 ? (
          <p className="text-xs text-text-dim">No commands published for this workspace.</p>
        ) : (
          <div
            role="group"
            aria-label="Agent commands"
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {visibleCommands.map((c) => {
              const desc = c.description || c.desc || '';
              return (
                <button
                  key={c.trigger}
                  type="button"
                  onClick={() => onPickCommand(c.trigger, c.agent)}
                  title={desc.length > 0 ? desc : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-50 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover hover:border-border hover:text-text active:bg-surface-200 motion-reduce:transition-none"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.color ?? 'bg-action'}`}
                  />
                  <span className="font-mono text-text-muted hover:text-text">{c.trigger}</span>
                  {desc && (
                    <span className="hidden sm:inline text-text-dim text-[11px]">
                      · {desc.slice(0, 24)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
