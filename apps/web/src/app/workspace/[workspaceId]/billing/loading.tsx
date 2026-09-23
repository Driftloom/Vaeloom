import React from 'react';

export default function BillingLoading() {
  return (
    <div
      role="status"
      aria-label="Loading billing and plans"
      className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface-200 rounded-lg" />
          <div className="h-4 w-72 bg-surface-200 rounded" />
        </div>
        <div className="h-9 w-32 bg-surface-200 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-6 space-y-5 shadow-card">
          <div className="h-5 w-36 bg-surface-200 rounded" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-surface-200 rounded" />
            <div className="h-3 w-full bg-surface-200 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
            <div className="space-y-1">
              <div className="h-3 w-20 bg-surface-200 rounded" />
              <div className="h-6 w-24 bg-surface-200 rounded" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-20 bg-surface-200 rounded" />
              <div className="h-6 w-24 bg-surface-200 rounded" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
          <div className="h-5 w-28 bg-surface-200 rounded" />
          <div className="h-8 w-24 bg-surface-200 rounded" />
          <div className="h-10 w-full bg-surface-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
