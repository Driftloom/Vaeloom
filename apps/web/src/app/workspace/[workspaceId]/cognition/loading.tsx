import React from 'react';

export default function CognitionLoading() {
  return (
    <div
      role="status"
      aria-label="Loading cognition pipeline"
      className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-surface-200 rounded-lg" />
          <div className="h-4 w-96 bg-surface-200 rounded" />
        </div>
        <div className="h-8 w-28 bg-surface-200 rounded-full" />
      </div>

      {/* System 1 / System 2 Split Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 bg-surface-200 rounded" />
            <div className="h-5 w-20 bg-surface-200 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-surface-200 rounded" />
            <div className="h-3 w-4/5 bg-surface-200 rounded" />
          </div>
          <div className="h-28 bg-surface-200 rounded-lg" />
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="h-5 w-44 bg-surface-200 rounded" />
            <div className="h-5 w-20 bg-surface-200 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-surface-200 rounded" />
            <div className="h-3 w-4/5 bg-surface-200 rounded" />
          </div>
          <div className="h-28 bg-surface-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
