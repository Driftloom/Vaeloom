import React from 'react';
import { CpuIcon, CheckIcon, AlertCircleIcon } from '../../icons';

export interface AgentRunStep {
  id: string;
  name: string;
  type: 'tool' | 'llm' | 'memory' | 'guardrail';
  status: 'completed' | 'failed' | 'running';
  durationMs: number;
}

export interface AgentRunProps {
  id: string;
  agentName: string;
  trigger: string;
  startTime: string;
  status: 'success' | 'failed' | 'running';
  totalDuration: string;
  steps: AgentRunStep[];
  className?: string;
}

export const AgentRun: React.FC<AgentRunProps> = ({
  id,
  agentName,
  trigger,
  startTime,
  status,
  totalDuration,
  steps,
  className = '',
}) => {
  return (
    <div
      className={`rounded-lg border border-border-subtle bg-surface p-4 text-xs ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <CpuIcon size={14} className="text-accent" />
          <span className="font-semibold text-text">{agentName}</span>
          <span className="text-text-muted font-mono">#{id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-secondary tabular-nums">{totalDuration}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-2xs uppercase font-semibold ${
              status === 'success'
                ? 'bg-success/15 text-success'
                : status === 'failed'
                  ? 'bg-error/15 text-error'
                  : 'bg-info/15 text-info'
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="text-text-muted mb-3">
        Trigger: <span className="text-text-secondary">{trigger}</span> at{' '}
        <span className="tabular-nums">{startTime}</span>
      </div>

      <div className="space-y-1.5 border-t border-border-subtle pt-2.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center justify-between py-1 px-2 rounded bg-surface-200 font-mono text-xs"
          >
            <div className="flex items-center gap-2">
              {step.status === 'completed' ? (
                <CheckIcon size={12} className="text-success" />
              ) : step.status === 'failed' ? (
                <AlertCircleIcon size={12} className="text-error" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
              <span className="text-text">{step.name}</span>
              <span className="text-text-muted text-2xs">({step.type})</span>
            </div>
            <span className="text-text-muted tabular-nums">{step.durationMs}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
};

AgentRun.displayName = 'AgentRun';
