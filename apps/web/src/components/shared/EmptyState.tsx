import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]" role="status">
      <div className="text-text-muted mb-4 text-4xl">
        {icon || '📂'}
      </div>
      <h2 className="text-xl font-display font-medium mb-2 text-text">{title}</h2>
      <p className="text-text-muted max-w-sm mb-6">{description}</p>
      {action && (
        <button className="btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
