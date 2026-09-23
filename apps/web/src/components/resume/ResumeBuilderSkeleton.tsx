import React from 'react';

export function ResumeBuilderSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading resume studio"
      className="flex flex-col h-full max-w-7xl mx-auto w-full animate-pulse space-y-6"
    >
      {/* Top Header & Actions Ribbon */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-surface-200 rounded-lg" />
          <div className="h-4 w-80 bg-surface-200 rounded" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-32 bg-surface-200 rounded-lg" />
          <div className="h-9 w-28 bg-surface-200 rounded-lg" />
          <div className="h-9 w-36 bg-surface-200 rounded-lg" />
        </div>
      </header>

      {/* Variant Tabs & ATS Badge Bar */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="h-8 w-32 bg-surface-200 rounded-lg" />
          <div className="h-8 w-40 bg-surface-200 rounded-lg" />
          <div className="h-8 w-28 bg-surface-200 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 bg-surface-200 rounded-full" />
          <div className="h-6 w-20 bg-surface-200 rounded-full" />
        </div>
      </div>

      {/* Main Split Layout: Config & Metadata (Left) + Document Canvas (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 items-start">
        {/* Left Column: Metadata, ATS Score & Tailoring Scopes (col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          {/* ATS Score Card */}
          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-surface-200 rounded" />
              <div className="h-6 w-14 bg-surface-200 rounded-full" />
            </div>
            <div className="h-2.5 w-full bg-surface-200 rounded-full" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-3/4 bg-surface-200 rounded" />
              <div className="h-3 w-5/6 bg-surface-200 rounded" />
            </div>
          </div>

          {/* Role Alignment Card */}
          <div className="rounded-xl border border-border bg-surface p-5 space-y-3.5">
            <div className="h-4 w-36 bg-surface-200 rounded" />
            <div className="h-10 w-full bg-surface-200 rounded-lg" />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <div className="h-5 w-16 bg-surface-200 rounded-md" />
              <div className="h-5 w-20 bg-surface-200 rounded-md" />
              <div className="h-5 w-14 bg-surface-200 rounded-md" />
            </div>
          </div>

          {/* Export Formats */}
          <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
            <div className="h-4 w-28 bg-surface-200 rounded" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-9 bg-surface-200 rounded-lg" />
              <div className="h-9 bg-surface-200 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right Column: A4 Document Canvas Preview (col-span-8) */}
        <div className="lg:col-span-8 rounded-xl border border-border bg-surface shadow-card p-8 sm:p-12 space-y-7 min-h-[680px]">
          {/* Candidate Header */}
          <div className="space-y-3 border-b border-border pb-6 text-center sm:text-left">
            <div className="h-7 w-64 bg-surface-200 rounded-md" />
            <div className="h-4 w-48 bg-surface-200 rounded" />
            <div className="flex flex-wrap gap-3 pt-1">
              <div className="h-3.5 w-32 bg-surface-200 rounded" />
              <div className="h-3.5 w-28 bg-surface-200 rounded" />
              <div className="h-3.5 w-36 bg-surface-200 rounded" />
            </div>
          </div>

          {/* Professional Summary */}
          <div className="space-y-2.5">
            <div className="h-4 w-40 bg-surface-200 rounded" />
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-surface-200 rounded" />
              <div className="h-3 w-11/12 bg-surface-200 rounded" />
              <div className="h-3 w-4/5 bg-surface-200 rounded" />
            </div>
          </div>

          {/* Experience Section */}
          <div className="space-y-4">
            <div className="h-4 w-44 bg-surface-200 rounded" />
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-3.5 w-52 bg-surface-200 rounded" />
                <div className="h-3 w-24 bg-surface-200 rounded" />
              </div>
              <div className="space-y-1.5 pl-4 border-l-2 border-surface-200">
                <div className="h-3 w-full bg-surface-200 rounded" />
                <div className="h-3 w-5/6 bg-surface-200 rounded" />
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <div className="h-3.5 w-48 bg-surface-200 rounded" />
                <div className="h-3 w-28 bg-surface-200 rounded" />
              </div>
              <div className="space-y-1.5 pl-4 border-l-2 border-surface-200">
                <div className="h-3 w-11/12 bg-surface-200 rounded" />
                <div className="h-3 w-4/5 bg-surface-200 rounded" />
              </div>
            </div>
          </div>

          {/* Skills & Technologies */}
          <div className="space-y-3">
            <div className="h-4 w-36 bg-surface-200 rounded" />
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-20 bg-surface-200 rounded-md" />
              <div className="h-6 w-24 bg-surface-200 rounded-md" />
              <div className="h-6 w-16 bg-surface-200 rounded-md" />
              <div className="h-6 w-28 bg-surface-200 rounded-md" />
              <div className="h-6 w-20 bg-surface-200 rounded-md" />
              <div className="h-6 w-18 bg-surface-200 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
