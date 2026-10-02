import React from 'react';

import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-border bg-surface/30 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center text-text-muted mb-4">
          {icon}
        </div>
      )}
      {/* D-R3: rendered directly under a route's page-level <h1>, so this is the
      section level. As <h3> it produced an h1->h3 heading-order skip for every
      empty route. Tailwind preflight unstyles headings and the explicit classes
      set size/weight, so the tag change is pixel-identical. */}
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-text-muted max-w-sm leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button variant={action.variant || 'primary'} size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};
