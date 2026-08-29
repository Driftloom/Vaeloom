'use client';

import { useEffect, useState } from 'react';

/**
 * Whether to render the live WebGL stage. Falls back to captured posters when
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
