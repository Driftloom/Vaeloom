'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePageScrollProgress } from '../../../lib/landing/scroll';
import { createStage, type StageHandle } from './vanilla/stageScene';
import { useSceneAvailable } from './sceneAvailability';
import { StagePoster } from './StagePoster';

import DustFieldCanvas from './DustFieldCanvas';

export function DustField(): React.ReactElement {
  return <DustFieldCanvas theme="light" tier="high" />;
}

const stageCanvasStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
};

function getForcedBeat(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const p = new URLSearchParams(window.location.search).get('stageBeat');
  return p || undefined;
}

export function StageProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const available = useSceneAvailable();
  const progressRef = usePageScrollProgress();
  const [forcedBeat] = useState(getForcedBeat);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!available) return;
    const el = containerRef.current;
    if (!el) return;
    let scene: StageHandle | null = null;
    try {
      scene = createStage({
        theme: 'light',
        density: 1,
        tier: 'high',
        forcedBeat,
        getProgress: () => progressRef.current ?? 0,
      });
    } catch {
      return;
    }
    const canvas = scene.getCanvas();
    el.appendChild(canvas);
    scene.resize();
    scene.start();
    const onResize = (): void => scene?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      scene?.dispose();
    };
  }, [available, forcedBeat, progressRef]);

  return (
    <>
      {available && <div ref={containerRef} aria-hidden style={stageCanvasStyle} />}
      {children}
    </>
  );
}

/**
 * Reserves the visual column's layout space. When WebGL is available the
 * single fixed StageProvider canvas shows through this transparent window; when
 * it isn't, a captured poster is shown as a graceful fallback.
 */
export function StageSlot({
  beat,
  className,
}: {
  beat: string;
  className?: string;
}): React.ReactElement {
  const available = useSceneAvailable();
  if (available) return <div className={className} aria-hidden />;
  return <StagePoster beat={beat} className={className} />;
}
