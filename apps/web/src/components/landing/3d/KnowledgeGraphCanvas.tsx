'use client';

/**
 * Knowledge graph scene wrapper — thin React shell around the
 * vanilla-three interactive graph. Selection flows out to the DOM
 * overlay via onSelectionChange; keyboard buttons call setSelectedIndex
 * through the exposed API.
 */

import { useEffect, useRef } from 'react';
import type { QualityTier } from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';

export type GraphNodeInfo = { label: string; type: string; connections: number };
export type GraphSelection = { index: number; info: GraphNodeInfo } | null;

type GraphApi = SceneHandle & { setSelectedIndex: (i: number) => void };

export default function KnowledgeGraphCanvas({
  theme,
  tier,
  active,
  onSelectionChange,
}: {
  theme: 'dark' | 'light';
  tier: QualityTier;
  active: boolean;
  onSelectionChange: (sel: GraphSelection) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GraphApi | null>(null);
  const selCb = useRef(onSelectionChange);
  selCb.current = onSelectionChange;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mounted = true;
    void import('./vanilla/knowledgeGraphScene').then(({ mountKnowledgeGraph }) => {
      if (!mounted || !ref.current) return;
      const handle = mountKnowledgeGraph({
        container: ref.current,
        theme,
        onSelectionChange: (sel) => selCb.current(sel),
      });
      handleRef.current = handle;
      handle.setRunning(active);
    });
    return () => {
      mounted = false;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    handleRef.current?.setRunning(active);
  }, [active]);

  return <div ref={ref} className="h-full w-full" />;
}

export { CURATED } from './vanilla/knowledgeGraphScene';
