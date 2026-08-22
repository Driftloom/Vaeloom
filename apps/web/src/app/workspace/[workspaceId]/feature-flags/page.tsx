'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * Feature Flags (Phase 02A / F-02 + F-03).
 *
 * The previous implementation rendered toggle switches, rollout sliders, an
 * A/B-test form and an audit trail that were entirely client-side fabrications:
 * the backend mounts no /feature-flags router (verified against
 * apps/api/src/api/main.py include_router list). Per the no-fake-state rule,
 * this surface is now an honest stub until the backend service exists.
 *
 * NOT IMPLEMENTED — BACKEND DEPENDENCY:
 *   GET/PUT /api/v1/feature-flags (flag list + mutation endpoints).
 */
export default function FeatureFlagsPage() {
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Feature Flags" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Feature Flags</h1>
        <p className="text-text-muted">
          Manage gradual rollouts and experiments for your organization.
        </p>
      </header>

      <div className="card p-6">
        <EmptyState
          title="Feature flags service not configured"
          description="This environment has no feature-flag backend yet. Flags cannot be listed or changed here — nothing you would have toggled on this page was ever persisted. Configure a feature-flag service to enable this console."
        />
      </div>
    </div>
  );
}
