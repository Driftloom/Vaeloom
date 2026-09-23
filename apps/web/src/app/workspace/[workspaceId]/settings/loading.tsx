import React from 'react';

export default function SettingsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace settings"
      className="p-6 max-w-4xl mx-auto space-y-6 animate-pulse"
    >
      <div className="space-y-2 pb-4 border-b border-border">
        <div className="h-8 w-44 bg-surface-200 rounded-lg" />
        <div className="h-4 w-72 bg-surface-200 rounded" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-5 shadow-card">
        <div className="h-5 w-36 bg-surface-200 rounded" />
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 bg-surface-200 rounded" />
            <div className="h-10 w-full bg-surface-200 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-surface-200 rounded" />
            <div className="h-10 w-full bg-surface-200 rounded-lg" />
          </div>
        </div>
        <div className="pt-2 flex justify-end">
          <div className="h-9 w-28 bg-surface-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
