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
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { BEATS, type BeatDef } from '@/components/landing/3d/vanilla/worldConstants';

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
 * Local scroll progress for a section element, matching the previous
 * per-section math. `viewLead`/`viewTrail` are the viewport biases used by
 * HowItWorks (0.5/0.5) and Compounding (0.6/0.4).
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
      const total = rect.height - vh * viewTrail;
      const p = total > 0 ? (-rect.top + vh * viewLead) / total : 0;
      progressRef.current = Math.min(1, Math.max(0, p));
    };
    return register(cb);
  }, [ref, register, viewLead, viewTrail]);

  return progressRef;
}

/**
 * Resolve the currently active beat from page scroll progress.
 * Returns the beat definition and local progress (0..1) within that beat.
 */
export function useActiveBeat(): { beat: BeatDef; local: number; index: number } {
  const pageRef = usePageScrollProgress();
  const [state, setState] = useState<{ beat: BeatDef; local: number; index: number }>(() => ({
    beat: BEATS[0]!,
    local: 0,
    index: 0,
  }));

  usePageScrollSubscribe(() => {
    const p = pageRef.current ?? 0;
    // Find which beat's scrollRange contains the current progress
    for (let i = 0; i < BEATS.length; i++) {
      const b = BEATS[i]!;
      const [start, end] = b.scrollRange;
      if (p >= start && p <= end) {
        const span = end - start;
        const local = span > 0 ? (p - start) / span : 0;
        setState({ beat: b, local, index: i });
        return;
      }
    }
    // Past last beat — clamp to CTA
    const last = BEATS[BEATS.length - 1]!;
    setState({ beat: last, local: 1, index: BEATS.length - 1 });
  });

  return state;
}

/**
 * Returns active beat id string — lightweight version for StageProvider.
 */
export function useActiveBeatId(): string {
  const pageRef = usePageScrollProgress();
  const [id, setId] = useState(BEATS[0]!.id);

  usePageScrollSubscribe(() => {
    const p = pageRef.current ?? 0;
    for (let i = 0; i < BEATS.length; i++) {
      const b = BEATS[i]!;
      if (p >= b.scrollRange[0] && p <= b.scrollRange[1]) {
        setId(b.id);
        return;
      }
    }
    setId(BEATS[BEATS.length - 1]!.id);
  });

  return id;
}
