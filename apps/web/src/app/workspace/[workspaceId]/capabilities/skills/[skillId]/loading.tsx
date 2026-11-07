import React from 'react';
import { CapabilitySubpageSkeleton } from '@/components/capabilities/CapabilitySubpageSkeleton';

/**
 * Route-level loading state. Delegates to the same skeleton the page's own
 * in-flight branch renders, because both render while the same data is
 * loading and a skeleton that does not match the route's real layout is a
 * visible layout jump on every navigation (mirrors capabilities/loading.tsx).
 */
export default function SkillDetailLoading() {
  return <CapabilitySubpageSkeleton eyebrow="Capability Skill" />;
}
