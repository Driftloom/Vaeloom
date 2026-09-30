/**
 * Hero — living memory core (vanilla three).
 *
 * A continuously evolving "Living Intelligence Core" surrounded by a dense,
 * volumetric particle field and bidirectional data streams. Everything is
 * driven by ONE coordinated procedural time system so the scene reads as a
 * single organism rather than unrelated animations.
 */

import { createIntelligenceCore } from './intelligenceCoreScene';
import { createParticleField } from './particleField';
import { createStreams } from './streams';
import { createFlowStreams } from './flowStreams';
import type { QualityTier } from '@/lib/landing/hooks';
import type { Object3D } from 'three';

export type Pointer = { x: number; y: number };

/**
 * Light mode pays a DENSITY tax; dark mode pays none.
 *
 * This is the single place the hero's mark budget is decided, so the field, the
 * data streams and the flow streams all thin together and cannot drift apart.
 *
 * Why a tax at all, when `scenePalette` already desaturated the light hues:
 * hue was never the problem. On a white page a mark survives on COUNT and
 * ALPHA, not on colour — a 2px dot at 0.5 alpha is a legible speck whatever
 * hue it wears, and ~5,100 of them (2,600 field + 2,160 stream + 341 flow at
 * density 1.0) turn the hero into confetti. Dark mode gets away with the same
 * count because additive marks there read as glow BEHIND the type; the same
 * marks on white read as ink ON TOP of it.
 *
 * 0.55 keeps the composition — the radial burst, the two corner inlets, the
 * core cluster are all still plainly there — while removing roughly half the
 * individual marks, which is what actually crosses the copy.
 */
const LIGHT_DENSITY_SCALE = 0.55;

/**
 * Builds the Memory Core sub-objects into one reusable assembly. It creates NO
 * renderer and NO loop — the persistent landing `Stage` builds this once and
 * mounts it as both the hero beat and the closing CTA, so the core geometry
 * stays defined in exactly one place.
 */
export function createMemoryCore(
  theme: 'dark' | 'light',
  density: number,
  _tier: QualityTier,
  pointer?: Pointer,
  streams = true,
) {
  const light = theme === 'light';
  const effDensity = density * (light ? LIGHT_DENSITY_SCALE : 1);

  const intelligenceCore = createIntelligenceCore(theme, { reducedMotion: false });
  const particleField = createParticleField(theme, effDensity);
  const dataStreams = createStreams(theme, effDensity, { outward: streams });
  const flowStreams = streams ? createFlowStreams(theme, effDensity) : null;

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
