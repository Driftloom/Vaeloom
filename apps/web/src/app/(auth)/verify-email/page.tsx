'use client';
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '../../../lib/api';
import { Spinner } from '@vaeloom/ui-kit';

/**
 * The single h1 for this route, shared by every status branch.
 *
 * Each of success / error / no-token / loading used to carry its own inline
 * heading, so the file had four of them and the guardrail could not tell whether
 * they were branch-exclusive. One component, one h1 in source, one rendered.
 */
function VerificationHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-display font-medium text-text">{title}</h1>
      <p className="text-text-muted">{detail}</p>
    </>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }
    api
      .request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified. You can now sign in.');
      })
      .catch((err) => {
        setStatus('error');
        if (err instanceof ApiError) {
          setMessage(
            err.status === 404
              ? 'Verification endpoint not available on this deployment.'
              : err.message,
          );
        } else {
          setMessage(err instanceof Error ? err.message : 'Verification failed');
        }
      });
  }, [token]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background p-4 sm:p-8 overflow-y-auto overscroll-y-contain">
      <div className="w-full max-w-[400px] text-center space-y-6 my-auto">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="text-2xl font-bold text-text">Vaeloom</span>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <VerificationHeading
              title="Verifying your email"
              detail="Hold on while we confirm the link you followed."
            />
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <VerificationHeading title="Email verified" detail={message} />
            <Link href="/login" className="btn-primary inline-block">
              Sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-error/10 border border-error/30 flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <VerificationHeading title="Verification failed" detail={message} />
            <Link href="/login" className="btn-primary inline-block">
              Back to sign in
            </Link>
          </>
        )}

        {status === 'no-token' && (
          <>
            <VerificationHeading
              title="No verification token"
              detail="The verification link is missing a token. Please check your email for the correct link."
            />
            <Link href="/login" className="btn-primary inline-block">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Spinner size="lg" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
