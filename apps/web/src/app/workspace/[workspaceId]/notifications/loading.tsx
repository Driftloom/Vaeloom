import React from 'react';

export default function NotificationsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading notifications"
      className="p-6 max-w-4xl mx-auto space-y-6 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface-200 rounded-lg" />
          <div className="h-4 w-72 bg-surface-200 rounded" />
        </div>
        <div className="h-8 w-28 bg-surface-200 rounded-lg" />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-card divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-200 shrink-0" />
              <div className="space-y-1">
                <div className="h-4 w-64 bg-surface-200 rounded" />
                <div className="h-3 w-40 bg-surface-200 rounded" />
              </div>
            </div>
            <div className="h-3 w-16 bg-surface-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
