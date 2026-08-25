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
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  useInView,
  useQualityTier,
  useReducedMotionPref,
  useWebGLSupport,
} from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';
import type { GraphSelection } from './KnowledgeGraphCanvas';
import { useTheme } from '@/hooks/useTheme';

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
