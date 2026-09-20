import React from 'react';
import { ShieldIcon, CheckIcon, XIcon, AlertTriangleIcon } from '../../icons';
import { Button } from '../Button';

export interface AgentProposalProps {
  id: string;
  agentName: string;
  title: string;
  description: string;
  payloadPreview?: string;
  impactLevel?: 'low' | 'medium' | 'high';
  isReversible?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onInspect?: (id: string) => void;
  className?: string;
}

const impactStyles = {
  low: 'text-[var(--color-status-success,#10b981)] bg-emerald-950/20 border-emerald-800/30',
  medium: 'text-[var(--color-status-warning,#f59e0b)] bg-amber-950/20 border-amber-800/30',
  high: 'text-[var(--color-status-danger,#ef4444)] bg-red-950/20 border-red-800/30',
};

export const AgentProposal: React.FC<AgentProposalProps> = ({
  id,
  agentName,
  title,
  description,
  payloadPreview,
  impactLevel = 'low',
  isReversible = true,
  onApprove,
  onReject,
  onInspect,
  className = '',
}) => {
  const iStyle = impactStyles[impactLevel] || impactStyles.low;

  return (
    <div
      className={`rounded-lg border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-surface,#111114)] p-4 shadow-sm ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-[var(--color-bg-elevated,#18181c)] text-[var(--color-ai-accent,#6366f1)]">
            <ShieldIcon size={16} />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary,#f4f4f5)]">
              {title}
            </h4>
            <p className="text-xs text-[var(--color-text-muted,#71717a)]">
              Proposed by {agentName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${iStyle}`}
          >
            {impactLevel} impact
          </span>
          {!isReversible && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/30 text-red-400 border border-red-800/30 flex items-center gap-1">
              <AlertTriangleIcon size={10} /> Irreversible
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-secondary,#a1a1aa)] leading-relaxed mb-3">
        {description}
      </p>

      {payloadPreview && (
        <pre className="text-xs font-mono p-2.5 rounded bg-[var(--color-bg-canvas,#08080a)] border border-[var(--color-border-subtle,#27272a)] text-[var(--color-text-muted,#71717a)] overflow-x-auto mb-3 max-h-32">
          {payloadPreview}
        </pre>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-border-subtle,#27272a)]">
        <div>
          {onInspect && (
            <button
              type="button"
              onClick={() => onInspect(id)}
              className="text-xs text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] underline"
            >
              Inspect Telemetry
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onReject(id)}>
            Reject
          </Button>
          <Button variant="primary" size="sm" onClick={() => onApprove(id)}>
            Authorize & Execute
          </Button>
        </div>
      </div>
    </div>
  );
};

AgentProposal.displayName = 'AgentProposal';
