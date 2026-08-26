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

import { useCallback, useEffect, useRef, useState } from 'react';

export function useReducedMotionPref(): boolean {
  // Resolve synchronously on first render (client-only modules) so we never
  // flash the WebGL scene and then swap to the static fallback.
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

let cachedWebGL: boolean | null = null;
export function useWebGLSupport(): boolean {
  // Resolve synchronously on first render (these scene modules are client-only,
  // loaded via dynamic(ssr:false)) so the canvas mounts immediately instead of
  // flashing the static fallback for one paint. Cached so the 7 scenes share
  // a single probe.
  const [supported] = useState<boolean>(() => {
    if (cachedWebGL !== null) return cachedWebGL;
    if (typeof document === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      cachedWebGL = Boolean(gl);
    } catch {
      cachedWebGL = false;
    }
    return cachedWebGL;
  });
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

/** Particle budget multiplier per tier — preserves atmosphere on mobile. */
export function densityForTier(tier: QualityTier): number {
  switch (tier) {
    case 'low':
      return 0.5; // 40-60% for mobile — keep it rich
    case 'medium':
      return 0.75; // 70-80% for tablet
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
  ref: (node: T | null) => void;
  inView: boolean;
} {
  const [node, setNode] = useState<T | null>(null);
  // Default to visible so in-view scenes (e.g. the hero) animate from the
  // first frame instead of pausing on a static first paint until the
  // IntersectionObserver fires. Off-screen scenes are corrected to false
  // immediately by the observer.
  const [inView, setInView] = useState(true);
  // Stable callback ref so the observer is (re)created whenever the element
  // actually mounts — even if it appears after an initial `webglReady` gate
  // (the element's <div ref> is absent on first render). Without this, the
  // observer never attaches and inView stays false forever.
  const setRef = useCallback((n: T | null) => setNode(n), []);
  useEffect(() => {
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin: margin },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [node, margin]);
  return { ref: setRef, inView };
}
