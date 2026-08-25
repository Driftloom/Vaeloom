'use client';

/**
 * OAuth callback surface (Phase-02A F-01, restored in Phase-02B).
 *
 * Backend contract (apps/api/src/api/routers/auth.py):
 * - GET /api/v1/auth/sso/{provider}?redirect_uri=... -> { auth_url, state }
 * - Provider consent redirects the browser here with ?code=&state= (or ?error=)
 * - GET /api/v1/auth/sso/{provider}/callback?code&state -> AuthResponse JSON
 *
 * The SPA never receives the provider identity from the provider, so the
 * origin page persists it in sessionStorage before navigating to consent.
 */

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, setToken, setRefreshToken } from '@/lib/api';

type Phase = { kind: 'processing' } | { kind: 'error'; title: string; detail: string };

const SSO_PROVIDER_KEY = 'vaeloom.sso.provider';
const SSO_REDIRECT_KEY = 'vaeloom.sso.redirect';
const ALLOWED_PROVIDERS = new Set(['google', 'microsoft']);

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ kind: 'processing' });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const providerRaw = sessionStorage.getItem(SSO_PROVIDER_KEY);
    const provider = providerRaw && ALLOWED_PROVIDERS.has(providerRaw) ? providerRaw : null;
    const storedRedirect = sessionStorage.getItem(SSO_REDIRECT_KEY);

    function fail(title: string, detail: string): void {
      sessionStorage.removeItem(SSO_PROVIDER_KEY);
      sessionStorage.removeItem(SSO_REDIRECT_KEY);
      setPhase({ kind: 'error', title, detail });
    }

    if (!provider) {
      fail(
        'Sign-in session not found',
        'We could not determine which provider started this sign-in. Please return to the sign-in page and try again.',
      );
      return;
    }

    const providerError = searchParams?.get('error');
    if (providerError) {
      const description =
        searchParams?.get('error_description') ??
        'The provider reported an error and the sign-in was not completed.';
      fail('Provider sign-in failed', description);
      return;
    }

    const code = searchParams?.get('code');
    const state = searchParams?.get('state');
    if (!code || !state) {
      fail(
        'Incomplete sign-in response',
        'The authorization response was missing required parameters (code/state). Please restart the sign-in.',
      );
      return;
    }

    async function exchange(): Promise<void> {
      try {
        const res = await api.request<{
          accessToken?: string;
          access_token?: string;
          refreshToken?: string | null;
          refresh_token?: string | null;
        }>(
          `/auth/sso/${provider}/callback?code=${encodeURIComponent(code ?? '')}&state=${encodeURIComponent(state ?? '')}`,
        );
        const accessToken = res.accessToken ?? res.access_token;
        if (!accessToken) {
          fail(
            'Sign-in could not be completed',
            'The authorization server did not return a valid token. Please try signing in again.',
          );
          return;
        }
        setToken(accessToken);
        const refreshToken = res.refreshToken ?? res.refresh_token;
        if (refreshToken) setRefreshToken(refreshToken);

        sessionStorage.removeItem(SSO_PROVIDER_KEY);

        // Resolve destination: preserved redirect > first workspace > landing.
        let target: string | null = null;
        if (storedRedirect && storedRedirect.startsWith('/') && !storedRedirect.startsWith('//')) {
          target = storedRedirect;
        } else {
          try {
            const workspaces = await api.listWorkspaces();
            if (Array.isArray(workspaces) && workspaces.length > 0 && workspaces[0]?.id) {
              target = `/workspace/${workspaces[0].id}`;
            }
          } catch {
            // Fall through to landing.
          }
        }
        sessionStorage.removeItem(SSO_REDIRECT_KEY);
        router.replace(target ?? '/');
      } catch {
        // Invalid/expired/already-consumed state values surface one honest,
        // actionable message instead of leaking internals.
        fail(
          'Sign-in link expired',
          'This sign-in attempt is no longer valid — authorization codes can only be used once and expire quickly. Please return to the sign-in page and try again.',
        );
      }
    }

    void exchange();
  }, [router, searchParams]);

  if (phase.kind === 'processing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
          role="status"
          aria-label="Completing sign-in"
        />
        <div>
          <p className="text-lg font-display font-medium">Completing sign-in…</p>
          <p className="mt-1 text-sm text-text-muted">
            Verifying your authorization with the identity provider.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md card p-8 text-center" role="alert">
        <h1 className="text-2xl font-display font-semibold">{phase.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{phase.detail}</p>
        <Link href="/login" className="btn-primary mt-6 inline-flex w-full justify-center py-2.5">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
            role="status"
            aria-label="Loading"
          />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
