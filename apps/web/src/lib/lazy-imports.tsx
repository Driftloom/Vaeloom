import React from 'react';

export function LoadingFallback({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px] text-text-muted text-sm font-mono">
      {text}
    </div>
  );
}
