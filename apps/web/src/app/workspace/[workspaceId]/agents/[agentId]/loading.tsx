import React from 'react';

export default function AgentDetailLoading() {
  return (
    <div
      role="status"
      aria-label="Loading agent configuration"
      className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <div className="w-16 h-16 rounded-2xl bg-surface-200 shrink-0" />
        <div className="space-y-2">
          <div className="h-7 w-48 bg-surface-200 rounded" />
          <div className="h-4 w-64 bg-surface-200 rounded" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
        <div className="h-5 w-32 bg-surface-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-10 bg-surface-200 rounded-lg" />
          <div className="h-10 bg-surface-200 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
        <div className="h-5 w-40 bg-surface-200 rounded" />
        <div className="h-40 bg-surface-200 rounded-lg" />
      </div>
    </div>
  );
}
