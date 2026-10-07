'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Spinner } from '@vaeloom/ui-kit';

export default function ConnectorOAuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [appName, setAppName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const error =
      searchParams?.get('error') ||
      searchParams?.get('error_description') ||
      searchParams?.get('message');
    const app =
      searchParams?.get('app') ||
      searchParams?.get('appName') ||
      searchParams?.get('slug') ||
      searchParams?.get('toolkit') ||
      '';

    setAppName(app);

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      if (typeof window !== 'undefined' && window.opener) {
        window.opener.postMessage(
          {
            type: 'COMPOSIO_AUTH_ERROR',
            app,
            error,
          },
          window.location.origin,
        );
      }
      return;
    }

    setStatus('success');
    if (typeof window !== 'undefined' && window.opener) {
      window.opener.postMessage(
        {
          type: 'COMPOSIO_AUTH_SUCCESS',
          app,
          status: 'connected',
        },
        window.location.origin,
      );

      // Auto close after brief user acknowledgement
      const timer = window.setTimeout(() => {
        try {
          window.close();
        } catch {
          // Window closure may be restricted by some browser popup policies
        }
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-text p-6 text-center font-sans">
      <div className="w-full max-w-md p-8 bg-surface border border-border rounded-2xl shadow-xl space-y-6">
        <div className="flex justify-center">
          {status === 'processing' ? (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : status === 'success' ? (
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl">
              ✓
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-2xl">
              ✕
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-text">
            {status === 'processing'
              ? 'Finalizing Authorization...'
              : status === 'success'
                ? 'Connection Established'
                : 'Authorization Error'}
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            {status === 'processing'
              ? `Handshaking with ${appName || 'integration provider'} and syncing permissions.`
              : status === 'success'
                ? `Successfully connected ${appName || 'your integration'}. You can return to Vaeloom.`
                : errorMessage || 'The integration provider returned an authorization error.'}
          </p>
        </div>

        {appName && (
          <div className="flex justify-center">
            <Badge variant="mono" size="sm">
              App: {appName}
            </Badge>
          </div>
        )}

        <div className="pt-2">
          {status === 'success' ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                try {
                  window.close();
                } catch {
                  // Fallback
                }
              }}
              className="w-full"
            >
              Close Window
            </Button>
          ) : status === 'error' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  window.close();
                } catch {
                  // Fallback
                }
              }}
              className="w-full"
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
