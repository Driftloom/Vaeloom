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
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  useInView,
  useQualityTier,
  densityForTier,
  useReducedMotionPref,
  useWebGLSupport,
} from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';
import type { GraphSelection } from './KnowledgeGraphCanvas';
import { useTheme } from '@/hooks/useTheme';
import { useSectionProgress } from '@/lib/landing/scroll';
import { createStage, type StageHandle } from './vanilla/stageScene';

export type { GraphSelection };

/** Resolved theme for scene wrappers (dark is SSR/brand default). */
function useThemeValue(): Theme {
  return useTheme().theme;
}

const MemoryCoreCanvas = dynamic(() => import('./MemoryCoreCanvas'), { ssr: false });
const KnowledgeGraphCanvas = dynamic(() => import('./KnowledgeGraphCanvas'), { ssr: false });
const AgentOrbitCanvas = dynamic(() => import('./AgentOrbitCanvas'), { ssr: false });
const DustFieldCanvas = dynamic(() => import('./DustFieldCanvas'), { ssr: false });
const JourneyCanvas = dynamic(() => import('./JourneyCanvas'), { ssr: false });
const ConnectorCanvas = dynamic(() => import('./ConnectorCanvas'), { ssr: false });
const GrowthCanvas = dynamic(() => import('./GrowthCanvas'), { ssr: false });
const CtaCoreCanvas = dynamic(() => import('./CtaCoreCanvas'), { ssr: false });

type Theme = 'dark' | 'light';

function useSceneGate() {
  const supported = useWebGLSupport();
  const reduced = useReducedMotionPref();
  const tier = useQualityTier();
  const view = useInView<HTMLDivElement>('240px');
  const webglReady = Boolean(supported) && !reduced;
  return { ...view, webglReady, active: view.inView && !reduced, tier };
}

export function MemoryCoreScene({ theme, fallback }: { theme: Theme; fallback: ReactNode }) {
  const gate = useSceneGate();
  if (!gate.webglReady) return <>{fallback}</>;
  return (
    <div ref={gate.ref} className="h-full w-full">
      <MemoryCoreCanvas theme={theme} tier={gate.tier} active={gate.active} />
    </div>
  );
}

export function KnowledgeGraphScene({
  theme,
  fallback,
  onSelectionChange,
}: {
  theme: Theme;
  fallback: ReactNode;
  onSelectionChange: (sel: GraphSelection) => void;
}) {
  const gate = useSceneGate();
  if (!gate.webglReady) return <>{fallback}</>;
  return (
    <div ref={gate.ref} className="h-full w-full">
      <KnowledgeGraphCanvas
        theme={theme}
        tier={gate.tier}
        active={gate.active}
        onSelectionChange={onSelectionChange}
      />
    </div>
  );
}

export function AgentOrbitScene({
  theme,
  fallback,
  selected,
  onSelect,
}: {
  theme: Theme;
  fallback: ReactNode;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const gate = useSceneGate();
  if (!gate.webglReady) return <>{fallback}</>;
  return (
    <div ref={gate.ref} className="h-full w-full">
      <AgentOrbitCanvas
        theme={theme}
        tier={gate.tier}
        active={gate.active}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

/** Whether rich 3D is available at all (support + motion + tier). */
export function useSceneAvailable(): boolean {
  const supported = useWebGLSupport();
  const reduced = useReducedMotionPref();
  const tier = useQualityTier();
  return Boolean(supported) && !reduced && tier !== 'low';
}

/**
 * Global ambient dust behind the whole landing. Skipped entirely on low
 * tiers and reduced motion — it is pure atmosphere, never information.
 * Self-themed so server components can mount it directly.
 */
export function DustField() {
  const available = useSceneAvailable();
  const theme = useThemeValue();
  if (!available) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <DustFieldCanvas theme={theme} tier="high" />
    </div>
  );
}

/** Scroll-scrubbed pipeline journey (How It Works). Progress 0..1 via ref. */
export function JourneyScene({
  theme,
  progressRef,
}: {
  theme: Theme;
  progressRef: React.RefObject<number>;
}) {
  const gate = useSceneGate();
  if (!gate.webglReady || gate.tier === 'low') return null;
  return (
    <div ref={gate.ref} className="h-full w-full">
      <JourneyCanvas theme={theme} tier={gate.tier} progressRef={progressRef} />
    </div>
  );
}

/** Connector sources feeding the ingestion core. */
export function ConnectorFlowScene({ theme, fallback }: { theme: Theme; fallback: ReactNode }) {
  const gate = useSceneGate();
  if (!gate.webglReady) return <>{fallback}</>;
  return (
    <div ref={gate.ref} className="h-full w-full">
      <ConnectorCanvas theme={theme} tier={gate.tier} active={gate.active} />
    </div>
  );
}

/** Compounding lattice — progress-scrubbed assembly. */
export function GrowthScene({
  theme,
  progressRef,
}: {
  theme: Theme;
  progressRef: React.RefObject<number>;
}) {
  const gate = useSceneGate();
  if (!gate.webglReady || gate.tier === 'low') return null;
  return (
    <div ref={gate.ref} className="h-full w-full">
      <GrowthCanvas theme={theme} tier={gate.tier} progressRef={progressRef} />
    </div>
  );
}

/** Calm memory core behind the final CTA. */
export function CtaCoreScene({ theme }: { theme: Theme }) {
  const gate = useSceneGate();
  if (!gate.webglReady || gate.tier === 'low') return null;
  return (
    <div ref={gate.ref} className="h-full w-full">
      <CtaCoreCanvas theme={theme} tier={gate.tier} active={gate.active} />
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
}

const StageCtx = createContext<StageCtxValue | null>(null);

/**
 * StageProvider owns ONE WebGL context for the whole page. As each section's
 * slot scrolls into view, the shared canvas is teleported into it and the
 * matching beat becomes active. This folds the per-section canvases into a
 * single renderer while preserving every section's existing layout.
 */
export function StageProvider({ children }: { children: ReactNode }): ReactElement {
  const available = useSceneAvailable();
  const tier = useQualityTier();
  const density = densityForTier(tier);
  const themeRes = useTheme();
  const theme = themeRes.theme === 'light' ? 'light' : 'dark';

  const stageRef = useRef<StageHandle | null>(null);
  const slotsRef = useRef<Map<string, { el: HTMLElement; getProgress: () => number }>>(new Map());
  const ratiosRef = useRef<Record<string, number>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  const register = useCallback(
    (beat: string, el: HTMLElement | null, getProgress: () => number) => {
      if (!el) {
        slotsRef.current.delete(beat);
        return;
      }
      slotsRef.current.set(beat, { el, getProgress });
      if (observerRef.current) observerRef.current.observe(el);
    },
    [],
  );

  useEffect(() => {
    if (!available) return;

    const stage = createStage({ theme, density, tier });
    stageRef.current = stage;
    stage.start();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const beat = (e.target as HTMLElement).dataset['stageBeat'];
          if (beat) ratiosRef.current[beat] = e.intersectionRatio;
        });
        let activeBeat = '';
        let max = 0;
        Object.entries(ratiosRef.current).forEach(([b, r]) => {
          if (r > max) {
            max = r;
            activeBeat = b;
          }
        });
        if (activeBeat) {
          const slot = slotsRef.current.get(activeBeat);
          if (slot) {
            stage.attachTo(slot.el);
            stage.setActiveBeat(activeBeat, slot.getProgress);
          }
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    observerRef.current = observer;
    slotsRef.current.forEach((slot) => observer.observe(slot.el));

    const onResize = () => stage.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      observerRef.current = null;
      stage.stop();
      stage.dispose();
      stageRef.current = null;
    };
  }, [available, theme, density, tier]);

  return <StageCtx.Provider value={{ register }}>{children}</StageCtx.Provider>;
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

  return (
    <div
      ref={ref}
      data-stage-beat={beat}
      aria-hidden={ariaHidden}
      className={className}
      style={{ position: 'absolute', inset: 0 }}
    >
      {!available && fallback}
    </div>
  );
}
