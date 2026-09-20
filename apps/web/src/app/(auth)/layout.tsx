import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import MeteorShowerClient from '../../components/shared/MeteorShowerClient';

/**
 * Auth route-group layout (W-15): client pages cannot export metadata, so
 * this server wrapper provides titles for /login and /signup. It also mounts a
 * single shared meteor-shower background behind every auth page so the four
 * pages feel like one cohesive environment (no duplicate canvases / loops).
 *
 * NOTE: `ssr: false` with next/dynamic is not allowed in Server Components
 * (Next.js 15.5+). The dynamic import lives in MeteorShowerClient ('use client').
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Vaeloom workspace.',
};

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-background text-text">
      <div className="fixed inset-0 z-0 bg-background">
        <MeteorShowerClient variant="auth" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
