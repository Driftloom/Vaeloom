'use client';

/**
 * Landing scroll foundation (Phase A).
 *
 * One passive scroll listener + rAF-throttled flush drives a single shared
 * progress source for the whole landing page. This replaces the two duplicate
 * per-section rAF scroll loops (HowItWorks, CompoundingSection) and gives the
 * future end-to-end "Stage" canvas one normalized `pageProgress` to read.
 *
 * Design notes:
 *  - Scroll-driven (not a perpetual rAF): the flush only runs when the user
 *    actually scrolls or the viewport resizes, so there is no idle GPU/CPU burn.
 *  - `useSectionProgress(ref)` reproduces the exact local-progress math the
 *    section canvases already consumed, so their visuals are unchanged.
 *  - A safe no-op fallback is provided when rendered without the provider
 *    (e.g. unit tests), so nothing crashes.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type RefObject,
} from 'react';

type ScrollApi = {
  pageProgressRef: RefObject<number>;
  register: (cb: () => void) => () => void;
};

const LandingScrollContext = createContext<ScrollApi | null>(null);

function computePageProgress(): number {
  if (typeof window === 'undefined') return 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

export function LandingScrollProvider({ children }: { children: ReactNode }) {
  const pageProgressRef = useRef(0);
  const subscribers = useRef<Set<() => void>>(new Set());
  const rafPending = useRef(false);

  const register = useCallback((cb: () => void) => {
    subscribers.current.add(cb);
    cb(); // compute initial state immediately
    return () => {
      subscribers.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const flush = (): void => {
      rafPending.current = false;
      pageProgressRef.current = computePageProgress();
      subscribers.current.forEach((cb) => cb());
    };
    const onScroll = (): void => {
      if (rafPending.current) return;
      rafPending.current = true;
      raf = requestAnimationFrame(flush);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <LandingScrollContext.Provider value={{ pageProgressRef, register }}>
      {children}
    </LandingScrollContext.Provider>
  );
}

function useLandingScroll(): ScrollApi {
  const ctx = useContext(LandingScrollContext);
  if (ctx) return ctx;
  // Safe no-op fallback for standalone renders (e.g. tests) without a provider.
  return {
    pageProgressRef: { current: 0 } as RefObject<number>,
    register: () => () => {},
  };
}

/** Normalized page scroll progress 0..1 — for the future Stage canvas. */
export function usePageScrollProgress(): RefObject<number> {
  return useLandingScroll().pageProgressRef;
}

/** Subscribe a callback to the (rAF-throttled) scroll flush. */
export function usePageScrollSubscribe(cb: () => void): void {
  const { register } = useLandingScroll();
  useEffect(() => register(cb), [cb, register]);
}

/**
 * Local scroll progress for a section element, 0..1.
 *
 * Height-independent by construction. The previous formula divided by
 * `rect.height - vh * viewTrail`, which goes NEGATIVE for any element shorter
 * than half the viewport — and then returned 0 forever. That silently pinned
 * every short slot (the compounding frame, the connectors frame) to progress
 * 0, so scroll-scrubbed scenes never assembled. The bug was invisible because
 * it only affected elements too small to notice as "stuck".
 *
 * Now progress is measured as the distance the element has travelled between
 * two well-defined moments, both of which exist for any height:
 *   p = 0  →  the element's top edge is `viewLead` down the viewport
 *   p = 1  →  the element's bottom edge is `viewTrail` above the viewport top
 */
export function useSectionProgress(
  ref: RefObject<HTMLElement>,
  opts: { viewLead?: number; viewTrail?: number } = {},
): RefObject<number> {
  const { viewLead = 0.5, viewTrail = 0.5 } = opts;
  const { register } = useLandingScroll();
  const progressRef = useRef(0);

  useEffect(() => {
    const cb = (): void => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * viewLead;
      const end = -rect.height - vh * viewTrail;
      const span = start - end;
      const p = span > 0 ? (start - rect.top) / span : 0;
      progressRef.current = Math.min(1, Math.max(0, p));
    };
    return register(cb);
  }, [ref, register, viewLead, viewTrail]);

  return progressRef;
}
