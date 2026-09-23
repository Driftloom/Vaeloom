import React from 'react';

export default function MarketplaceLoading() {
  return (
    <div
      role="status"
      aria-label="Loading capabilities marketplace"
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-surface-200 rounded-lg" />
          <div className="h-4 w-96 bg-surface-200 rounded" />
        </div>
        <div className="h-9 w-64 bg-surface-200 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-surface-200" />
                <div className="h-6 w-16 bg-surface-200 rounded-full" />
              </div>
              <div className="h-5 w-40 bg-surface-200 rounded" />
              <div className="space-y-1">
                <div className="h-3.5 w-full bg-surface-200 rounded" />
                <div className="h-3.5 w-4/5 bg-surface-200 rounded" />
              </div>
            </div>
            <div className="pt-3 border-t border-border-subtle flex justify-between items-center">
              <div className="h-4 w-20 bg-surface-200 rounded" />
              <div className="h-8 w-24 bg-surface-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
