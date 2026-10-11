import React from 'react';
import { Skeleton } from '@vaeloom/ui-kit';

export interface CapabilitySubpageSkeletonProps {
  eyebrow?: string;
}

export function CapabilitySubpageSkeleton({
  eyebrow = 'Capability Detail',
}: CapabilitySubpageSkeletonProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Loading capability details"
      className="flex flex-col h-full min-h-0 bg-background antialiased"
    >
      {/* Subpage Header Skeleton */}
      <div className="shrink-0 px-4 sm:px-6 pt-4 border-b border-border bg-surface space-y-3 pb-4">
        <div className="flex items-center gap-2">
          <Skeleton rounded="md" className="h-4 w-20" />
          <span className="text-text-dim text-xs">/</span>
          <Skeleton rounded="md" className="h-4 w-16" />
          <span className="text-text-dim text-xs">/</span>
          <Skeleton rounded="md" className="h-4 w-28" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <span className="text-2xs font-mono uppercase tracking-wider text-text-muted block">
              {eyebrow}
            </span>
            <Skeleton rounded="md" className="h-7 w-64" />
            <Skeleton rounded="md" className="h-4 w-full max-w-xl" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton rounded="md" className="h-8 w-28" />
            <Skeleton rounded="md" className="h-8 w-32" />
          </div>
        </div>
      </div>

      {/* Body Skeleton */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Status Bar */}
        <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton rounded="full" className="h-3 w-3" />
            <div className="space-y-1">
              <Skeleton rounded="md" className="h-4 w-36" />
              <Skeleton rounded="md" className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton rounded="md" className="h-6 w-16" />
            <Skeleton rounded="md" className="h-6 w-20" />
            <Skeleton rounded="md" className="h-6 w-24" />
          </div>
        </div>

        {/* Tab Row */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Skeleton rounded="md" className="h-8 w-24" />
          <Skeleton rounded="md" className="h-8 w-24" />
          <Skeleton rounded="md" className="h-8 w-24" />
        </div>

        {/* Main Panel */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
          <Skeleton rounded="md" className="h-5 w-48" />
          <Skeleton rounded="md" className="h-4 w-full" />
          <Skeleton rounded="md" className="h-4 w-5/6" />
          <Skeleton rounded="lg" className="h-56 w-full mt-4" />
        </div>
      </div>
    </div>
  );
}

export default CapabilitySubpageSkeleton;
