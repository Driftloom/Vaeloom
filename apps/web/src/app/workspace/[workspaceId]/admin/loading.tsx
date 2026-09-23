import React from 'react';

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-label="Loading admin portal"
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface-200 rounded-lg" />
          <div className="h-4 w-80 bg-surface-200 rounded" />
        </div>
        <div className="h-9 w-36 bg-surface-200 rounded-lg" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-5 space-y-2 shadow-card"
          >
            <div className="h-4 w-28 bg-surface-200 rounded" />
            <div className="h-8 w-16 bg-surface-200 rounded" />
            <div className="h-3 w-32 bg-surface-200 rounded" />
          </div>
        ))}
      </div>

      {/* Management Table Skeleton */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-card">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <div className="h-5 w-36 bg-surface-200 rounded" />
          <div className="h-8 w-48 bg-surface-200 rounded-lg" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surface-200" />
                <div className="space-y-1">
                  <div className="h-4 w-36 bg-surface-200 rounded" />
                  <div className="h-3 w-48 bg-surface-200 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-20 bg-surface-200 rounded-full" />
                <div className="h-8 w-16 bg-surface-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
