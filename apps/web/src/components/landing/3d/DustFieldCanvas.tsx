'use client';

/**
 * Global dust field wrapper — full-viewport fixed canvas.
 */

import { useEffect, useRef } from 'react';
import { densityForTier, type QualityTier } from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';

export default function DustFieldCanvas({
  theme,
  tier,
}: {
  theme: 'dark' | 'light';
  tier: QualityTier;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mounted = true;
    let disposeFn: (() => void) | null = null;
    void import('./vanilla/dustField').then(({ mountDustField }) => {
      if (!mounted || !ref.current) return;
      const handle: SceneHandle = mountDustField({
        container: ref.current,
        theme,
        density: densityForTier(tier),
      });
      disposeFn = handle.dispose;
    });
    return () => {
      mounted = false;
      disposeFn?.();
    };
  }, [theme, tier]);

  return <div ref={ref} className="h-full w-full" />;
}
