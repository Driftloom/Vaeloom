/**
 * Hero — living memory core (vanilla three).
 *
 * A continuously evolving "Living Intelligence Core" surrounded by a dense,
 * volumetric particle field and bidirectional data streams. Everything is
 * driven by ONE coordinated procedural time system so the scene reads as a
 * single organism rather than unrelated animations.
 */

import { createRenderer, runLoop, type SceneHandle } from './engine';
import { createIntelligenceCore } from './intelligenceCoreScene';
import { createParticleField } from './particleField';
import { createStreams } from './streams';
import { createFlowStreams } from './flowStreams';
import { dprForTier, type QualityTier } from '@/lib/landing/hooks';

export type Pointer = { x: number; y: number };

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  density: number;
  /** quality tier — drives the DPR cap so fragment cost stays predictable */
  tier: QualityTier;
  /** false -> calm variant (no streams, used behind the final CTA) */
  streams?: boolean;
  /** normalized pointer (-1..1); drives subtle parallax */
  pointer?: Pointer;
};

export function mountMemoryCore({
  container,
  theme,
  density,
  tier,
  streams = true,
  pointer,
}: Cfg): SceneHandle {
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 0.9, 7.4);

  /* Living Intelligence Core — multi-layer, coordinated motion */
  const intelligenceCore = createIntelligenceCore(theme, { reducedMotion: false });
  scene.add(intelligenceCore.group);

  /* Volumetric particle field — fills the whole viewport from all directions */
  const particleField = createParticleField(theme, density);
  scene.add(particleField.points);

  /* Bidirectional data streams — in (existing) + out (new) */
  const dataStreams = createStreams(theme, density, { outward: streams });
  dataStreams.objects.forEach((o) => scene.add(o));

  /* Subtle inbound flow from lower-left/right corners toward the core */
  const flowStreams = streams ? createFlowStreams(theme, density) : null;
  if (flowStreams) scene.add(flowStreams.points);

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // smoothed pointer for subtle parallax
  const smooth = { x: 0, y: 0 };

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      cameraZ: 7.4,
      tick: (dt, t) => {
        const rm = prefersReducedMotion;

        // ---- subtle mouse parallax -----------------------------------
        const targetX = pointer ? pointer.x : 0;
        const targetY = pointer ? pointer.y : 0;
        const pm = rm ? 0 : 1;
        smooth.x += (targetX * pm - smooth.x) * Math.min(1, dt * 3);
        smooth.y += (targetY * pm - smooth.y) * Math.min(1, dt * 3);

        // scripted camera drift + parallax offset (kept subtle)
        camera.position.x = Math.sin(t * 0.08) * 0.35 + smooth.x * 0.5;
        camera.position.y = 0.15 + Math.sin(t * 0.06) * 0.12 + smooth.y * 0.4;
        camera.lookAt(0, 0, 0);

        // ---- core (coordinates its own sub-motions via shared t) -----
        intelligenceCore.update(t, dt, { reducedMotion: rm });

        // ---- particle field ------------------------------------------
        particleField.update(t, dt, smooth.x, smooth.y, rm);

        // ---- streams --------------------------------------------------
        dataStreams.update(t, dt, rm);

        // ---- inbound flow streams ------------------------------------
        if (flowStreams) flowStreams.update(t, dt, rm);
      },
    },
    dprForTier(tier)[1],
  );
  return handle;
}
