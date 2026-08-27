'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api';
import { useToast } from '@/components/shared/Toast';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
      toast({
        tone: 'success',
        title: 'Reset email sent',
        detail: 'Check your inbox for a reset link.',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Request failed';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setError(
          'Password reset is not yet implemented on this deployment. Please contact support or use SSO if enabled.',
        );
        toast({
          tone: 'info',
          title: 'Reset not available',
          detail: 'Backend has no reset endpoint yet — use email/password or SSO.',
        });
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-center px-16 lg:px-20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-2xl font-bold text-text">Vaeloom</span>
          </div>
          <h1 className="text-4xl font-bold text-text leading-tight mt-8">Reset your password</h1>
          <p className="text-lg text-text-muted mt-4 max-w-md">
            Enter your email and we will send a secure reset link. The link expires in 15 minutes.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text">Forgot password</h2>
            <p className="text-text-muted">We will email you a reset link</p>
          </div>
          <div className="bg-surface-50 border border-border rounded-2xl p-8 shadow-card">
            {sent ? (
              <div className="text-center space-y-4">
                <p className="text-text">
                  If an account exists for <span className="font-mono font-medium">{email}</span>, a
                  reset link has been sent.
                </p>
                <p className="text-sm text-text-muted">
                  Check spam and try SSO if you have a provider linked.
                </p>
                <Link href="/login" className="btn-primary w-full inline-block text-center">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="input-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={`input-field ${error ? 'input-error' : ''}`}
                  />
                  {error && (
                    <p className="text-sm text-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-primary py-3.5 disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send reset link'}
                </button>
                <p className="text-xs text-text-dim text-center">
                  Backend endpoint POST /auth/forgot-password is required. If not deployed, contact
                  workspace admin.
                </p>
              </form>
            )}
          </div>
          <p className="mt-6 text-center text-text-muted text-sm">
            <Link href="/login" className="text-primary-400 hover:text-primary-300">
              Back to sign in
            </Link>{' '}
            ·{' '}
            <Link href="/signup" className="text-primary-400">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
