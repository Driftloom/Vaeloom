'use client';

/**
 * CTA core wrapper — calm variant of the hero memory core (no streams).
 */

import { useEffect, useRef } from 'react';
import { densityForTier, type QualityTier } from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';

export default function CtaCoreCanvas({
  theme,
  tier,
  active,
}: {
  theme: 'dark' | 'light';
  tier: QualityTier;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mounted = true;
    void import('./vanilla/memoryCoreScene').then(({ mountMemoryCore }) => {
      if (!mounted || !ref.current) return;
      const handle = mountMemoryCore({
        container: ref.current,
        theme,
        density: densityForTier(tier) * 0.8,
        tier,
        streams: false,
      });
      handleRef.current = handle;
      handle.setRunning(active);
    });
    return () => {
      mounted = false;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, tier]);

  useEffect(() => {
    handleRef.current?.setRunning(active);
  }, [active]);

  return <div ref={ref} className="h-full w-full" />;
}
