/**
 * FaqScene — "questions" beat.
 *
 * The quietest scene on the page, and that is the whole point: the FAQ is the
 * one section that is pure reading, so the 3D has a single job — stay out of
 * the way while still being there.
 *
 * Grammar: a shallow field of faint points that drift, plus a low horizon
 * glow behind the accordion. No rings, no streams, no particles large enough
 * to notice. If a user can consciously see this while reading a question, it
 * is too loud.
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';
import { glowTexture, mulberry32, scenePalette } from '../scene-utils';

export interface FaqScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

interface Mote {
  sprite: THREE.Sprite;
  base: THREE.Vector3;
  phase: number;
  speed: number;
  drift: number;
  baseOpacity: number;
}

const MOTE_COUNT = 90;
const FIELD_W = 16;
const FIELD_H = 7;
const FIELD_D = 6;

export function createFaqScene(theme: ThemeName): FaqScene {
  const group = new THREE.Group();
  const palette = scenePalette(theme);
  const rand = mulberry32(0xfa9_0000d);
  const disposables: Array<{ dispose: () => void }> = [];

  // ── Horizon: a wide, very low glow sitting behind the copy ────────
  const horizonMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowTexture(palette.core)),
    transparent: true,
    opacity: theme === 'dark' ? 0.16 : 0.1,
    depthWrite: false,
    blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  disposables.push(horizonMat);
  const horizon = new THREE.Sprite(horizonMat);
  horizon.scale.set(22, 9, 1);
  horizon.position.set(0, -1.4, -3.2);
  group.add(horizon);

  // ── Motes: a slow, wide, low-contrast field ───────────────────────
  const moteMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowTexture(palette.dust)),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  disposables.push(moteMat);

  const motes: Mote[] = [];
  for (let i = 0; i < MOTE_COUNT; i++) {
    const sprite = new THREE.Sprite(moteMat);
    const size = 0.05 + rand() * 0.07;
    sprite.scale.set(size, size, 1);
    const base = new THREE.Vector3(
      (rand() - 0.5) * FIELD_W,
      (rand() - 0.5) * FIELD_H,
      -rand() * FIELD_D,
    );
    sprite.position.copy(base);
    group.add(sprite);
    motes.push({
      sprite,
      base,
      phase: rand() * Math.PI * 2,
      speed: 0.12 + rand() * 0.18,
      drift: 0.1 + rand() * 0.22,
      // Deliberately narrow opacity band: no mote is ever a focal point.
      baseOpacity: 0.1 + rand() * 0.14,
    });
  }

  function update(t: number, _dt: number, lp: number): void {
    for (const mote of motes) {
      const a = t * mote.speed + mote.phase;
      mote.sprite.position.set(
        mote.base.x + Math.sin(a) * mote.drift,
        mote.base.y + Math.cos(a * 0.8) * mote.drift,
        mote.base.z,
      );
      // Blink at different rates so the field never pulses in unison.
      const shimmer = 0.6 + 0.4 * Math.sin(a * 1.7);
      mote.sprite.scale.setScalar(0.05 + shimmer * 0.03);
    }

    // The horizon lifts a little as the section is read, then settles.
    horizonMat.opacity = (theme === 'dark' ? 0.13 : 0.08) * (0.7 + lp * 0.5);
    moteMat.opacity = 0.22 + lp * 0.12;
  }

  function dispose(): void {
    disposables.forEach((d) => d.dispose());
    group.clear();
  }

  return { group, update, dispose };
}
