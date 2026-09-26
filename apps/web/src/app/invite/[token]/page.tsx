'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Badge,
  Button,
  BuildingIcon,
  CheckIcon,
  AlertCircleIcon,
  Spinner,
} from '@vaeloom/ui-kit';
import { organizationsApi, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

type InviteState = 'idle' | 'accepting' | 'accepted' | 'error';

/**
 * Organization invitation acceptance.
 *
 * Invitation details (organization name, assigned role, tenant-isolation status)
 * are intentionally NOT rendered here. There is no server endpoint that resolves
 * a raw token to a previewable invitation, so any such detail shown before
 * acceptance would be fabricated. The server is the only authority on whether a
 * token is valid, unexpired, unrevoked, and addressed to the signed-in account.
 */
export default function WorkspaceInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const token = typeof params?.['token'] === 'string' ? params['token'] : '';

  const [state, setState] = useState<InviteState>('idle');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleAccept = useCallback(async () => {
    if (!token) {
      setState('error');
      setErrorDetail(
        'This link is missing its invitation token. Ask the administrator who invited you to send a new link.',
      );
      return;
    }
    setState('accepting');
    setErrorDetail(null);
    try {
      await organizationsApi.acceptInvitation(token);
      setState('accepted');
      // The server returns the organization id, not a workspace id, so let the
      // workspace resolver pick the correct workspace rather than guessing.
      router.push('/workspace');
    } catch (err) {
      setState('error');
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 400) {
        setErrorDetail(
          'This invitation is invalid, expired, or has already been used. Ask an administrator to send a new invitation.',
        );
      } else if (status === 401) {
        setErrorDetail('Your session expired. Sign in again to accept this invitation.');
      } else if (status === 403) {
        setErrorDetail(
          'This invitation was issued to a different account. Sign in with the invited email address, or ask an administrator to reissue it.',
        );
      } else {
        setErrorDetail(
          'We could not reach the server to accept this invitation. Check your connection and try again.',
        );
      }
    }
  }, [token, router]);

  const signInHref = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg p-8 text-center space-y-6 border-border-strong shadow-xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-action/10 flex items-center justify-center text-action">
          <BuildingIcon size={32} />
        </div>

        <div className="space-y-2">
          <Badge variant="primary" size="sm">
            ORGANIZATION INVITATION
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            You have been invited to a Vaeloom organization
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Accepting will add your account to the organization at the role chosen by the
            administrator. The server verifies the invitation before granting access.
          </p>
        </div>

        <div
          className="p-4 rounded-xl bg-surface-100 border border-border-subtle text-left space-y-2.5 text-xs"
          aria-live="polite"
        >
          <p className="text-text-muted">
            The organization name and your assigned role are shown after acceptance. They are not
            displayed beforehand because the server has not yet validated this link.
          </p>
        </div>

        {state === 'error' && errorDetail && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-error/10 border border-error/30 text-error text-xs font-semibold flex items-start justify-center gap-2 text-left"
          >
            <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
            <span>{errorDetail}</span>
          </div>
        )}

        {state === 'accepted' ? (
          <div
            role="status"
            className="p-4 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center justify-center gap-2"
          >
            <CheckIcon size={16} /> Invitation accepted. Taking you to your workspace...
          </div>
        ) : authLoading ? (
          <div className="flex items-center justify-center gap-2 py-2 text-text-muted text-sm">
            <Spinner size="sm" /> Checking your session...
          </div>
        ) : isAuthenticated ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleAccept}
              disabled={state === 'accepting'}
            >
              <span className="flex items-center justify-center gap-1.5">
                {state === 'accepting' ? <Spinner size="sm" /> : <CheckIcon size={14} />}
                {state === 'accepting' ? 'Accepting...' : 'Accept Invitation'}
              </span>
            </Button>
            <Link href="/workspace" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                Not now
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link href={signInHref} className="w-full sm:w-auto">
              <Button variant="primary" className="w-full sm:w-auto">
                Sign in to accept
              </Button>
            </Link>
            <Link href="/workspace" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                Not now
              </Button>
            </Link>
          </div>
        )}

        <div className="text-2xs font-mono text-text-muted pt-2 border-t border-border-subtle">
          Invitation reference:{' '}
          <code className="bg-surface-200 px-1 py-0.5 rounded">
            {token ? `${token.slice(0, 8)}...` : 'missing'}
          </code>
        </div>
      </Card>
    </main>
  );
}
