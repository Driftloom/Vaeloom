'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * Organizations (Phase 02A / F-02 + F-03).
 *
 * The previous implementation fetched GET /iam/organizations — an endpoint the
 * backend does not mount (verified against apps/api/src/api/main.py; only
 * /iam/users|roles exist) — and rendered a "Send Invite" modal that performed
 * no API call at all. Per the no-fake-state rule this surface is now an honest
 * stub until the organization service exists.
 *
 * NOT IMPLEMENTED — BACKEND DEPENDENCY:
 *   GET  /api/v1/iam/organizations        (org tree, members, roles)
 *   POST /api/v1/iam/organizations/invites (member invitations)
 */
export default function OrganizationsPage() {
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Organizations" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Organizations</h1>
        <p className="text-text-muted">Manage your organization structure, teams, and roles.</p>
      </header>

      <div className="card p-6">
        <EmptyState
          title="Organization management not configured"
          description="This environment has no organization backend yet. Org structures, member lists, role assignments, and invitations are unavailable — nothing on this page was ever persisted. Configure the organization service to enable this console."
        />
      </div>
    </div>
  );
}
