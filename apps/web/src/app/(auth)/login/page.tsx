'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError, api as apiClient } from '../../../lib/api';
import { useToast } from '@/components/shared/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') ?? null;
  const { login } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function handleSSO(provider: 'google' | 'microsoft') {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const res = await apiClient.request<{ auth_url?: string; authUrl?: string }>(
        `/auth/sso/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`,
      );
      const url =
        (res as Record<string, string>)['auth_url'] ?? (res as Record<string, string>)['authUrl'];
      if (url) {
        // Persist context for /auth/callback: the provider never echoes back
        // which app flow started the sign-in.
        sessionStorage.setItem('vaeloom.sso.provider', provider);
        if (redirect) sessionStorage.setItem('vaeloom.sso.redirect', redirect);
        window.location.href = url;
        return;
      }
      toast({
        tone: 'info',
        title: `${provider} SSO`,
        detail: 'No auth URL returned — check SSO provider configuration.',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'SSO not configured';
      if (msg.includes('Unsupported SSO provider') || msg.includes('not configured')) {
        toast({
          tone: 'info',
          title: 'SSO not enabled',
          detail: `${provider} SSO requires sso_providers config. Use email/password for now.`,
        });
      } else {
        toast({ tone: 'error', title: 'SSO failed', detail: msg });
      }
    }
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await login(email, password);
      if (redirect) {
        router.push(redirect);
        return;
      }
      // Resolve workspace for post-login navigation: / -> /workspace/{id}
      try {
        const { api } = await import('../../../lib/api');
        const workspaces = await api.listWorkspaces();
        if (Array.isArray(workspaces) && workspaces.length > 0 && workspaces[0]?.id) {
          router.push(`/workspace/${workspaces[0].id}`);
          return;
        }
        // Fallback: try /auth/me which also returns workspaces
        const me = await api.me();
        const ws = (me as unknown as { workspaces?: Array<{ id: string }> })?.workspaces;
        if (ws && ws.length > 0 && ws[0]?.id) {
          router.push(`/workspace/${ws[0].id}`);
          return;
        }
      } catch {
        // ignore, fall through to /
      }
      router.push('/');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Invalid credentials';
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface">
        {/* Gradient mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-glow-pulse" />
        <div
          className="absolute bottom-1/4 right-0 w-80 h-80 bg-accent/10 rounded-full blur-[100px] animate-glow-pulse"
          style={{ animationDelay: '1.5s' }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 lg:px-20">
          {/* Logo */}
          <div className="mb-12 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center shadow-glow">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-2xl font-bold text-text">Vaeloom</span>
            </div>
          </div>

          {/* Headline */}
          <p className="text-4xl lg:text-5xl font-bold text-text leading-tight mb-6 animate-slide-up">
            Your AI-powered
            <br />
            <span className="gradient-text">memory platform</span>
          </p>

          <p className="text-lg text-text-muted max-w-md animate-slide-up stagger-1">
            Organize your thoughts, automate workflows, and let AI agents handle the busywork while
            you focus on what matters.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3 mt-10 animate-slide-up stagger-2">
            {['Memory-first AI', '8 Smart Agents', 'Enterprise Ready'].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full bg-surface-200/50 border border-border text-sm text-text-300"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        {/* Subtle gradient orb */}
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
            <h1 className="text-2xl font-bold text-text mb-2">Welcome back</h1>
            <p className="text-text-muted">Sign in to continue to your workspace</p>
          </div>

          {/* Form card */}
          <div className="bg-surface-50 border border-border rounded-2xl p-8 shadow-card">
            <form onSubmit={onSubmit} className="space-y-5">
              {/* Email field */}
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
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={`input-field ${
                      errors.email ? 'input-error' : ''
                    } ${focusedField === 'email' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                  />
                  {focusedField === 'email' && !errors.email && (
                    <div className="absolute inset-0 rounded-xl ring-2 ring-primary/20 pointer-events-none" />
                  )}
                </div>
                {errors.email && (
                  <p
                    id="email-error"
                    className="text-sm text-error flex items-center gap-1.5 animate-slide-down"
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

              {/* Password field */}
              <div className="space-y-2">
                <label htmlFor="password" className="input-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    className={`input-field ${
                      errors.password ? 'input-error' : ''
                    } ${focusedField === 'password' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                  />
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    className="text-sm text-error flex items-center gap-1.5 animate-slide-down"
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

              {/* Forgot password */}
              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

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
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface-50 text-text-dim">or continue with</span>
              </div>
            </div>

            {/* Social login buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSSO('google')}
                className="btn-secondary flex items-center justify-center gap-2 py-2.5"
                aria-label="Continue with Google"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => handleSSO('microsoft')}
                className="btn-secondary flex items-center justify-center gap-2 py-2.5"
                aria-label="Continue with Microsoft"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                </svg>
                Microsoft
              </button>
            </div>
            <p className="text-xs text-text-dim text-center mt-2">
              SSO requires provider config (Google/Microsoft). SAML is not implemented.
            </p>
          </div>

          {/* Sign up link */}
          <p className="mt-8 text-center text-text-muted">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
            >
              Create account
            </Link>
          </p>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-text-dim">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="hover:text-text-muted transition-colors">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:text-text-muted transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
