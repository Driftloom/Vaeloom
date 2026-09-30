'use client';

import React from 'react';
import { AlertCircleIcon } from '@vaeloom/ui-kit';

/**
 * Pieces shared by the agent fleet list and the single-agent inspector.
 *
 * Both routes render the same memory-scope pill row and the same "catalog
 * unavailable" card, and the copies had drifted (different padding, different
 * retry label). Colocating them here keeps one definition without pulling agent
 * concerns into the global component library.
 */

export interface AgentMemoryScopes {
  readTypes: string[];
  writeTypes: string[];
}

export function ScopePills({ scopes }: { scopes: AgentMemoryScopes }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {scopes.readTypes.map((t) => (
        <span
          key={`r-${t}`}
          className="rounded bg-success/10 border border-success/30 px-2 py-0.5 text-xs text-success"
        >
          read:{t}
        </span>
      ))}
      {scopes.writeTypes.map((t) => (
        <span
          key={`w-${t}`}
          className="rounded bg-warning/10 border border-warning/30 px-2 py-0.5 text-xs text-warning"
        >
          write:{t}
        </span>
      ))}
      {scopes.readTypes.length === 0 && scopes.writeTypes.length === 0 && (
        <span className="text-xs text-text-dim">no memory scope</span>
      )}
    </div>
  );
}

export function AgentErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: {
  title: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center card ${className}`}
      role="alert"
    >
      <div className="p-3 rounded-full bg-error/10 text-error mb-3" aria-hidden="true">
        <AlertCircleIcon size={32} />
      </div>
      <p className="text-text font-medium text-lg">{title}</p>
      <p className="text-sm text-text-muted mt-1 max-w-md">{message}</p>
      <button onClick={onRetry} className="btn-secondary mt-5">
        {retryLabel}
      </button>
    </div>
  );
}
