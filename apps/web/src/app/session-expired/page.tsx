'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearToken, clearRefreshToken } from '../../lib/api';

export default function SessionExpiredPage() {
  const router = useRouter();

  useEffect(() => {
    clearToken();
    clearRefreshToken();
    const timer = window.setTimeout(() => {
      router.push('/login');
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-warning"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h1 className="text-4xl font-display font-bold text-text mb-4">Session Expired</h1>
      <h2 className="text-xl font-display font-medium text-text mb-2">Your session has ended</h2>
      <p className="text-text-muted max-w-sm mb-8">
        For your security, your session has expired. Please sign in again to continue.
      </p>
      <div className="flex flex-col items-center gap-4">
        <Link href="/login" className="btn-primary px-8">
          Sign in again
        </Link>
        <p className="text-xs text-text-dim">
          Redirecting to sign in automatically in 5 seconds...
        </p>
      </div>
    </main>
  );
}
