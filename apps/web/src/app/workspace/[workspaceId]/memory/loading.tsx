import React from 'react';

export default function MemoryLoading() {
  return (
    <div
      role="status"
      aria-label="Loading memory graph"
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-surface-200 rounded-lg" />
          <div className="h-4 w-80 bg-surface-200 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-44 bg-surface-200 rounded-lg" />
          <div className="h-9 w-32 bg-surface-200 rounded-lg" />
        </div>
      </div>

      {/* Memory Graph Visualizer Placeholder */}
      <div className="rounded-xl border border-border bg-surface p-8 shadow-card min-h-[320px] flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="h-5 w-36 bg-surface-200 rounded" />
          <div className="h-8 w-28 bg-surface-200 rounded-lg" />
        </div>
        <div className="flex items-center justify-center gap-8 py-8">
          <div className="w-16 h-16 rounded-full bg-surface-200" />
          <div className="w-24 h-24 rounded-full bg-surface-200" />
          <div className="w-20 h-20 rounded-full bg-surface-200" />
          <div className="w-14 h-14 rounded-full bg-surface-200" />
        </div>
        <div className="flex justify-between items-center text-xs">
          <div className="h-3 w-40 bg-surface-200 rounded" />
          <div className="h-3 w-28 bg-surface-200 rounded" />
        </div>
      </div>

      {/* Extracted Facts and Entities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-surface-200 rounded" />
              <div className="h-5 w-16 bg-surface-200 rounded-full" />
            </div>
            <div className="h-3.5 w-full bg-surface-200 rounded" />
            <div className="h-3.5 w-4/5 bg-surface-200 rounded" />
            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              <div className="h-3 w-20 bg-surface-200 rounded" />
              <div className="h-3 w-16 bg-surface-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
