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
  low: 'text-success bg-success/15 border-success/30',
  medium: 'text-warning bg-warning/15 border-warning/30',
  high: 'text-error bg-error/15 border-error/30',
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
      className={`rounded-lg border border-border-subtle bg-surface p-4 shadow-sm ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-surface-200 text-accent">
            <ShieldIcon size={16} />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-text">{title}</h4>
            <p className="text-xs text-text-muted">Proposed by {agentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xs uppercase font-semibold px-2 py-0.5 rounded border ${iStyle}`}>
            {impactLevel} impact
          </span>
          {!isReversible && (
            <span className="text-2xs px-2 py-0.5 rounded bg-error/15 text-error border border-error/30 flex items-center gap-1">
              <AlertTriangleIcon size={10} /> Irreversible
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed mb-3">{description}</p>

      {payloadPreview && (
        <pre className="text-xs font-mono p-2.5 rounded bg-surface-100 border border-border-subtle text-text-muted overflow-x-auto mb-3 max-h-32">
          {payloadPreview}
        </pre>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-subtle">
        <div>
          {onInspect && (
            <button
              type="button"
              onClick={() => onInspect(id)}
              className="text-xs text-text-muted hover:text-text underline"
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
