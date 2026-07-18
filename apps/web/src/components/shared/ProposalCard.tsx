import React from 'react';

export interface ProposalCardProps {
  id: string;
  agentName: string;
  description: string | React.ReactNode;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ProposalCard({ id, agentName, description, onApprove, onReject }: ProposalCardProps) {
  return (
    <div className="card mb-4 border-primary/30 bg-primary/5 flex flex-col gap-3" role="region" aria-label={`${agentName} proposal`}>
      <div className="flex items-center gap-2">
        <span className="text-primary text-xl">💡</span>
        <span className="text-xs uppercase tracking-wider text-primary font-mono">{agentName} Suggests</span>
      </div>
      
      <div className="text-text">
        {description}
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        <button 
          onClick={() => onApprove(id)} 
          className="btn-primary flex-1"
          autoFocus
        >
          Approve
        </button>
        <button 
          onClick={() => onReject(id)} 
          className="btn-secondary flex-1"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
