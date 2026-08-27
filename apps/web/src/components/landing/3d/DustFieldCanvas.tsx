'use client';

/**
 * Global dust field wrapper — full-viewport fixed canvas.
 *
 * Lifecycle: runs only while the hero is on screen. It pauses when the
 * visitor scrolls past the hero (and when the tab is hidden — handled in
 * the engine) so it never burns GPU/CPU deep in the page. Disposal frees
 * the WebGL context on unmount.
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
    let handleRef: SceneHandle | null = null;
    let obs: IntersectionObserver | null = null;

    void import('./vanilla/dustField').then(({ mountDustField }) => {
      if (!mounted || !ref.current) return;
      const handle: SceneHandle = mountDustField({
        container: ref.current,
        theme,
        density: densityForTier(tier),
        tier,
      });
      handleRef = handle;
      disposeFn = handle.dispose;

      // Pause the ambient field once the hero scrolls out of view.
      const hero = document.getElementById('hero');
      if (hero) {
        obs = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (entry) handle.setRunning(entry.isIntersecting);
          },
          { threshold: 0 },
        );
        obs.observe(hero);
      }
    });

    return () => {
      mounted = false;
      obs?.disconnect();
      handleRef = null;
      disposeFn?.();
    };
  }, [theme, tier]);

  return <div ref={ref} className="h-full w-full" />;
}
