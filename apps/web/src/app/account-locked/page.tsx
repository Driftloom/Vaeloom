'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Button, ShieldIcon, AlertTriangleIcon, KeyIcon } from '@vaeloom/ui-kit';

export default function AccountLockedPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md p-8 text-center space-y-6 border-border-strong shadow-xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center text-danger">
          <ShieldIcon size={32} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Account Temporarily Locked
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Your account was locked by zero-trust automated defenses following excessive failed
            login attempts or an anomalous security challenge.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-surface-100 border border-border-subtle text-left space-y-1.5 text-xs text-text-secondary">
          <div className="font-semibold text-text flex items-center gap-1.5">
            <AlertTriangleIcon size={14} className="text-warning" /> Security Policy Reference
          </div>
          <p className="text-2xs">
            To prevent brute-force attacks and token replay, workspace access is gated for 15
            minutes or until unlocked via your verified recovery email.
          </p>
          <div className="text-2xs text-text-muted pt-1">
            If you did not initiate these attempts, reset your password immediately or contact your
            administrator.
          </div>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <Link href="/forgot-password" className="w-full">
            <Button variant="primary" className="w-full">
              <span className="flex items-center justify-center gap-1.5">
                <KeyIcon size={14} /> Reset Password & Unlock
              </span>
            </Button>
          </Link>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Return to Sign In
            </Button>
          </Link>
        </div>

        <p className="text-2xs text-text-muted">
          Need immediate enterprise support? Contact your organization administrator or security
          officer.
        </p>
      </Card>
    </main>
  );
}
