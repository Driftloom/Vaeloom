/**
 * Landing Stage — the single persistent WebGL canvas for the whole page.
 *
 * Phase B mounts only Beat 0 (the hero Memory Core). Later phases add the
 * remaining beats and a camera fly-through driven by `getProgress()` (the
 * shared page scroll progress). One renderer, one loop, no per-section
 * canvases for beats that live on the Stage.
 */

import { createRenderer, runLoop, type SceneHandle } from './engine';
import { createMemoryCore, type Pointer } from './memoryCoreScene';
import { dprForTier, type QualityTier } from '@/lib/landing/hooks';
import * as THREE from 'three';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export type StageCfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  density: number;
  tier: QualityTier;
  pointer?: Pointer;
  /** reads the shared page scroll progress (0..1) each frame */
  getProgress: () => number;
};

export function mountStage({
  container,
  theme,
  density,
  tier,
  pointer,
  getProgress,
}: StageCfg): SceneHandle {
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 0.9, 7.4);

  // Beat 0 — the living Memory Core (reused from the hero scene).
  const core = createMemoryCore(theme, density, tier, pointer, true);
  const group = new THREE.Group();
  core.objects.forEach((o) => group.add(o));
  scene.add(group);

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      cameraZ: 7.4,
      tick: (dt, t) => {
        const rm = prefersReducedMotion;
        const s = core.update(t, dt, pointer, rm);

        const p = clamp01(getProgress());
        // Beat 0 (hero) owns the first ~14% of the page; later beats take over.
        const heroP = clamp01(p / 0.14);

        // scripted drift + parallax, easing out as we leave the hero beat
        const ease = 1 - heroP * 0.55;
        camera.position.x = Math.sin(t * 0.08) * 0.35 + s.x * 0.5 * ease;
        camera.position.y = 0.15 + Math.sin(t * 0.06) * 0.12 + s.y * 0.4 * ease - heroP * 0.9;
        camera.position.z = 7.4 + heroP * 2.8;
        camera.lookAt(0, 0, 0);

        // The core is the hero beat — hide it once we've scrolled well past so
        // it doesn't bleed through the (semi-opaque) sections below.
        group.visible = p < 0.22;
        group.rotation.y = t * 0.02 + heroP * 0.4;
      },
    },
    dprForTier(tier)[1],
  );
  return handle;
}
