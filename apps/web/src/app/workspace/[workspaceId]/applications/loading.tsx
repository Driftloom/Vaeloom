import React from 'react';

export default function ApplicationsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading job applications"
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-surface-200 rounded-lg" />
          <div className="h-4 w-80 bg-surface-200 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-32 bg-surface-200 rounded-lg" />
          <div className="h-9 w-36 bg-surface-200 rounded-lg" />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <div className="h-4 w-20 bg-surface-200 rounded" />
            <div className="h-7 w-12 bg-surface-200 rounded" />
          </div>
        ))}
      </div>

      {/* Applications Kanban / Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="h-9 w-64 bg-surface-200 rounded-lg" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-surface-200 rounded-lg" />
            <div className="h-8 w-20 bg-surface-200 rounded-lg" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-surface-200 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-40 bg-surface-200 rounded" />
                  <div className="h-3 w-28 bg-surface-200 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-6 w-24 bg-surface-200 rounded-full" />
                <div className="h-4 w-16 bg-surface-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
