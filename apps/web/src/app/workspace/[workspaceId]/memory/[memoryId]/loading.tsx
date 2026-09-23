import React from 'react';

export default function MemoryItemLoading() {
  return (
    <div
      role="status"
      aria-label="Loading memory details"
      className="p-6 max-w-4xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="h-8 w-8 bg-surface-200 rounded-lg" />
        <div className="space-y-1">
          <div className="h-7 w-48 bg-surface-200 rounded" />
          <div className="h-4 w-32 bg-surface-200 rounded" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
        <div className="h-5 w-36 bg-surface-200 rounded" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-surface-200 rounded" />
          <div className="h-4 w-5/6 bg-surface-200 rounded" />
          <div className="h-4 w-4/6 bg-surface-200 rounded" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
        <div className="h-5 w-40 bg-surface-200 rounded" />
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-24 bg-surface-200 rounded-full" />
          <div className="h-6 w-28 bg-surface-200 rounded-full" />
          <div className="h-6 w-20 bg-surface-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}
