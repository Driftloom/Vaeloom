import React from 'react';

export default function DynamicConnectorsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading dynamic connectors builder"
      className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-60 bg-surface-200 rounded-lg" />
          <div className="h-4 w-96 bg-surface-200 rounded" />
        </div>
        <div className="h-9 w-32 bg-surface-200 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
          <div className="h-5 w-40 bg-surface-200 rounded" />
          <div className="space-y-3">
            <div className="h-10 w-full bg-surface-200 rounded-lg" />
            <div className="h-10 w-full bg-surface-200 rounded-lg" />
            <div className="h-28 w-full bg-surface-200 rounded-lg" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
          <div className="h-5 w-36 bg-surface-200 rounded" />
          <div className="h-60 w-full bg-surface-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
