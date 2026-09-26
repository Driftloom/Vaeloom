'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TwoFactorAuthCard } from '@/components/profile/TwoFactorAuthCard';
import { ActiveSessions } from '@/components/profile/ActiveSessions';
import { useAuth } from '@/hooks/useAuth';
import { Panel, Badge, ShieldIcon, LockIcon, KeyIcon } from '@vaeloom/ui-kit';

/**
 * Security settings.
 *
 * Every value rendered here comes from the API at request time:
 *   - two-factor status comes from the authenticated user's `mfa_enabled` flag,
 *   - enrolment goes through POST /auth/mfa/setup then /auth/mfa/enable,
 *   - the session list comes from GET /auth/sessions, and revocation from
 *     DELETE /auth/sessions/{id} and POST /auth/sessions/revoke-others.
 *
 * This page deliberately renders no compliance, isolation, or verification
 * badge. A security-assurance badge is only meaningful when it is backed by a
 * live check; an unbacked badge is a false claim to the user. Tenant isolation
 * and RLS posture are verified server-side and are reported in the security
 * evidence artifacts, not asserted here.
 */
export default function SecuritySettingsPage() {
  const params = useParams();
  const { user, loading } = useAuth();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  // mfa_enabled is part of the authenticated user record, so this reflects the
  // server rather than a local toggle. It is false while the session is loading
  // and the user is unknown; TwoFactorAuthCard owns its state after that.
  const mfaEnabled = user?.mfaEnabled ?? false;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text">Security</h1>
          <p className="text-sm text-text-secondary">
            Two-factor authentication and the devices signed into your account.
          </p>
        </div>
        <Badge variant="default" size="sm">
          <ShieldIcon size={12} /> Account security
        </Badge>
      </header>

      <section aria-labelledby="sec-mfa" className="space-y-3">
        <h2 id="sec-mfa" className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          Two-factor authentication
        </h2>
        <TwoFactorAuthCard initialEnabled={loading ? false : mfaEnabled} />
        {mfaEnabled && (
          <p className="text-xs text-text-dim">
            Disabling two-factor authentication is not available from this page. Contact a workspace
            administrator if you need it turned off.
          </p>
        )}
      </section>

      <section aria-labelledby="sec-sessions" className="space-y-3">
        <h2
          id="sec-sessions"
          className="text-sm font-semibold text-text-muted uppercase tracking-wide"
        >
          Active sessions
        </h2>
        <ActiveSessions />
      </section>

      <section aria-labelledby="sec-keys" className="space-y-3">
        <h2 id="sec-keys" className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          Programmatic access
        </h2>
        <Panel className="p-4">
          <div className="flex flex-wrap items-start gap-3">
            <KeyIcon size={18} className="mt-0.5 shrink-0 text-text-muted" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-text">API keys</p>
              <p className="text-xs text-text-secondary">
                Machine credentials for the Vaeloom API are issued and revoked from the developer
                console, where the key is shown once at creation.
              </p>
            </div>
            {workspaceId && (
              <Link
                href={`/workspace/${workspaceId}/developer`}
                className="text-xs font-medium text-action hover:underline"
              >
                Open developer console
              </Link>
            )}
          </div>
        </Panel>
      </section>

      <footer className="flex items-start gap-2 pt-2 text-xs text-text-dim">
        <LockIcon size={12} className="mt-0.5 shrink-0" />
        <p>
          All changes on this page are applied by the server and take effect on your next request.
          Sessions you revoke here cannot be recovered.
        </p>
      </footer>
    </div>
  );
}
