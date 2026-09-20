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
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-border-subtle bg-surface text-xs text-text ${className}`.trim()}
    >
      <StatusDot status={statusColorMap[status]} pulse={status === 'running'} />
      <span className="font-medium">{name}</span>
      <span className="text-text-muted capitalize">({status.replace('_', ' ')})</span>
      {duration && (
        <span className="text-text-secondary tabular-nums border-l border-border-subtle pl-2">
          {duration}
        </span>
      )}
      {cost && <span className="text-text-secondary tabular-nums">{cost}</span>}
      {model && (
        <span className="text-2xs bg-surface-200 px-1.5 py-0.5 rounded text-text-muted font-mono">
          {model}
        </span>
      )}
    </div>
  );
};

AgentStatus.displayName = 'AgentStatus';
