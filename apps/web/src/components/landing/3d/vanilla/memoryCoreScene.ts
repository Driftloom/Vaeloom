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
import type { Object3D } from 'three';

export type Pointer = { x: number; y: number };

/**
 * Builds the Memory Core sub-objects into one reusable assembly. It creates NO
 * renderer and NO loop — both the hero canvas and the persistent landing `Stage`
 * mount this, so the core geometry stays defined in exactly one place.
 */
export function createMemoryCore(
  theme: 'dark' | 'light',
  density: number,
  _tier: QualityTier,
  pointer?: Pointer,
  streams = true,
) {
  const intelligenceCore = createIntelligenceCore(theme, { reducedMotion: false });
  const particleField = createParticleField(theme, density);
  const dataStreams = createStreams(theme, density, { outward: streams });
  const flowStreams = streams ? createFlowStreams(theme, density) : null;

  const smooth = { x: 0, y: 0 };

  return {
    objects: [
      intelligenceCore.group,
      particleField.points,
      ...dataStreams.objects,
      ...(flowStreams ? [flowStreams.points] : []),
    ] as Object3D[],
    update(t: number, dt: number, p: Pointer | undefined, reducedMotion: boolean) {
      const targetX = p ? p.x : 0;
      const targetY = p ? p.y : 0;
      const pm = reducedMotion ? 0 : 1;
      smooth.x += (targetX * pm - smooth.x) * Math.min(1, dt * 3);
      smooth.y += (targetY * pm - smooth.y) * Math.min(1, dt * 3);
      intelligenceCore.update(t, dt, { reducedMotion });
      particleField.update(t, dt, smooth.x, smooth.y, reducedMotion);
      dataStreams.update(t, dt, reducedMotion);
      if (flowStreams) flowStreams.update(t, dt, reducedMotion);
      return { x: smooth.x, y: smooth.y };
    },
    dispose() {
      (intelligenceCore as { dispose?: () => void }).dispose?.();
      (particleField as { dispose?: () => void }).dispose?.();
      (dataStreams as { dispose?: () => void }).dispose?.();
      (flowStreams as { dispose?: () => void } | null)?.dispose?.();
    },
  };
}

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

  const core = createMemoryCore(theme, density, tier, pointer, streams);
  core.objects.forEach((o) => scene.add(o));

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
        camera.position.x = Math.sin(t * 0.08) * 0.35 + s.x * 0.5;
        camera.position.y = 0.15 + Math.sin(t * 0.06) * 0.12 + s.y * 0.4;
        camera.lookAt(0, 0, 0);
      },
    },
    dprForTier(tier)[1],
  );
  return handle;
}
