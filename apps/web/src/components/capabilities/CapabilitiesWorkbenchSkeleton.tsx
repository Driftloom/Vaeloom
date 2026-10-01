import React from 'react';
import { Skeleton } from '@vaeloom/ui-kit';

/**
 * The route is a master/detail workbench: a page header, a category tablist and
 * a fixed-width left rail beside an inspector. A skeleton of any other shape
 * makes every navigation to this route read as a different product for as long
 * as it takes the data to land.
 *
 * WHY one component and not one per call site: `loading.tsx` and the page's
 * Suspense fallback are rendered at the same moment from the same tree, and
 * they drifted into a three-card grid and a two-pane rail respectively. There is
 * no test that catches a skeleton that is merely plausible, so the only reliable
 * guard is for there to be nothing left to drift.
 */
export function CapabilitiesWorkbenchSkeleton(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Loading capabilities"
      className="flex flex-col h-full min-h-0 bg-background"
    >
      <div className="shrink-0 px-4 sm:px-6 pt-4 space-y-3">
        <Skeleton rounded="md" className="h-8 w-64" />
        <Skeleton rounded="md" className="h-4 w-full max-w-2xl" />
      </div>

      <div className="shrink-0 px-4 sm:px-6 py-2.5 border-b border-border-subtle flex flex-col lg:flex-row lg:items-center gap-2.5">
        <Skeleton rounded="md" className="h-8 w-56 shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} rounded="lg" className="h-8 w-20 shrink-0" />
          ))}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-full lg:w-[320px] xl:w-[350px] shrink-0 border-r border-border p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} rounded="md" className="h-11 w-full" />
          ))}
        </div>
        <div className="hidden lg:flex flex-1 p-5 space-y-4">
          <Skeleton rounded="md" className="h-6 w-56" />
          <Skeleton rounded="md" className="h-3 w-full max-w-xl" />
          <Skeleton rounded="lg" className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}

export default CapabilitiesWorkbenchSkeleton;
