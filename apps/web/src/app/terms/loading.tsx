import React from 'react';

export default function TermsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading terms of service"
      className="p-8 max-w-4xl mx-auto space-y-6 animate-pulse"
    >
      <div className="space-y-2 pb-6 border-b border-border">
        <div className="h-8 w-56 bg-surface-200 rounded-lg" />
        <div className="h-4 w-40 bg-surface-200 rounded" />
      </div>

      <div className="space-y-4">
        <div className="h-5 w-48 bg-surface-200 rounded" />
        <div className="space-y-2">
          <div className="h-3.5 w-full bg-surface-200 rounded" />
          <div className="h-3.5 w-11/12 bg-surface-200 rounded" />
          <div className="h-3.5 w-4/5 bg-surface-200 rounded" />
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="h-5 w-40 bg-surface-200 rounded" />
        <div className="space-y-2">
          <div className="h-3.5 w-full bg-surface-200 rounded" />
          <div className="h-3.5 w-5/6 bg-surface-200 rounded" />
        </div>
      </div>
    </div>
  );
}
