import React from 'react';

export default function CouncilLoading() {
  return (
    <div
      role="status"
      aria-label="Loading agent council deliberation"
      className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-surface-200 rounded-lg" />
          <div className="h-4 w-96 bg-surface-200 rounded" />
        </div>
        <div className="h-9 w-36 bg-surface-200 rounded-lg" />
      </div>

      {/* Council Members Roster */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3 shadow-card"
          >
            <div className="w-10 h-10 rounded-full bg-surface-200 shrink-0" />
            <div className="space-y-1">
              <div className="h-4 w-20 bg-surface-200 rounded" />
              <div className="h-3 w-14 bg-surface-200 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Deliberation Chamber */}
      <div className="rounded-xl border border-border bg-surface p-6 space-y-6 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="h-5 w-48 bg-surface-200 rounded" />
          <div className="h-6 w-24 bg-surface-200 rounded-full" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-surface-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-surface-200 rounded" />
                <div className="h-14 w-full bg-surface-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
