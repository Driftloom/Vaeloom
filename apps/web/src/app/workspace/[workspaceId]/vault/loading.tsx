import React from 'react';

export default function VaultLoading() {
  return (
    <div
      role="status"
      aria-label="Loading security vault"
      className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface-200 rounded-lg" />
          <div className="h-4 w-80 bg-surface-200 rounded" />
        </div>
        <div className="h-9 w-32 bg-surface-200 rounded-lg" />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-card divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-200 shrink-0" />
              <div className="space-y-1">
                <div className="h-4 w-40 bg-surface-200 rounded" />
                <div className="h-3 w-56 bg-surface-200 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-20 bg-surface-200 rounded-full" />
              <div className="h-8 w-8 bg-surface-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
