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
          'This area is not part of the current release. It is hidden until the enterprise APIs are wired.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/workspace" className="btn-primary">
          Back to your workspace
        </Link>
        <a href="mailto:enterprise@vaeloom.app" className="btn-secondary">
          Contact sales
        </a>
      </div>
    </div>
  );
}

export function isEnterpriseEnabled(): boolean {
  return process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] === 'true';
}
