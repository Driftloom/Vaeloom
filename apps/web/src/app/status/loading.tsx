import React from 'react';

export default function StatusLoading() {
  return (
    <div
      role="status"
      aria-label="Loading system status"
      className="p-8 max-w-4xl mx-auto space-y-8 animate-pulse"
    >
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface-200 rounded-lg" />
          <div className="h-4 w-64 bg-surface-200 rounded" />
        </div>
        <div className="h-8 w-32 bg-surface-200 rounded-full" />
      </div>

      {/* Services Uptime Status */}
      <div className="rounded-xl border border-border bg-surface p-6 space-y-6 shadow-card">
        <div className="h-5 w-40 bg-surface-200 rounded" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-32 bg-surface-200 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 bg-surface-200 rounded" />
                <div className="w-3 h-3 rounded-full bg-surface-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
