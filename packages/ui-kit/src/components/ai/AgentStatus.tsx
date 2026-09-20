import React from 'react';
import { CpuIcon, BrainIcon } from '../../icons';
import { StatusDot, StatusDotType } from '../StatusDot';

export interface AgentStatusProps {
  name: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'error' | 'paused';
  duration?: string;
  cost?: string;
  model?: string;
  className?: string;
}

const statusColorMap: Record<AgentStatusProps['status'], StatusDotType> = {
  idle: 'idle',
  running: 'active',
  waiting_approval: 'warning',
  error: 'error',
  paused: 'disabled',
};

export const AgentStatus: React.FC<AgentStatusProps> = ({
  name,
  status,
  duration,
  cost,
  model,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-surface,#111114)] text-xs text-[var(--color-text-primary,#f4f4f5)] ${className}`.trim()}
    >
      <StatusDot status={statusColorMap[status]} pulse={status === 'running'} />
      <span className="font-medium">{name}</span>
      <span className="text-[var(--color-text-muted,#71717a)] capitalize">
        ({status.replace('_', ' ')})
      </span>
      {duration && (
        <span className="text-[var(--color-text-secondary,#a1a1aa)] tabular-nums border-l border-[var(--color-border-subtle,#27272a)] pl-2">
          {duration}
        </span>
      )}
      {cost && (
        <span className="text-[var(--color-text-secondary,#a1a1aa)] tabular-nums">{cost}</span>
      )}
      {model && (
        <span className="text-[10px] bg-[var(--color-bg-elevated,#18181c)] px-1.5 py-0.5 rounded text-[var(--color-text-muted,#71717a)] font-mono">
          {model}
        </span>
      )}
    </div>
  );
};

AgentStatus.displayName = 'AgentStatus';
