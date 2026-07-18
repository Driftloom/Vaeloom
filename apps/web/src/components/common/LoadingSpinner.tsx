import React from 'react';
import { Spinner } from '@vaeloom/ui-kit';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '', text }) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner size={size} />
      {text && <p className="text-sm text-surface-500">{text}</p>}
    </div>
  );
};
