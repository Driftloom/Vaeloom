import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import MeteorShower from '../../components/shared/MeteorShower';

/**
 * Auth route-group layout (W-15): client pages cannot export metadata, so
 * this server wrapper provides titles for /login and /signup. It also mounts a
 * single shared meteor-shower background behind every auth page so the four
 * pages feel like one cohesive environment (no duplicate canvases / loops).
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Vaeloom workspace.',
};

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-background text-text">
      <div className="fixed inset-0 z-0 bg-background">
        <MeteorShower variant="auth" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
