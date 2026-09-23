import React from 'react';

export default function PublicProfileLoading() {
  return (
    <div
      role="status"
      aria-label="Loading public portfolio"
      className="p-8 max-w-4xl mx-auto space-y-8 animate-pulse"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-border">
        <div className="w-24 h-24 rounded-full bg-surface-200 shrink-0" />
        <div className="space-y-2 text-center sm:text-left flex-1">
          <div className="h-7 w-48 bg-surface-200 rounded mx-auto sm:mx-0" />
          <div className="h-4 w-64 bg-surface-200 rounded mx-auto sm:mx-0" />
          <div className="flex gap-2 justify-center sm:justify-start pt-1">
            <div className="h-6 w-20 bg-surface-200 rounded-full" />
            <div className="h-6 w-24 bg-surface-200 rounded-full" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
        <div className="h-5 w-32 bg-surface-200 rounded" />
        <div className="space-y-2">
          <div className="h-3.5 w-full bg-surface-200 rounded" />
          <div className="h-3.5 w-5/6 bg-surface-200 rounded" />
          <div className="h-3.5 w-4/6 bg-surface-200 rounded" />
        </div>
      </div>
    </div>
  );
}
