'use client';

/**
 * Agent orbit scene wrapper — thin React shell around the vanilla-three
 * orbit. `selected` drives ring focus; pointer picking flows to onSelect.
 */

import { useEffect, useRef } from 'react';
import type { QualityTier } from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';

type OrbitApi = SceneHandle & { setSelected: (id: string) => void };

export default function AgentOrbitCanvas({
  theme,
  tier,
  active,
  selected,
  onSelect,
}: {
  theme: 'dark' | 'light';
  tier: QualityTier;
  active: boolean;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<OrbitApi | null>(null);
  const selCb = useRef(onSelect);
  selCb.current = onSelect;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mounted = true;
    void import('./vanilla/agentOrbitScene').then(({ mountAgentOrbit }) => {
      if (!mounted || !ref.current) return;
      const handle = mountAgentOrbit({
        container: ref.current,
        theme,
        ids: Object.keys(AGENT_ORDER),
        selectedId: selected,
        onSelect: (id) => selCb.current(id),
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
    handleRef.current?.setSelected(selected);
  }, [selected]);

  useEffect(() => {
    handleRef.current?.setRunning(active);
  }, [active]);

  return <div ref={ref} className="h-full w-full" />;
}

/** Canonical agent order — shared with DOM legend via scene-utils hues. */
const AGENT_ORDER: Record<string, string> = {
  orchestrator: '',
  organization: '',
  memory: '',
  resume: '',
  ats: '',
  jobsearch: '',
  gmail: '',
  scheduler: '',
};
