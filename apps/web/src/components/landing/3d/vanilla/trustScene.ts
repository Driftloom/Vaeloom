/**
 * TrustScene — "permission model" beat.
 *
 * Three concentric rings (read → write → act) around a still core, with
 * scoped tokens orbiting on the outer ring. The grammar is the copy: read is
 * always granted, write is a separate grant, act is gated per action. So the
 * rings are nested (increasing restriction inward) and the core never moves.
 *
 * This is the calmest beat on the page — the section carries a permission
 * table and the scene's only job is to not compete with it. Motion is slow,
 * symmetric, and low-contrast by design.
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';
import { glowTexture, glowTextureStops, mulberry32, scenePalette } from '../scene-utils';

export interface TrustScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

interface Ring {
  line: THREE.LineLoop;
  /** Radians per second. Outer rings turn slower — bigger scope, less motion. */
  speed: number;
  radius: number;
  baseOpacity: number;
  tint: THREE.Color;
}

interface Token {
  sprite: THREE.Sprite;
  angle: number;
  radius: number;
  height: number;
  speed: number;
  baseOpacity: number;
}

// Radii are tuned to the TRUST camera, not to a full-viewport stage: the
// section renders the scene as a 30%-opacity wash behind a permission table,
// so anything wider than ~3 units stops reading as concentric rings and starts
// reading as stray diagonal lines across the copy.
const RING_SPECS = [
  { radius: 2.75, speed: 0.05, opacity: 0.5, tint: 'structure' as const },
  { radius: 1.9, speed: 0.08, opacity: 0.62, tint: 'streamA' as const },
  { radius: 1.15, speed: 0.11, opacity: 0.75, tint: 'core' as const },
];
const RING_SEGMENTS = 96;
const RING_TILT = -0.3;
const TOKEN_COUNT = 7;

export function createTrustScene(theme: ThemeName): TrustScene {
  const group = new THREE.Group();
  const palette = scenePalette(theme);
  const rand = mulberry32(0x7a05_11ed);
  const disposables: Array<{ dispose: () => void }> = [];

  // ── Rings ─────────────────────────────────────────────────────────
  const rings: Ring[] = RING_SPECS.map((spec) => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * spec.radius, 0, Math.sin(a) * spec.radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette[spec.tint]),
      transparent: true,
      opacity: spec.opacity,
    });
    disposables.push(geo, mat);
    const line = new THREE.LineLoop(geo, mat);
    // Rings sit in a shallow bowl so they read as depth, not as flat decals.
    line.rotation.x = RING_TILT;
    group.add(line);
    return {
      line,
      speed: spec.speed,
      radius: spec.radius,
      baseOpacity: spec.opacity,
      tint: new THREE.Color(palette[spec.tint]),
    };
  });

  // ── Core: held, not animated. "Passive by default." ──────────────
  // NormalBlending, NOT additive. Additive is `dst + src·α`, so over the light
  // page these sprites composited to `#FEFDFF` — a white smudge with no hue,
  // punching a hole through the tint band instead of reading as a core.
  // Additive only makes sense against a dark canvas; this scene renders as a
  // 30% wash over both themes.
  const coreMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowTextureStops(palette.core, palette.edgeHot)),
    transparent: true,
    opacity: theme === 'dark' ? 0.5 : 0.45,
    depthWrite: false,
  });
  disposables.push(coreMat);
  const core = new THREE.Sprite(coreMat);
  core.scale.set(1.7, 1.7, 1);
  group.add(core);

  // ── Tokens: scoped grants orbiting the outer ring ────────────────
  // NormalBlending for the same reason as the core — additive tokens on a
  // light page read as white specks, not as scoped grants.
  const tokenMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowTexture(palette.structure)),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  disposables.push(tokenMat);

  const tokens: Token[] = [];
  for (let i = 0; i < TOKEN_COUNT; i++) {
    const sprite = new THREE.Sprite(tokenMat);
    const size = 0.26 + rand() * 0.12;
    sprite.scale.set(size, size, 1);
    group.add(sprite);
    tokens.push({
      sprite,
      angle: (i / TOKEN_COUNT) * Math.PI * 2,
      radius: RING_SPECS[0]!.radius,
      height: (rand() - 0.5) * 0.5,
      speed: 0.05 + rand() * 0.02,
      baseOpacity: 0.55 + rand() * 0.25,
    });
  }

  const tmp = new THREE.Color();

  function update(t: number, _dt: number, lp: number): void {
    const presence = 0.6 + lp * 0.4;

    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i]!;
      ring.line.rotation.z = t * ring.speed + i * 0.4;
      const mat = ring.line.material as THREE.LineBasicMaterial;
      // Hot rings brighten slightly as the section is read, so the hierarchy
      // (read → write → act) resolves without moving the camera.
      const emphasis = i / (rings.length - 1);
      mat.opacity = ring.baseOpacity * presence * (0.75 + emphasis * lp * 0.5);
      tmp.copy(ring.tint);
      mat.color.lerp(tmp, 0.1);
    }

    for (const token of tokens) {
      token.angle += token.speed * 0.016;
      const a = token.angle;
      const c = Math.cos(a) * token.radius;
      const z = Math.sin(a) * token.radius;
      // Match the rings' tilt so tokens ride the same plane.
      token.sprite.position.set(c, token.height + z * -RING_TILT, z * 0.91);
      const mat = token.sprite.material as THREE.SpriteMaterial;
      // Tokens on the far side of the orbit dim, which reads as depth.
      const facing = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(a));
      mat.opacity = token.baseOpacity * presence * facing;
    }

    // The core breathes, very slightly. It is the one thing that never
    // leaves — the through-line of the whole permission story.
    const breathe = 1 + Math.sin(t * 0.7) * 0.03;
    core.scale.set(1.7 * breathe, 1.7 * breathe, 1);
    coreMat.opacity = (theme === 'dark' ? 0.42 : 0.4) * presence;
  }

  function dispose(): void {
    disposables.forEach((d) => d.dispose());
    group.clear();
  }

  return { group, update, dispose };
}
