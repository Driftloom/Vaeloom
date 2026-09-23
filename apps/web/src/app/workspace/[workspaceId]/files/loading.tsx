import React from 'react';

export default function FilesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace documents"
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface-200 rounded-lg" />
          <div className="h-4 w-80 bg-surface-200 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-44 bg-surface-200 rounded-lg" />
          <div className="h-9 w-32 bg-surface-200 rounded-lg" />
        </div>
      </div>

      {/* Upload Zone Shimmer */}
      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-8 flex flex-col items-center justify-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-surface-200" />
        <div className="h-4 w-48 bg-surface-200 rounded" />
        <div className="h-3 w-32 bg-surface-200 rounded" />
      </div>

      {/* Files Table Shimmer */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-card divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-200" />
              <div className="space-y-1">
                <div className="h-4 w-48 bg-surface-200 rounded" />
                <div className="h-3 w-24 bg-surface-200 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-6 w-20 bg-surface-200 rounded-full" />
              <div className="h-8 w-8 bg-surface-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
