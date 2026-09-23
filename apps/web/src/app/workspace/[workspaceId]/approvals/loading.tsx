import React from 'react';

export default function ApprovalsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading pending approvals"
      className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-surface-200 rounded-lg" />
          <div className="h-4 w-80 bg-surface-200 rounded" />
        </div>
        <div className="h-8 w-24 bg-surface-200 rounded-full" />
      </div>

      {/* Pending Approvals List */}
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-200" />
                <div className="space-y-1">
                  <div className="h-5 w-48 bg-surface-200 rounded" />
                  <div className="h-3.5 w-32 bg-surface-200 rounded" />
                </div>
              </div>
              <div className="h-6 w-28 bg-surface-200 rounded-full" />
            </div>
            <div className="h-20 w-full bg-surface-200 rounded-lg" />
            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <div className="h-4 w-36 bg-surface-200 rounded" />
              <div className="flex gap-2">
                <div className="h-9 w-24 bg-surface-200 rounded-lg" />
                <div className="h-9 w-28 bg-surface-200 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
