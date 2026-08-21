'use client';
import React from 'react';
import Link from 'next/link';

export function EnterpriseGated({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-mono uppercase tracking-widest text-text-dim mb-4">
        Enterprise — Gated
      </div>
      <h1 className="text-2xl font-display font-medium text-text mb-2">
        {feature} is an Enterprise feature
      </h1>
      <p className="text-text-muted max-w-lg">
        {description ??
          'This area is not part of the MVP. It is hidden in production builds and will be enabled when the enterprise APIs are wired.'}
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/workspaces" className="btn-primary">
          Back to workspaces
        </Link>
        <a href="mailto:enterprise@vaeloom.app" className="btn-secondary">
          Contact sales
        </a>
      </div>
      <p className="text-xs text-text-dim mt-4 font-mono">
        Set NEXT_PUBLIC_ENABLE_ENTERPRISE=true to preview.
      </p>
    </div>
  );
}

export function isEnterpriseEnabled(): boolean {
  return process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] === 'true';
}
