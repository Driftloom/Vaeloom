'use client';

/**
 * Growth scene wrapper — scroll-scrubbed via a progress ref (0..1).
 */

import { useEffect, useRef } from 'react';
import type { QualityTier } from '@/lib/landing/hooks';

type GrowthApi = {
  setRunning: (r: boolean) => void;
  setProgress: (p: number) => void;
  dispose: () => void;
};

export default function GrowthCanvas({
  theme,
  progressRef,
}: {
  theme: 'dark' | 'light';
  tier: QualityTier;
  progressRef: React.RefObject<number>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mounted = true;
    let raf = 0;
    let disposeFn: (() => void) | null = null;
    void import('./vanilla/growthScene').then(({ mountGrowth }) => {
      if (!mounted || !ref.current) return;
      const handle = mountGrowth({ container: ref.current, theme });
      let last = -1;
      const loop = (): void => {
        raf = requestAnimationFrame(loop);
        const p = progressRef.current ?? 0;
        if (Math.abs(p - last) > 0.0015) {
          last = p;
          handle.setProgress(p);
        }
      };
      loop();
      disposeFn = () => {
        cancelAnimationFrame(raf);
        handle.dispose();
      };
    });
    return () => {
      mounted = false;
      disposeFn?.();
    };
  }, [theme, progressRef]);

  return <div ref={ref} className="h-full w-full" />;
}
