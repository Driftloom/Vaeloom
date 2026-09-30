'use client';

import { useEffect, useState } from 'react';

/**
 * Whether to render the live WebGL stage. Falls back to the CSS-only ambient
 * treatment when WebGL is unavailable, reduced motion is set, or the device tier
 * is low. See `StageFallback` in SceneShell.tsx for why that is not a bitmap.
 * WebGL is unavailable, the user prefers reduced motion, or we're pre-hydration.
 */
export function useSceneAvailable(): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let webgl = false;
    try {
      const c = document.createElement('canvas');
      webgl = !!(
        window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl'))
      );
    } catch {
      webgl = false;
    }
    setOk(webgl && !reduced);
  }, []);

  return ok;
}
