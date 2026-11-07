'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { resolveRoute, type DataMode } from '@/lib/route-manifest';
import { AlertCircleIcon } from '@vaeloom/ui-kit';

export interface DataModeBannerProps {
  mode?: DataMode;
  className?: string;
  message?: string;
}

export function DataModeBanner({ mode, className = '', message }: DataModeBannerProps) {
  const pathname = usePathname();
  const route = resolveRoute(pathname || '');
  const activeMode = mode || route?.dataMode || 'live';

  if (activeMode === 'live') {
    return null;
  }

  if (activeMode === 'preview') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`mb-6 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning ${className}`}
      >
        <AlertCircleIcon size={16} className="text-warning shrink-0" />
        <div className="flex-1">
          <span className="font-semibold uppercase tracking-wider text-warning mr-2">
            PREVIEW MODE
          </span>
          <span>
            {message ||
              'This view displays synthetic workflow simulations and design prototypes. External API actions and live provider mutations are disabled in this environment.'}
          </span>
        </div>
      </div>
    );
  }

  if (activeMode === 'stub' || activeMode === 'dead') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`mb-6 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-xs text-error ${className}`}
      >
        <AlertCircleIcon size={16} className="text-error shrink-0" />
        <div className="flex-1">
          <span className="font-semibold uppercase tracking-wider text-error mr-2">
            UNCONNECTED ROUTE
          </span>
          <span>
            {message ||
              'This feature route is not connected to a backend service in this deployment tier.'}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
