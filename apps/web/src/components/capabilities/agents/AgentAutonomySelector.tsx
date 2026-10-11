'use client';

import React from 'react';
import { Badge, Tooltip } from '@vaeloom/ui-kit';
import {
  CAPABILITY_MAX_REACT_ROUNDS_KEY,
  MAX_REACT_ROUNDS,
  MIN_REACT_ROUNDS,
} from '@/lib/api-client';
import {
  AUTONOMY_OPTIONS,
  DEFAULT_REACT_ROUNDS,
  REACT_ROUNDS_PRECEDENCE,
  type AutonomyMode,
  type ReactRoundsSetting,
} from './types';

export interface AgentAutonomySelectorProps {
  autonomyMode: AutonomyMode;
  disabled?: boolean;
  onAutonomyChange: (mode: AutonomyMode) => void;
}

/**
 * Selector for autonomy mode ('suggest', 'autonomous', 'approval_required').
 */
export const AgentAutonomySelector: React.FC<AgentAutonomySelectorProps> = ({
  autonomyMode,
  disabled = false,
  onAutonomyChange,
}) => {
  return (
    <fieldset
      className="flex items-center p-0.5 rounded-lg bg-surface-elevated border border-border"
      aria-label="Agent autonomy"
    >
      <legend className="sr-only">Agent autonomy</legend>
      {AUTONOMY_OPTIONS.map((option) => {
        const isActive = autonomyMode === option.value;
        return (
          <Tooltip key={option.value} content={option.hint}>
            <button
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => onAutonomyChange(option.value)}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-elevated disabled:opacity-60 ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {option.label}
            </button>
          </Tooltip>
        );
      })}
    </fieldset>
  );
};

export interface AgentReactRoundsBudgetProps {
  roundsText: string;
  reactRounds: ReactRoundsSetting;
  storedRounds: {
    state: 'honoured' | 'rejected' | 'absent';
    rounds?: number;
    stored?: unknown;
    reason?: string;
  };
  agentCapabilityRowsError: Error | null;
  onRoundsTextChange: (value: string) => void;
  onCommitRounds: () => void;
}

/**
 * ReAct round budget panel and control with server precedence explanation.
 */
export const AgentReactRoundsBudget: React.FC<AgentReactRoundsBudgetProps> = ({
  roundsText,
  reactRounds,
  storedRounds,
  agentCapabilityRowsError,
  onRoundsTextChange,
  onCommitRounds,
}) => {
  return (
    <div
      role="group"
      aria-labelledby="react-rounds-heading"
      className="p-4 rounded-xl bg-surface border border-border space-y-2.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id="react-rounds-heading" className="text-xs font-semibold text-text">
            ReAct round budget
          </h4>
          <p className="text-2xs text-text-muted mt-1 leading-relaxed">{REACT_ROUNDS_PRECEDENCE}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="agent-react-rounds" className="text-2xs font-sans text-text-muted">
            Max rounds
          </label>
          <input
            id="agent-react-rounds"
            type="number"
            step={1}
            inputMode="numeric"
            min={MIN_REACT_ROUNDS}
            max={MAX_REACT_ROUNDS}
            value={roundsText}
            disabled={reactRounds.saving}
            aria-invalid={reactRounds.issue !== null}
            aria-describedby="agent-react-rounds-state"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onRoundsTextChange(e.target.value);
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitRounds();
              }
            }}
            onBlur={onCommitRounds}
            className="w-16 bg-surface-elevated border border-border rounded px-2 py-1 text-xs font-mono text-text text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-primary disabled:opacity-60"
          />
          <Badge
            variant={
              reactRounds.issue !== null
                ? 'error'
                : reactRounds.rounds !== null
                  ? 'success'
                  : 'warning'
            }
            size="sm"
          >
            {reactRounds.issue !== null
              ? 'Not saved'
              : reactRounds.rounds !== null
                ? `Saved: ${reactRounds.rounds}`
                : 'Not set on this row'}
          </Badge>
        </div>
      </div>

      <p
        id="agent-react-rounds-state"
        role="status"
        className="text-2xs leading-relaxed text-text-muted"
      >
        {reactRounds.issue !== null ? (
          <span className="text-error">{reactRounds.issue} Nothing was written.</span>
        ) : storedRounds.state === 'rejected' ? (
          <span className="text-warning">
            This row stores{' '}
            <code className="font-mono">
              {CAPABILITY_MAX_REACT_ROUNDS_KEY}={String(storedRounds.stored)}
            </code>
            , which the resolver rejects: {storedRounds.reason} The run falls back to the agent
            card, then AGENT_MAX_REACT_ROUNDS, then 5.
          </span>
        ) : agentCapabilityRowsError ? (
          <span className="text-error">
            This workspace&apos;s capability rows could not be read (
            {agentCapabilityRowsError.message}), so what the row holds is unknown. The input was not
            seeded from it.
          </span>
        ) : storedRounds.state === 'absent' ? (
          <>
            No <code className="font-mono">{CAPABILITY_MAX_REACT_ROUNDS_KEY}</code> on this
            agent&apos;s row, so this row contributes nothing and the run uses the agent card, then
            the server setting, then 5. {DEFAULT_REACT_ROUNDS} in the box is a form default, not a
            stored value.
          </>
        ) : (
          <>
            Stored as{' '}
            <code className="font-mono">
              {CAPABILITY_MAX_REACT_ROUNDS_KEY}={reactRounds.rounds}
            </code>{' '}
            on this workspace&apos;s <code className="font-mono">agent</code> row, and this is the
            layer the run resolves first. The run log records the deciding layer as{' '}
            <code className="font-mono">REACT_ROUNDS … source=</code>.
          </>
        )}
      </p>
    </div>
  );
};
