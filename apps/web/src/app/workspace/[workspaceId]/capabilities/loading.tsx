import React from 'react';
import { CapabilitiesWorkbenchSkeleton } from '@/components/capabilities/CapabilitiesWorkbenchSkeleton';

/**
 * Route-level loading state. Delegates to the same component the page's Suspense
 * fallback uses, because both render while the same data is in flight and a
 * skeleton that does not match the route's real layout is a visible layout jump
 * on every navigation.
 */
export default function CapabilitiesLoading() {
  return <CapabilitiesWorkbenchSkeleton />;
}
