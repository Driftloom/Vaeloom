'use client';

/**
 * SceneShell — the ONLY place WebGL scenes mount.
 *
 * Responsibilities:
 *  - decide WebGL vs static fallback (support + reduced-motion)
 *  - lazy-load scene chunks with ssr:false (never blocks first paint)
 *  - pause rendering off-screen via IntersectionObserver
 *  - pass quality tier + theme down
 *
 * While loading or unsupported, `fallback` renders in its place —
 * never a blank canvas, never a broken frame.
 */

import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  useQualityTier,
  densityForTier,
  useReducedMotionPref,
  useWebGLSupport,
} from '@/lib/landing/hooks';
import { useTheme } from '@/hooks/useTheme';
import { usePageScrollSubscribe, useSectionProgress } from '@/lib/landing/scroll';
import { createStage, type StageHandle } from './vanilla/stageScene';

/** Resolved theme for scene wrappers (dark is SSR/brand default). */
function useThemeValue(): Theme {
  const { theme } = useTheme();
  return theme === 'light' ? 'light' : 'dark';
}

const DustFieldCanvas = dynamic(() => import('./DustFieldCanvas'), { ssr: false });

type Theme = 'dark' | 'light';

/**
 * Whether the live WebGL stage can run at all: WebGL support plus a tier
 * above low.
 *
 * Reduced motion is deliberately NOT part of this. It used to be, which meant
 * a reduced-motion visitor got a captured poster instead of the scene -- and
 * since only 7 of 16 beats have a poster, 9 of them rendered a broken image.
 * Stripping the page of its own composition is a worse accessibility outcome
 * than showing that composition motionless. Reduced motion is now honoured
 * INSIDE the renderer: the scene composes and renders, but time does not
 * advance.
 */
export function useSceneAvailable(): boolean {
  const supported = useWebGLSupport();
  const tier = useQualityTier();
  return Boolean(supported) && tier !== 'low';
}

/**
 * Global ambient dust behind the whole landing. Skipped entirely on low
 * tiers and reduced motion — it is pure atmosphere, never information.
 * Self-themed so server components can mount it directly.
 */
export function DustField() {
  const available = useSceneAvailable();
  const theme = useThemeValue();
  // Honour the DETECTED tier. This used to hardcode "high", so a low-end
  // device paid full particle cost for a layer that is only atmosphere —
  // and in light mode that density is what turns the hero into confetti.
  const tier = useQualityTier();
  if (!available) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <DustFieldCanvas theme={theme} tier={tier} />
    </div>
  );
}

/** Convenience hook for sections that need the resolved theme string. */
export function useLandingTheme(themeClass?: string): Theme {
  return useMemo(() => (themeClass === 'light' ? 'light' : 'dark'), [themeClass]);
}

/* ----------------------- Shared single-context Stage ----------------------- */

interface StageCtxValue {
  register: (beat: string, el: HTMLElement | null, getProgress: () => number) => void;
  select: (beat: string, id: string | number) => void;
  ready: boolean;
}

const StageCtx = createContext<StageCtxValue | null>(null);

/**
 * Tell the shared stage which item this beat's section has selected.
 *
 * One canvas hosts every scene, so a section cannot reach its own scene
 * directly — it asks the stage, which routes to whichever beat is active.
 * The stage keeps the selection per beat, so a section may set it before
 * scrolling into view and its scene is already correct when the beat
 * activates.
 *
 * Returns a stable callback, safe to call from an effect on selection
 * change, and a no-op when WebGL is unavailable or the beat's scene has no
 * selection channel.
 */
export function useStageSelection(beat: string): (id: string | number) => void {
  const ctx = useContext(StageCtx);
  return useCallback(
    (id: string | number) => {
      ctx?.select(beat, id);
    },
    [ctx, beat],
  );
}

/**
 * StageProvider owns ONE WebGL context for the whole page. As each section's
 * slot scrolls into view, the shared canvas is teleported into it and the
 * matching beat becomes active. This folds the per-section canvases into a
 * single renderer while preserving every section's existing layout.
 *
 * Beat switching is geometry-driven: the active beat is the registered slot
 * straddling the viewport focus line (see FOCUS_LINE). No scroll-position
 * table, so section height changes can't desync the camera from the content.
 */
/**
 * Viewport fraction that decides "the section you are reading". A slot that
 * spans this line is the active beat; otherwise the slot whose centre is
 * nearest to it wins. Slightly above centre because every landing section
 * opens with a heading in its upper third.
 */
const FOCUS_LINE = 0.45;

/** Ranking weight that makes "contains the focus line" beat "is nearest to it". */
const STRADDLE_BONUS = 1e6;

export function StageProvider({ children }: { children: ReactNode }): ReactElement {
  const available = useSceneAvailable();
  const tier = useQualityTier();
  const density = densityForTier(tier);
  const themeRes = useTheme();
  const theme = themeRes.theme === 'light' ? 'light' : 'dark';

  const stageRef = useRef<StageHandle | null>(null);
  const slotsRef = useRef<Map<string, { el: HTMLElement; getProgress: () => number }>>(new Map());
  const activeBeatRef = useRef('');
  const [ready, setReady] = useState(false);

  const register = useCallback(
    (beat: string, el: HTMLElement | null, getProgress: () => number) => {
      if (!el) {
        slotsRef.current.delete(beat);
        return;
      }
      slotsRef.current.set(beat, { el, getProgress });
    },
    [],
  );

  /**
   * Resolve the active beat from where the slots actually are on screen.
   *
   * This deliberately does NOT consult a table of scroll-position fractions.
   * A static table has to be hand-maintained against the real layout, and any
   * section that grows, shrinks, or gets added silently desyncs it — which is
   * exactly how the canvas ended up parked in the wrong section. Reading live
   * geometry cannot drift: whatever the CSS does, the camera follows.
   *
   * Ranking is two-tier, and both tiers matter:
   *   1. A slot that straddles the focus line always beats one that does not.
   *   2. Among straddling slots, the one whose CENTRE is nearest the line wins.
   *
   * Tier 2 is not optional. A slot can be taller than the viewport, or offset
   * (the hero drops its scene in light mode so it does not sit behind the
   * copy), in which case two slots straddle the same line at once. Ranking
   * those by registration order hands every tie to whichever section happens
   * to register first — which pinned the canvas to the hero for the entire
   * page. Nearest-centre is the tie-break that matches what a reader is
   * actually looking at.
   */
  const resolveActiveBeat = useCallback((): string => {
    const focusY = window.innerHeight * FOCUS_LINE;
    let best = '';
    let bestScore = Infinity;
    slotsRef.current.forEach((slot, beat) => {
      const r = slot.el.getBoundingClientRect();
      if (r.height <= 0) return;
      const straddles = r.top <= focusY && r.bottom >= focusY;
      const centreDist = Math.abs(r.top + r.height / 2 - focusY);
      // STRADDLE_BONUS is large enough to outrank any plausible centre
      // distance, so "contains the focus line" always wins as a tier.
      const score = (straddles ? -STRADDLE_BONUS : 0) + centreDist;
      if (score < bestScore) {
        bestScore = score;
        best = beat;
      }
    });
    return best;
  }, []);

  usePageScrollSubscribe(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Debug/QA + Playwright: ?stageBeat=<beat> pins the active beat
    const forcedBeat =
      typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('stageBeat') ?? undefined)
        : undefined;

    const resolvedBeat = forcedBeat || resolveActiveBeat();
    if (!resolvedBeat || resolvedBeat === activeBeatRef.current) return;
    activeBeatRef.current = resolvedBeat;

    const slot = slotsRef.current.get(resolvedBeat);
    if (slot) {
      stage.attachTo(slot.el);
      stage.setActiveBeat(resolvedBeat, slot.getProgress);
    }
  });

  useEffect(() => {
    if (!available) return;

    const stage = createStage({ theme, density, tier, onReady: () => setReady(true) });
    stageRef.current = stage;
    stage.start();

    const onResize = () => stage.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      stage.stop();
      stage.dispose();
      stageRef.current = null;
      activeBeatRef.current = '';
      setReady(false);
    };
    // Create the single WebGL context only when capability/tier changes.
    // Theme changes are handled by setTheme() below — they must NOT tear
    // down the renderer/canvas (that caused a flash on every toggle).
  }, [available, density, tier]);

  // Theme switch: recolor the scene graph in place instead of rebuilding the
  // whole stage. Skips the initial mount (the stage is already themed).
  const themeInitialised = useRef(false);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!themeInitialised.current) {
      themeInitialised.current = true;
      return;
    }
    stage.setTheme(theme);
  }, [theme]);

  const select = useCallback((beat: string, id: string | number) => {
    stageRef.current?.setSelected?.(beat, id);
  }, []);

  return <StageCtx.Provider value={{ register, select, ready }}>{children}</StageCtx.Provider>;
}

export function StageSlot({
  beat,
  className,
  fallback,
  ariaHidden = true,
}: {
  beat: string;
  className?: string;
  fallback?: ReactNode;
  ariaHidden?: boolean;
}): ReactElement {
  const ctx = useContext(StageCtx);
  const available = useSceneAvailable();
  const ref = useRef<HTMLDivElement | null>(null);
  const progressRef = useSectionProgress(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ctx) return;
    ctx.register(beat, el, () => progressRef.current ?? 0);
    return () => ctx.register(beat, null, () => 0);
  }, [ctx, beat, progressRef]);

  // Keep the captured-scene poster on screen (and fade it out) while the live
  // canvas fades in, so the hero never pops in over an empty beat on refresh.
  // Only the hero is on screen during that initial gap; other beats are already
  // live (ready) by the time they scroll into view, so they don't need a poster.
  const showPoster = !available || beat === 'hero';
  const posterOpacity = available && ctx?.ready ? 0 : 0.9;

  return (
    <div
      ref={ref}
      data-stage-beat={beat}
      aria-hidden={ariaHidden}
      className={className}
      style={{ position: 'absolute', inset: 0 }}
    >
      {showPoster && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: posterOpacity,
            transition: 'opacity 600ms ease',
            pointerEvents: 'none',
          }}
        >
          {fallback ?? <StagePoster beat={beat} />}
        </div>
      )}
    </div>
  );
}

/**
 * Poster fallback shown only when WebGL is unavailable (or reduced motion /
 * low tier). Captured from the REAL scene via Playwright (never hand-drawn
 * SVG) so the visual language stays consistent. A brand gradient sits behind
 * it as a safety net if the asset is missing.
 */
function StagePoster({ beat }: { beat: string }): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(circle at 50% 45%, rgba(124,140,248,0.18), rgba(10,12,20,0) 70%)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/landing/beats/${beat}.png`}
        alt=""
        className="h-full w-full object-cover opacity-90"
      />
    </div>
  );
}
