'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, Badge, Button, BuildingIcon, CheckIcon, ShieldIcon, Spinner } from '@vaeloom/ui-kit';

export default function WorkspaceInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.['token'] === 'string' ? params['token'] : '';

  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    // Simulate deterministic handshake
    setTimeout(() => {
      setAccepting(false);
      setAccepted(true);
      setTimeout(() => {
        router.push('/workspace');
      }, 1500);
    }, 1000);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg p-8 text-center space-y-6 border-border-strong shadow-xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-action/10 flex items-center justify-center text-action">
          <BuildingIcon size={32} />
        </div>

        <div className="space-y-2">
          <Badge variant="primary" size="sm">
            ORGANIZATION INVITATION
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Join Vaeloom Research Workspace
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            You have been invited by the enterprise administrator to collaborate in a high-security
            autonomous intelligence workspace.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface-100 border border-border-subtle text-left space-y-2.5 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-border-subtle">
            <span className="text-text-muted">Target Organization:</span>
            <span className="font-semibold text-text">Acme Distributed Labs</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-border-subtle">
            <span className="text-text-muted">Assigned Security Role:</span>
            <span className="font-mono text-text font-semibold">Security Reviewer (RBAC)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Tenant Isolation:</span>
            <span className="text-success font-medium flex items-center gap-1">
              <ShieldIcon size={12} /> Row-Level Security Enforced
            </span>
          </div>
        </div>

        {accepted ? (
          <div className="p-4 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center justify-center gap-2">
            <CheckIcon size={16} /> Invitation accepted! Redirecting to workspace...
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleAccept}
              disabled={accepting}
            >
              <span className="flex items-center justify-center gap-1.5">
                {accepting ? <Spinner size="sm" /> : <CheckIcon size={14} />}
                {accepting ? 'Connecting...' : 'Accept Invitation & Enter'}
              </span>
            </Button>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                Decline
              </Button>
            </Link>
          </div>
        )}

        <div className="text-2xs font-mono text-text-muted pt-2 border-t border-border-subtle">
          Token: <code className="bg-surface-200 px-1 py-0.5 rounded">{token.slice(0, 16)}...</code>
        </div>
      </Card>
    </main>
  );
}
