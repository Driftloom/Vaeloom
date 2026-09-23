import React from 'react';

export default function DocumentDetailLoading() {
  return (
    <div
      role="status"
      aria-label="Loading document viewer"
      className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-200" />
          <div className="space-y-1">
            <div className="h-6 w-48 bg-surface-200 rounded" />
            <div className="h-3 w-32 bg-surface-200 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-surface-200 rounded-lg" />
          <div className="h-9 w-28 bg-surface-200 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-8 space-y-4 shadow-card min-h-[500px]">
          <div className="h-5 w-40 bg-surface-200 rounded" />
          <div className="space-y-3 pt-2">
            <div className="h-3.5 w-full bg-surface-200 rounded" />
            <div className="h-3.5 w-11/12 bg-surface-200 rounded" />
            <div className="h-3.5 w-4/5 bg-surface-200 rounded" />
            <div className="h-3.5 w-5/6 bg-surface-200 rounded" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
          <div className="h-5 w-32 bg-surface-200 rounded" />
          <div className="space-y-2">
            <div className="h-8 bg-surface-200 rounded-lg" />
            <div className="h-8 bg-surface-200 rounded-lg" />
            <div className="h-8 bg-surface-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
