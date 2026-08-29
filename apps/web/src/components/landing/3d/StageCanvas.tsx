'use client';

/**
 * StageCanvas — single persistent full-viewport canvas behind the whole
 * landing page. Phase B renders Beat 0 (hero Memory Core); the shared page
 * scroll progress drives the camera. The canvas is non-interactive and sits
 * behind all content. Disabled (renders nothing) when WebGL is unavailable or
 * reduced motion is requested — the hero then shows the static SVG fallback.
 */

import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import {
  densityForTier,
  useQualityTier,
  useWebGLSupport,
  useReducedMotionPref,
} from '@/lib/landing/hooks';
import { usePageScrollProgress } from '@/lib/landing/scroll';
import { mountStage } from './vanilla/stageScene';
import type { Pointer } from './vanilla/memoryCoreScene';
import type { SceneHandle } from './vanilla/engine';

export default function StageCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const pointerRef = useRef<Pointer>({ x: 0, y: 0 });
  const progressRef = usePageScrollProgress();

  const { theme } = useTheme();
  const tier = useQualityTier();
  const webgl = useWebGLSupport();
  const reduce = useReducedMotionPref();
  const available = webgl && !reduce;

  useEffect(() => {
    if (!available) return;
    const el = ref.current;
    if (!el) return;
    const handle = mountStage({
      container: el,
      theme,
      density: densityForTier(tier),
      tier,
      pointer: pointerRef.current,
      getProgress: () => progressRef.current ?? 0,
    });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.dispose();
    };
  }, [available, theme, tier, progressRef]);

  // subtle mouse parallax — window-level so it works behind the UI overlay
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  if (!available) return null;
  return <div ref={ref} className="pointer-events-none fixed inset-0 -z-20" aria-hidden="true" />;
}
