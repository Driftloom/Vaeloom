import React from 'react';

export default function ChatLoading() {
  return (
    <div
      role="status"
      aria-label="Loading chat"
      className="flex flex-col h-[calc(100vh-8rem)] w-full max-w-4xl mx-auto p-4 animate-pulse space-y-6"
    >
      {/* Top Thread Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-200" />
          <div className="space-y-1">
            <div className="h-4 w-32 bg-surface-200 rounded" />
            <div className="h-3 w-20 bg-surface-200 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-surface-200 rounded-lg" />
          <div className="h-8 w-8 bg-surface-200 rounded-lg" />
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 space-y-6 overflow-hidden py-4">
        {/* Agent Message */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-surface-200 rounded" />
            <div className="h-16 w-3/4 bg-surface-200 rounded-xl" />
          </div>
        </div>

        {/* User Message */}
        <div className="flex justify-end">
          <div className="h-12 w-1/2 bg-surface-200 rounded-2xl" />
        </div>

        {/* Agent Followup with Tool Chips */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-200 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-28 bg-surface-200 rounded" />
            <div className="h-24 w-5/6 bg-surface-200 rounded-xl" />
            <div className="flex gap-2">
              <div className="h-6 w-28 bg-surface-200 rounded-full" />
              <div className="h-6 w-36 bg-surface-200 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Input Dock */}
      <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
        <div className="h-10 w-full bg-surface-200 rounded-lg" />
        <div className="flex justify-between items-center pt-1">
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-surface-200 rounded" />
            <div className="h-5 w-16 bg-surface-200 rounded" />
          </div>
          <div className="h-8 w-16 bg-surface-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
