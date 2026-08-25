'use client';

/**
 * Landing support hooks — WebGL capability, device quality tier,
 * in-view pausing, and reduced-motion awareness.
 *
 * The 3D system degrades gracefully:
 *   reduced-motion  -> static SVG fallback (no WebGL at all)
 *   no WebGL        -> static SVG fallback
 *   low quality     -> WebGL with reduced particle counts / DPR
 *   capable         -> full scene, DPR capped at 1.75
 */

import { useEffect, useRef, useState } from 'react';

export function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      setSupported(Boolean(gl));
    } catch {
      setSupported(false);
    }
  }, []);
  return supported;
}

export type QualityTier = 'high' | 'medium' | 'low';

export function useQualityTier(): QualityTier {
  const [tier, setTier] = useState<QualityTier>('high');
  useEffect(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 8;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const smallViewport = window.innerWidth < 768;
    let next: QualityTier = 'high';
    if (mem <= 4 || cores <= 4 || (coarsePointer && smallViewport)) next = 'low';
    else if (coarsePointer || smallViewport) next = 'medium';
    setTier(next);
  }, []);
  return tier;
}

/** DPR cap per tier — keeps fragment cost predictable on mobile GPUs. */
export function dprForTier(tier: QualityTier): [number, number] {
  switch (tier) {
    case 'low':
      return [0.75, 1];
    case 'medium':
      return [1, 1.25];
    default:
      return [1, 1.75];
  }
}

/** Particle budget multiplier per tier. */
export function densityForTier(tier: QualityTier): number {
  switch (tier) {
    case 'low':
      return 0.35;
    case 'medium':
      return 0.65;
    default:
      return 1;
  }
}

/**
 * Returns a ref + visible flag. Scenes render only while on screen;
 * R3F frameloop is toggled by the consumer.
 */
export function useInView<T extends HTMLElement>(
  margin = '200px',
): {
  ref: React.RefObject<T>;
  inView: boolean;
} {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin: margin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margin]);
  return { ref, inView };
}
