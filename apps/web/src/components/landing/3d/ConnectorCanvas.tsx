'use client';

/**
 * Connector flow scene wrapper.
 */

import { useEffect, useRef } from 'react';
import { densityForTier, type QualityTier } from '@/lib/landing/hooks';
import type { SceneHandle } from './vanilla/engine';

export default function ConnectorCanvas({
  theme,
  tier,
  active,
}: {
  theme: 'dark' | 'light';
  tier: QualityTier;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mounted = true;
    void import('./vanilla/connectorScene').then(({ mountConnectorFlow }) => {
      if (!mounted || !ref.current) return;
      const handle = mountConnectorFlow({
        container: ref.current,
        theme,
        density: densityForTier(tier),
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
  }, [theme, tier]);

  useEffect(() => {
    handleRef.current?.setRunning(active);
  }, [active]);

  return <div ref={ref} className="h-full w-full" />;
}
