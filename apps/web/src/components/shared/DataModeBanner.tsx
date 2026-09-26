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
        className={`mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 ${className}`}
      >
        <AlertCircleIcon size={16} className="text-amber-400 shrink-0" />
        <div className="flex-1">
          <span className="font-semibold uppercase tracking-wider text-amber-300 mr-2">
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
        className={`mb-6 flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 ${className}`}
      >
        <AlertCircleIcon size={16} className="text-rose-400 shrink-0" />
        <div className="flex-1">
          <span className="font-semibold uppercase tracking-wider text-rose-300 mr-2">
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
