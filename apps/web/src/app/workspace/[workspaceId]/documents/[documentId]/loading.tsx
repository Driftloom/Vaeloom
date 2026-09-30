import React from 'react';

export default function DocumentDetailLoading() {
  return (
    <div role="status" aria-label="Loading document details" className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <div className="h-4 w-48 bg-surface-200/70 rounded" />
          <div className="h-8 w-64 bg-surface-200 rounded-lg" />
          <div className="h-4 w-72 bg-surface-200/60 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-surface-200 rounded-lg" />
          <div className="h-8 w-24 bg-surface-200 rounded-lg" />
          <div className="h-8 w-20 bg-surface-200 rounded-lg" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-border/60 pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-surface-200/60 rounded-t-lg" />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="rounded-xl border border-border/60 bg-surface/30 p-8 min-h-[50dvh] space-y-4">
        <div className="h-6 w-1/3 bg-surface-200 rounded" />
        <div className="space-y-2 pt-2">
          <div className="h-4 w-full bg-surface-200/70 rounded" />
          <div className="h-4 w-5/6 bg-surface-200/70 rounded" />
          <div className="h-4 w-4/6 bg-surface-200/70 rounded" />
          <div className="h-4 w-full bg-surface-200/70 rounded" />
        </div>
      </div>
    </div>
  );
}
