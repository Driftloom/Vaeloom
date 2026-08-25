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
import { useMemo, type ReactNode } from 'react';
import {
  useInView,
  useQualityTier,
  useReducedMotionPref,
  useWebGLSupport,
} from '@/lib/landing/hooks';
import type { GraphSelection } from './KnowledgeGraphCanvas';

export type { GraphSelection };

const MemoryCoreCanvas = dynamic(() => import('./MemoryCoreCanvas'), { ssr: false });
const KnowledgeGraphCanvas = dynamic(() => import('./KnowledgeGraphCanvas'), { ssr: false });
const AgentOrbitCanvas = dynamic(() => import('./AgentOrbitCanvas'), { ssr: false });

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

/** Convenience hook for sections that need the resolved theme string. */
export function useLandingTheme(themeClass?: string): Theme {
  return useMemo(() => (themeClass === 'light' ? 'light' : 'dark'), [themeClass]);
}
