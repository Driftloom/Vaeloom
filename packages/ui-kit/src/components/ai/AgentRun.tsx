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
      className={`rounded-lg border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-surface,#111114)] p-4 text-xs ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <CpuIcon size={14} className="text-[var(--color-ai-accent,#6366f1)]" />
          <span className="font-semibold text-[var(--color-text-primary,#f4f4f5)]">
            {agentName}
          </span>
          <span className="text-[var(--color-text-muted,#71717a)] font-mono">
            #{id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-secondary,#a1a1aa)] tabular-nums">
            {totalDuration}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-2xs uppercase font-semibold ${
              status === 'success'
                ? 'bg-emerald-950/40 text-emerald-300'
                : status === 'failed'
                  ? 'bg-red-950/40 text-red-300'
                  : 'bg-blue-950/40 text-blue-300'
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="text-[var(--color-text-muted,#71717a)] mb-3">
        Trigger: <span className="text-[var(--color-text-secondary,#a1a1aa)]">{trigger}</span> at{' '}
        <span className="tabular-nums">{startTime}</span>
      </div>

      <div className="space-y-1.5 border-t border-[var(--color-border-subtle,#27272a)] pt-2.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center justify-between py-1 px-2 rounded bg-surface-200 font-mono text-xs"
          >
            <div className="flex items-center gap-2">
              {step.status === 'completed' ? (
                <CheckIcon size={12} className="text-emerald-400" />
              ) : step.status === 'failed' ? (
                <AlertCircleIcon size={12} className="text-red-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              )}
              <span className="text-[var(--color-text-primary,#f4f4f5)]">{step.name}</span>
              <span className="text-text-muted text-2xs">({step.type})</span>
            </div>
            <span className="text-[var(--color-text-muted,#71717a)] tabular-nums">
              {step.durationMs}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

AgentRun.displayName = 'AgentRun';
