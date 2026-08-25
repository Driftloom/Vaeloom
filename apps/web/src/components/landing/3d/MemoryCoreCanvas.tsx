'use client';

/**
 * Hero scene wrapper — thin React shell around the vanilla-three
 * memory core. Remounts on theme/tier change; pauses via `active`.
 */

import { useEffect, useRef } from 'react';
import { densityForTier, type QualityTier } from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';
import { mountMemoryCore } from './vanilla/memoryCoreScene';

export default function MemoryCoreCanvas({
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
    const handle = mountMemoryCore({ container: el, theme, density: densityForTier(tier) });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.dispose();
    };
  }, [theme, tier]);

  useEffect(() => {
    handleRef.current?.setRunning(active);
  }, [active]);

  return <div ref={ref} className="h-full w-full" />;
}
