import React from 'react';

export default function WorkspacePickerLoading() {
  return (
    <div
      role="status"
      aria-label="Loading workspaces"
      className="p-8 max-w-4xl mx-auto space-y-8 animate-pulse"
    >
      <div className="space-y-2 pb-6 border-b border-border">
        <div className="h-8 w-56 bg-surface-200 rounded-lg" />
        <div className="h-4 w-72 bg-surface-200 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-200" />
              <div className="space-y-1">
                <div className="h-5 w-32 bg-surface-200 rounded" />
                <div className="h-3 w-20 bg-surface-200 rounded" />
              </div>
            </div>
            <div className="h-3 w-40 bg-surface-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
