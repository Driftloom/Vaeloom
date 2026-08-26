'use client';

/**
 * Hero scene wrapper — thin React shell around the vanilla-three
 * memory core. Remounts on theme/tier change; pauses via `active`.
 */

import { useEffect, useRef } from 'react';
import { densityForTier, type QualityTier } from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';
import { mountMemoryCore, type Pointer } from './vanilla/memoryCoreScene';

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
  const pointerRef = useRef<Pointer>({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = mountMemoryCore({
      container: el,
      theme,
      density: densityForTier(tier),
      tier,
      pointer: pointerRef.current,
    });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.dispose();
    };
  }, [theme, tier]);

  // subtle mouse parallax — window-level so it works behind the UI overlay
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    handleRef.current?.setRunning(active);
  }, [active]);

  return <div ref={ref} className="h-full w-full" />;
}
