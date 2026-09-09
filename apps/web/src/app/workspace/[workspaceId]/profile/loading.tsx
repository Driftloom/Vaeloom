import React from 'react';

export default function ProfileLoading() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-surface-200 shrink-0" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-surface-200 rounded" />
              <div className="h-4 w-36 bg-surface-200 rounded" />
              <div className="h-3 w-28 bg-surface-200 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-surface-200 rounded-lg" />
            <div className="h-9 w-44 bg-surface-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-border pb-2">
        <div className="h-9 w-24 bg-surface-200 rounded-lg" />
        <div className="h-9 w-36 bg-surface-200 rounded-lg" />
        <div className="h-9 w-40 bg-surface-200 rounded-lg" />
      </div>

      {/* Grid Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <div className="lg:col-span-2 space-y-6">
          {/* Agent Insights Card */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
            <div className="h-5 w-40 bg-surface-200 rounded" />
            <div className="h-16 bg-surface-200 rounded-lg" />
            <div className="h-16 bg-surface-200 rounded-lg" />
          </div>

          {/* About Me Card */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
            <div className="h-5 w-32 bg-surface-200 rounded" />
            <div className="h-4 w-full bg-surface-200 rounded" />
            <div className="h-4 w-5/6 bg-surface-200 rounded" />
          </div>

          {/* Skills Card */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
            <div className="h-5 w-36 bg-surface-200 rounded" />
            <div className="flex flex-wrap gap-2">
              <div className="h-7 w-20 bg-surface-200 rounded-full" />
              <div className="h-7 w-24 bg-surface-200 rounded-full" />
              <div className="h-7 w-16 bg-surface-200 rounded-full" />
              <div className="h-7 w-28 bg-surface-200 rounded-full" />
              <div className="h-7 w-20 bg-surface-200 rounded-full" />
            </div>
          </div>

          {/* Career Summary Card */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
            <div className="h-5 w-36 bg-surface-200 rounded" />
            <div className="h-20 bg-surface-200 rounded-lg" />
          </div>
        </div>

        <div className="space-y-6">
          {/* Completeness Card */}
          <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-surface-200" />
            <div className="h-4 w-32 bg-surface-200 rounded" />
          </div>

          {/* ATS Readiness Card */}
          <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-surface-200" />
            <div className="h-4 w-28 bg-surface-200 rounded" />
          </div>

          {/* Contact / Social Links */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
            <div className="h-5 w-32 bg-surface-200 rounded" />
            <div className="h-8 bg-surface-200 rounded-lg" />
            <div className="h-8 bg-surface-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
