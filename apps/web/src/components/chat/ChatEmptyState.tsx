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
}

const MAX_VISIBLE_COMMANDS = 6;

const UNAVAILABLE_MESSAGE = 'Agent commands are unavailable right now';

/**
 * Read-only, non-destructive. Every prompt below only asks a question or states
 * an intent, so an accidental click costs nothing; the previous set fired
 * `/organize` and `/resume` — real billable agent runs against the user's own
 * workspace — off a single unlabelled tap, and named a real company.
 */
const EXAMPLE_PROMPTS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: 'What can you do?',
    prompt: 'What can you do here? Which agents are available to me?',
  },
  {
    label: 'Query Memory & Vault',
    prompt: 'What key insights, projects, and notes are in my Memory and Obsidian vault?',
  },
  {
    label: 'Summarise a document I upload',
    prompt: 'Summarise the document I upload as key entities and action items.',
  },
  {
    label: 'Help me plan a job search',
    prompt: 'Help me plan a job search step by step. Ask me what to clarify first.',
  },
];

export function ChatEmptyState({
  commands,
  commandsState,
  commandsError,
  onPickCommand,
  onSend,
}: ChatEmptyStateProps): JSX.Element {
  const visibleCommands = commands.slice(0, MAX_VISIBLE_COMMANDS);

  return (
    <div className="py-10 text-center md:py-16">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-200 text-sm font-bold text-text">
        V
      </div>
      <h2 className="mt-4 font-display text-xl font-medium text-text">How can we help?</h2>
      <p className="mt-1 text-sm text-text-muted">
        Ask anything, or use <span className="font-mono text-text">/</span> and{' '}
        <span className="font-mono text-text">@</span>
      </p>

      <div className="mt-8">
        <p className="text-2xs uppercase tracking-widest text-text-dim">Example prompts</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onSend(p.prompt)}
              className="rounded-full border border-border/50 bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-surface-hover motion-reduce:transition-none"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
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
            className="flex flex-wrap items-center justify-center gap-1.5"
          >
            {visibleCommands.map((c) => (
              <button
                key={c.trigger}
                type="button"
                onClick={() => onPickCommand(c.trigger, c.agent)}
                title={c.desc.length > 0 ? c.desc : undefined}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text motion-reduce:transition-none"
              >
                {/* Backend-owned colour; the frontend used to keep a duplicate of
                    the Python palette, which is guaranteed to drift. */}
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.color ?? 'bg-primary'}`}
                />
                <span className="font-mono text-text-muted">{c.trigger}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
