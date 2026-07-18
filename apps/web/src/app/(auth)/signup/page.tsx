'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { Input, Button } from '@vaeloom/ui-kit';
import { ApiError } from '../../../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    else if (!PASSWORD_RE.test(password)) e.password = 'At least 8 characters with a letter and a number';
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
      router.push('/');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong';
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h1 className="text-2xl font-display font-medium text-text">Create your account</h1>
          <p className="mt-1 text-sm text-text-muted">Get started with Vaeloom</p>
        </div>
        <div className="card p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Display name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name (optional)"
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
            {errors.form && (
              <p role="alert" className="text-sm text-accent bg-accent/10 rounded-lg px-3 py-2">{errors.form}</p>
            )}
            <Button type="submit" loading={submitting} fullWidth>
              Create account
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:text-primary-hover font-medium">Log in</Link>
        </p>
      </div>
    </main>
  );
}
