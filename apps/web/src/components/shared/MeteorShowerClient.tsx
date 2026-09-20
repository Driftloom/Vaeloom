'use client';

import dynamic from 'next/dynamic';

// Lazy-load the canvas so the auth form renders immediately on navigation.
// The meteor shower starts after the form is already visible — no blocking paint.
// NOTE: `ssr: false` is only allowed inside Client Components (Next.js 15.5+).
const MeteorShower = dynamic(() => import('./MeteorShower'), {
  ssr: false,
  loading: () => null,
});

type MeteorShowerClientProps = {
  variant?: 'auth' | 'free';
};

export default function MeteorShowerClient({ variant }: MeteorShowerClientProps) {
  return <MeteorShower variant={variant} />;
}
