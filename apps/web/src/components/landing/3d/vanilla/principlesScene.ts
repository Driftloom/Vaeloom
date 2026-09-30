/**
 * PrinciplesScene — "the guarantees" beat.
 *
 * Five rules the product does not break: persistent memory, private by
 * default, approval before action, explainable, reversible.
 *
 * Grammar: five parallel rails, one per rule, with a marker riding each. A
 * single stream approaches from the left, is checked against every rail, and
 * is deflected back out the way it came. The rails are the point — nothing
 * crosses them. That is the section's claim, drawn rather than asserted.
 *
 * Deliberately the second-quietest scene on the page: it sits between the
 * problem and difference beats, and a strip of five rules should read as a
 * considered list, not as a set piece.
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';
import { glowTexture, scenePalette } from '../scene-utils';

export interface PrinciplesScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

const RULE_COUNT = 5;
const RAIL_SPAN = 9;
const RAIL_SPACING = 1.05;
/** How far the probe stream travels before it is turned away. */
const BLOCKED_AT = -2.1;

export function createPrinciplesScene(theme: ThemeName): PrinciplesScene {
  const group = new THREE.Group();
  const palette = scenePalette(theme);
  const disposables: Array<{ dispose: () => void }> = [];

  // ── The rails ─────────────────────────────────────────────────────
  const railMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(palette.structure),
    transparent: true,
    opacity: theme === 'dark' ? 0.5 : 0.42,
  });
  disposables.push(railMat);

  const markerMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.core),
    transparent: true,
    opacity: 0.85,
  });
  disposables.push(markerMat);
  const markerGeo = new THREE.OctahedronGeometry(0.13, 0);
  disposables.push(markerGeo);

  const markers: THREE.Mesh[] = [];
  for (let i = 0; i < RULE_COUNT; i++) {
    const y = (i - (RULE_COUNT - 1) / 2) * RAIL_SPACING;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-RAIL_SPAN / 2, y, 0),
      new THREE.Vector3(RAIL_SPAN / 2, y, 0),
    ]);
    disposables.push(geo);
    group.add(new THREE.Line(geo, railMat));

    const marker = new THREE.Mesh(markerGeo, markerMat);
    group.add(marker);
    markers.push(marker);
  }

  // ── The probe: the one thing that tries to get through ────────────
  const probeMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowTexture(palette.streamA)),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  disposables.push(probeMat);
  const probe = new THREE.Sprite(probeMat);
  probe.scale.set(0.9, 0.9, 1);
  group.add(probe);

  // A short trail behind the probe, so its direction of travel is legible.
  const trailGeo = new THREE.BufferGeometry();
  const TRAIL = 14;
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  disposables.push(trailGeo);
  const trailMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(palette.streamA),
    transparent: true,
    opacity: 0.35,
  });
  disposables.push(trailMat);
  const trail = new THREE.Line(trailGeo, trailMat);
  group.add(trail);

  const trailPos = trailGeo.getAttribute('position') as THREE.BufferAttribute;

  function update(t: number, _dt: number, lp: number): void {
    const presence = 0.6 + lp * 0.4;

    // Markers idle along their rail, each on its own phase so the row never
    // pulses in unison.
    for (let i = 0; i < markers.length; i++) {
      const y = (i - (RULE_COUNT - 1) / 2) * RAIL_SPACING;
      const m = markers[i]!;
      const a = t * 0.35 + i * 1.3;
      m.position.set(Math.sin(a) * (RAIL_SPAN / 2 - 0.8), y, Math.sin(a * 1.7) * 0.12);
      m.rotation.y = a * 0.6;
      m.rotation.x = a * 0.35;
    }
    markerMat.opacity = 0.85 * presence;

    // The probe sweeps in, is stopped at the boundary, then retreats. It never
    // crosses — that is the entire claim of the section.
    const cycle = (Math.sin(t * 0.45) + 1) / 2; // 0..1 triangle-ish
    const from = -RAIL_SPAN / 2 + 0.6;
    const x = from + (BLOCKED_AT - from) * Math.min(1, cycle * 1.6);

    // Fade the probe out as it is turned away, so the reversal reads as
    // "refused" rather than as a looping glitch.
    const refusal = Math.max(0, Math.min(1, (cycle - 0.62) / 0.38));
    probe.position.set(x, 0, 0);
    probeMat.opacity = 0.8 * presence * (1 - refusal * 0.85);

    for (let i = 0; i < TRAIL; i++) {
      // Each trail point trails further behind, and compresses as the probe
      // stalls at the boundary.
      const lag = i * (0.12 + refusal * 0.22);
      trailPos.setXYZ(i, x - lag, 0, 0);
    }
    trailPos.needsUpdate = true;
    trailMat.opacity = 0.35 * presence * (1 - refusal * 0.7);

    railMat.opacity = (theme === 'dark' ? 0.5 : 0.42) * presence;
  }

  function dispose(): void {
    disposables.forEach((d) => d.dispose());
    group.clear();
  }

  return { group, update, dispose };
}
