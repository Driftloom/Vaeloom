'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError, api } from '../../../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

function getPasswordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const passwordStrength = getPasswordStrength(password);

  // F-02/F-28: these buttons previously had no handlers. SSO signup is real:
  // the backend auto-provisions the account from the provider email on
  // callback (auth.py auto-provision), so we reuse the login SSO flow.
  async function handleSSO(provider: string) {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const res = await api.request<{ auth_url?: string; authUrl?: string }>(
        `/auth/sso/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`,
      );
      const url =
        (res as Record<string, string>)['auth_url'] ?? (res as Record<string, string>)['authUrl'];
      if (url) {
        sessionStorage.setItem('vaeloom.sso.provider', provider);
        window.location.href = url;
        return;
      }
      setErrors({ form: `${provider} sign-up is not configured. Use email and password.` });
    } catch (err) {
      setErrors({
        form:
          err instanceof Error && err.message.includes('not configured')
            ? `${provider} sign-up requires sso_providers config. Use email and password for now.`
            : 'Could not start provider sign-up.',
      });
    }
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (!PASSWORD_RE.test(password))
      e.password = 'At least 8 characters with a letter and number';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await signup(email, password, displayName || undefined);
      // New users get auto-created workspace in backend; navigate directly
      try {
        const { api } = await import('../../../lib/api');
        const workspaces = await api.listWorkspaces();
        if (Array.isArray(workspaces) && workspaces.length > 0 && workspaces[0]?.id) {
          router.push(`/workspace/${workspaces[0].id}`);
          return;
        }
        const me = await api.me();
        const ws = (me as unknown as { workspaces?: Array<{ id: string }> })?.workspaces;
        if (ws && ws.length > 0 && ws[0]?.id) {
          router.push(`/workspace/${ws[0].id}`);
          return;
        }
      } catch {
        // fall through
      }
      router.push('/');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong';
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/5" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-accent-500/15 rounded-full blur-[120px] animate-glow-pulse" />
        <div
          className="absolute bottom-1/4 left-10 w-80 h-80 bg-primary/10 rounded-full blur-[100px] animate-glow-pulse"
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-primary-500 flex items-center justify-center shadow-glow">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-2xl font-bold text-text">Vaeloom</span>
            </div>
          </div>
          <p className="text-4xl lg:text-5xl font-bold text-text leading-tight mb-6 animate-slide-up">
            Start building your
            <br />
            <span className="bg-gradient-to-r from-accent-400 via-primary-400 to-primary-300 bg-clip-text text-transparent">
              AI memory
            </span>
          </p>
          <p className="text-lg text-text-muted max-w-md animate-slide-up stagger-1">
            Join thousands who are transforming how they work with AI. Your memories, your agents,
            your rules.
          </p>
          <div className="grid grid-cols-3 gap-8 mt-12 animate-slide-up stagger-2">
            <div>
              <div className="text-3xl font-bold text-text">10K+</div>
              <div className="text-sm text-text-muted mt-1">Active users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-text">8</div>
              <div className="text-sm text-text-muted mt-1">AI Agents</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-text">99.9%</div>
              <div className="text-sm text-text-muted mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
        <div className="w-full max-w-[420px] relative z-10">
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-2xl font-bold text-text">Vaeloom</span>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text mb-2">Create your account</h1>
            <p className="text-text-muted">Get started in seconds</p>
          </div>

          <div className="bg-surface-50 border border-border rounded-2xl p-8 shadow-card">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="displayName" className="input-label">
                  Full name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Your name"
                  autoComplete="name"
                  className={`input-field ${focusedField === 'name' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="input-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`input-field ${errors.email ? 'input-error' : ''} ${focusedField === 'email' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                />
                {errors.email && (
                  <p className="text-sm text-error flex items-center gap-1.5 animate-slide-down">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="input-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className={`input-field ${errors.password ? 'input-error' : ''} ${focusedField === 'password' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                />
                {password && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i < passwordStrength
                              ? passwordStrength <= 1
                                ? 'bg-error'
                                : passwordStrength === 2
                                  ? 'bg-warning'
                                  : 'bg-success'
                              : 'bg-surface-300'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-text-dim">
                      {passwordStrength <= 1 && 'Weak'}
                      {passwordStrength === 2 && 'Fair'}
                      {passwordStrength === 3 && 'Good'}
                      {passwordStrength === 4 && 'Strong'}
                    </p>
                  </div>
                )}
                {errors.password && <p className="text-sm text-error">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="input-label">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className={`input-field ${errors.confirmPassword ? 'input-error' : ''} ${focusedField === 'confirm' ? 'ring-2 ring-primary/20 border-primary' : ''}`}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-error">{errors.confirmPassword}</p>
                )}
              </div>

              {errors.form && (
                <div
                  className="p-4 rounded-xl bg-error/10 border border-error/20 animate-slide-down"
                  role="alert"
                >
                  <p className="text-sm text-error">{errors.form}</p>
                </div>
              )}

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
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface-50 text-text-dim">or sign up with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSSO('google')}
                className="btn-secondary flex items-center justify-center gap-2 py-2.5"
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
                onClick={() => handleSSO('github')}
                className="btn-secondary flex items-center justify-center gap-2 py-2.5"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-text-muted">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-text-dim">
            By creating an account, you agree to our{' '}
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
