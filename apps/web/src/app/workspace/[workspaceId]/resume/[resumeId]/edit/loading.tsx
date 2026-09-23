import React from 'react';

export default function ResumeEditLoading() {
  return (
    <div
      role="status"
      aria-label="Loading resume editor"
      className="max-w-7xl mx-auto p-6 space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-surface-200 rounded-lg" />
          <div className="h-4 w-72 bg-surface-200 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-28 bg-surface-200 rounded-lg" />
          <div className="h-9 w-32 bg-surface-200 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Form Columns (col-span-6) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
            <div className="h-5 w-32 bg-surface-200 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-10 bg-surface-200 rounded-lg" />
              <div className="h-10 bg-surface-200 rounded-lg" />
            </div>
            <div className="h-24 bg-surface-200 rounded-lg" />
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
            <div className="h-5 w-40 bg-surface-200 rounded" />
            <div className="h-12 bg-surface-200 rounded-lg" />
            <div className="h-12 bg-surface-200 rounded-lg" />
          </div>
        </div>

        {/* Live Preview Canvas (col-span-6) */}
        <div className="lg:col-span-6 rounded-xl border border-border bg-surface shadow-card p-8 space-y-6 min-h-[600px]">
          <div className="h-7 w-48 bg-surface-200 rounded mx-auto" />
          <div className="h-4 w-64 bg-surface-200 rounded mx-auto" />
          <div className="space-y-3 pt-6 border-t border-border">
            <div className="h-4 w-28 bg-surface-200 rounded" />
            <div className="h-3 w-full bg-surface-200 rounded" />
            <div className="h-3 w-5/6 bg-surface-200 rounded" />
          </div>
          <div className="space-y-3 pt-4">
            <div className="h-4 w-32 bg-surface-200 rounded" />
            <div className="h-16 w-full bg-surface-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
