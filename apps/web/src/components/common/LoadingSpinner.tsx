import React from 'react';
import { Spinner } from '@vaeloom/ui-kit';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const PIXEL_SIZES: Record<'sm' | 'md' | 'lg', number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  text,
}) => {
  const px = PIXEL_SIZES[size] ?? 24;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 max-w-full ${className}`}>
      <div
        style={{
          width: `${px}px`,
          height: `${px}px`,
          maxWidth: `${px}px`,
          maxHeight: `${px}px`,
        }}
        className="shrink-0 flex items-center justify-center"
      >
        <Spinner size={size} />
      </div>
      {text && <p className="text-sm text-text-muted select-none">{text}</p>}
    </div>
  );
};
