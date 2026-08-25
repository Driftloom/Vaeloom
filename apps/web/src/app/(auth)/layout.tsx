import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Auth route-group layout (W-15): client pages cannot export metadata, so
 * this server wrapper provides titles for /login and /signup.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Vaeloom workspace.',
};

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
