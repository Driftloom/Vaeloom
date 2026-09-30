import React from 'react';

export default function DocumentsLoading() {
  return (
    <div role="status" aria-label="Loading workspace documents" className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-surface-200 rounded-lg" />
          <div className="h-4 w-96 bg-surface-200/70 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-28 bg-surface-200 rounded-lg" />
          <div className="h-9 w-32 bg-surface-200 rounded-lg" />
        </div>
      </div>

      {/* Stats Bar Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl border border-border/60 bg-surface/30">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 rounded-lg bg-surface/50 border border-border/30"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-200 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-16 bg-surface-200 rounded" />
              <div className="h-5 w-24 bg-surface-200 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Drag & Drop Zone Skeleton */}
      <div className="rounded-xl border-2 border-dashed border-border/60 bg-surface/20 p-8 flex flex-col items-center justify-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-surface-200" />
        <div className="h-4 w-52 bg-surface-200 rounded" />
        <div className="h-3 w-36 bg-surface-200/70 rounded" />
      </div>

      {/* Main Grid: Folders Rail + Table Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Folders Skeleton */}
        <div className="p-4 rounded-xl border border-border/60 bg-surface/30 space-y-3">
          <div className="h-4 w-20 bg-surface-200 rounded" />
          <div className="space-y-2 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-surface-200/70 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="lg:col-span-3 space-y-4">
          <div className="h-10 bg-surface-200/60 rounded-xl" />
          <div className="rounded-xl border border-border/60 bg-surface/30 overflow-hidden divide-y divide-border/40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-surface-200" />
                  <div className="h-4 w-40 bg-surface-200 rounded" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-5 w-16 bg-surface-200 rounded-full" />
                  <div className="h-5 w-10 bg-surface-200 rounded" />
                  <div className="h-4 w-16 bg-surface-200 rounded" />
                  <div className="h-4 w-20 bg-surface-200 rounded" />
                  <div className="flex gap-1">
                    <div className="h-6 w-6 bg-surface-200 rounded" />
                    <div className="h-6 w-6 bg-surface-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
