import React from 'react';

export default function JobsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading job opportunities"
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface-200 rounded-lg" />
          <div className="h-4 w-72 bg-surface-200 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-40 bg-surface-200 rounded-lg" />
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-border-subtle">
        <div className="h-8 w-24 bg-surface-200 rounded-full" />
        <div className="h-8 w-28 bg-surface-200 rounded-full" />
        <div className="h-8 w-20 bg-surface-200 rounded-full" />
        <div className="h-8 w-32 bg-surface-200 rounded-full" />
      </div>

      {/* Job Cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="h-5 w-56 bg-surface-200 rounded" />
                <div className="h-4 w-36 bg-surface-200 rounded" />
              </div>
              <div className="h-7 w-20 bg-surface-200 rounded-full" />
            </div>
            <div className="h-3.5 w-3/4 bg-surface-200 rounded" />
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-surface-200 rounded-md" />
                <div className="h-6 w-20 bg-surface-200 rounded-md" />
                <div className="h-6 w-14 bg-surface-200 rounded-md" />
              </div>
              <div className="h-8 w-28 bg-surface-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
