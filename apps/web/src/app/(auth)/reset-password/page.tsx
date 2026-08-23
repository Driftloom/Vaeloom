'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api as apiClient, ApiError } from '../../../lib/api';
import { useToast } from '@/components/shared/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  function validateEmailRequest(): boolean {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateResetRequest(): boolean {
    const e: typeof errors = {};
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onRequestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmailRequest()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await apiClient.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
      toast({
        tone: 'success',
        title: 'Reset email sent',
        detail: 'Check your inbox for a password reset link.',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Request failed';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setErrors({
          form: 'Password reset is not yet available on this deployment. Please contact support or use SSO if enabled.',
        });
        toast({
          tone: 'info',
          title: 'Reset not available',
          detail: 'Backend has no reset endpoint yet - use email/password or SSO.',
        });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!validateResetRequest()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await apiClient.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setResetComplete(true);
      toast({
        tone: 'success',
        title: 'Password reset',
        detail: 'Your password has been updated. You can now sign in.',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Reset failed';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setErrors({
          form: 'Password reset is not yet available on this deployment. Please contact support.',
        });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (resetComplete) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
          <div className="relative z-10 flex flex-col justify-center px-16 lg:px-20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-2xl font-bold text-text">Vaeloom</span>
            </div>
            <h1 className="text-4xl font-bold text-text leading-tight mt-8">Password updated</h1>
            <p className="text-lg text-text-muted mt-4 max-w-md">
              Your password has been successfully reset. You can now sign in with your new
              credentials.
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-[400px]">
            <div className="bg-surface-50 border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                &#10003;
              </div>
              <p className="text-text font-medium">Password successfully reset</p>
              <p className="text-sm text-text-muted">Sign in with your new password to continue.</p>
              <Link href="/login" className="btn-primary w-full inline-block text-center">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
          <div className="relative z-10 flex flex-col justify-center px-16 lg:px-20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-2xl font-bold text-text">Vaeloom</span>
            </div>
            <h1 className="text-4xl font-bold text-text leading-tight mt-8">Check your email</h1>
            <p className="text-lg text-text-muted mt-4 max-w-md">
              We sent a password reset link to your inbox. The link expires in 15 minutes.
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-[400px]">
            <div className="bg-surface-50 border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-glow-pulse" />
        <div
          className="absolute bottom-1/4 right-0 w-80 h-80 bg-accent/10 rounded-full blur-[100px] animate-glow-pulse"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16 lg:px-20">
          <div className="mb-12 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center shadow-glow">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-2xl font-bold text-text">Vaeloom</span>
            </div>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-text leading-tight mb-6 animate-slide-up">
            {token ? 'Set a new password' : 'Reset your password'}
          </h1>
          <p className="text-lg text-text-muted max-w-md animate-slide-up stagger-1">
            {token
              ? 'Choose a strong password that you have not used before.'
              : 'Enter your email and we will send a secure reset link. The link expires in 15 minutes.'}
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-2xl font-bold text-text">Vaeloom</span>
            </div>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text mb-2">
              {token ? 'New password' : 'Forgot password'}
            </h2>
            <p className="text-text-muted">
              {token ? 'Enter your new password below' : 'We will email you a reset link'}
            </p>
          </div>

          {/* Form card */}
          <div className="bg-surface-50 border border-border rounded-2xl p-8 shadow-card">
            <form onSubmit={token ? onResetPassword : onRequestReset} className="space-y-5">
              {/* Email field (no token mode) */}
              {!token && (
                <div className="space-y-2">
                  <label htmlFor="email" className="input-label">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`input-field ${
                        errors.email ? 'input-error' : ''
                      } ${focusedField === 'email' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                    />
                  </div>
                  {errors.email && (
                    <p
                      className="text-sm text-error flex items-center gap-1.5 animate-slide-down"
                      role="alert"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {errors.email}
                    </p>
                  )}
                </div>
              )}

              {/* Password field (token mode) */}
              {token && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="password" className="input-label">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className={`input-field ${
                          errors.password ? 'input-error' : ''
                        } ${focusedField === 'password' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                      />
                    </div>
                    {errors.password && (
                      <p
                        className="text-sm text-error flex items-center gap-1.5 animate-slide-down"
                        role="alert"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="input-label">
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        className={`input-field ${
                          errors.confirmPassword ? 'input-error' : ''
                        } ${focusedField === 'confirmPassword' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p
                        className="text-sm text-error flex items-center gap-1.5 animate-slide-down"
                        role="alert"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Error message */}
              {errors.form && (
                <div
                  className="p-4 rounded-xl bg-error/10 border border-error/20 animate-slide-down"
                  role="alert"
                >
                  <p className="text-sm text-error flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {errors.form}
                  </p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {token ? 'Resetting...' : 'Sending...'}
                  </>
                ) : token ? (
                  'Reset password'
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          </div>

          {/* Back to login link */}
          <p className="mt-8 text-center text-text-muted">
            Remember your password?{' '}
            <Link
              href="/login"
              className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center animate-pulse">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <p className="text-text-muted text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
