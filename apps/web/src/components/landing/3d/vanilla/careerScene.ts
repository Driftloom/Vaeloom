/**
 * CareerScene — "career pipeline" beat.
 *
 * Opportunities arrive on parallel rails at different depths, get ranked, and
 * only the ones you approve pass the gate. The visual grammar is deliberately
 * literal: many candidates in, a short ranked queue, one gate, and a trail of
 * accepted cards leaving toward the right.
 *
 * Everything is procedural — no textures, no postprocessing. Colors come from
 * `scenePalette()` so the light theme stays a designed counterpart rather than
 * an inverted copy.
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';
import { glowTexture, mulberry32, scenePalette } from '../scene-utils';

export interface CareerScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

const RAIL_COUNT = 4;
const CARDS_PER_RAIL = 5;
const RAIL_SPREAD = 3.4;
const RAIL_DEPTH = 5.2;
const RAIL_X0 = -7;
const RAIL_X1 = 7;
const GATE_X = 0.9;

interface Card {
  mesh: THREE.Mesh;
  rail: number;
  /** The middle two rails are the shortlist; the outer rails are noise. */
  shortlisted: boolean;
  /** Phase along the card's own path, 0..1. */
  phase: number;
  /** Travel speed — shortlisted cards move slower than inbound noise. */
  speed: number;
  baseOpacity: number;
  tint: THREE.Color;
}

export function createCareerScene(theme: ThemeName): CareerScene {
  const group = new THREE.Group();
  const palette = scenePalette(theme);
  const rand = mulberry32(0x5eedcafe);
  const disposables: Array<{ dispose: () => void }> = [];

  // ── Rails: the tracks opportunities travel along ──────────────────
  const railMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(palette.edge),
    transparent: true,
    opacity: theme === 'dark' ? 0.55 : 0.4,
  });
  disposables.push(railMat);

  const railYs: number[] = [];
  const railZs: number[] = [];
  for (let r = 0; r < RAIL_COUNT; r++) {
    const t = r / (RAIL_COUNT - 1);
    const y = (t - 0.5) * RAIL_SPREAD;
    const z = -t * RAIL_DEPTH;
    railYs.push(y);
    railZs.push(z);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(RAIL_X0, y, z),
      new THREE.Vector3(RAIL_X1, y, z),
    ]);
    disposables.push(geo);
    group.add(new THREE.Line(geo, railMat));
  }

  // ── The gate: the single approval point everything must pass ──────
  const gateGeo = new THREE.PlaneGeometry(0.06, RAIL_SPREAD + 0.9);
  const gateMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.core),
    transparent: true,
    opacity: 0.4,
  });
  disposables.push(gateGeo, gateMat);
  const gate = new THREE.Mesh(gateGeo, gateMat);
  gate.position.set(GATE_X, 0, -RAIL_DEPTH * 0.5);
  group.add(gate);

  // NormalBlending, NOT additive: over the light page an additive glow at this
  // size (~490px across) composited to `#FDFDFF` — a bright white smudge that
  // erased the tint it was supposed to sit in.
  const gateGlowMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowTexture(palette.core)),
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  disposables.push(gateGlowMat);
  const gateGlow = new THREE.Sprite(gateGlowMat);
  gateGlow.scale.set(3.4, 3.4, 1);
  gateGlow.position.copy(gate.position);
  group.add(gateGlow);

  // ── Cards ─────────────────────────────────────────────────────────
  const cardGeo = new THREE.PlaneGeometry(0.34, 0.22);
  disposables.push(cardGeo);

  const cards: Card[] = [];
  const noiseTint = new THREE.Color(palette.edge);
  const altTint = new THREE.Color(palette.streamA);
  const leadTint = new THREE.Color(palette.core);

  for (let r = 0; r < RAIL_COUNT; r++) {
    const shortlisted = r === 1 || r === 2;
    for (let c = 0; c < CARDS_PER_RAIL; c++) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(palette.edge),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      disposables.push(mat);

      const mesh = new THREE.Mesh(cardGeo, mat);
      group.add(mesh);

      cards.push({
        mesh,
        rail: r,
        shortlisted,
        phase: rand(),
        speed: shortlisted ? 0.14 + rand() * 0.06 : 0.3 + rand() * 0.25,
        baseOpacity: shortlisted ? 0.9 : 0.4,
        // Even indices lead the shortlist in `core`, odd ones in `streamA`,
        // so the ranked queue reads as a mix of skills, not a single color.
        tint: shortlisted ? (c % 2 === 0 ? leadTint : altTint) : noiseTint,
      });
    }
  }

  function update(t: number, _dt: number, lp: number): void {
    // Reading the section brings the pipeline up to full strength.
    const presence = 0.55 + lp * 0.45;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      const y = railYs[card.rail]!;
      const z = railZs[card.rail]!;

      card.phase += card.speed * 0.016;
      if (card.phase > 1) card.phase -= 1;
      const p = card.phase;

      let x: number;
      let depth: number;
      let opacity = card.baseOpacity;

      if (!card.shortlisted) {
        // Inbound noise: crosses the frame once, never inspected.
        x = RAIL_X0 + p * (RAIL_X1 - RAIL_X0);
        depth = z;
      } else if (p < 0.55) {
        // Approaching the gate.
        const q = p / 0.55;
        x = RAIL_X0 + q * (GATE_X - RAIL_X0);
        depth = z;
        opacity = card.baseOpacity * (0.45 + q * 0.55);
      } else if (p < 0.72) {
        // Queued at the gate, stacked in depth so it reads as a shortlist.
        const q = (p - 0.55) / 0.17;
        x = GATE_X + Math.sin(t * 0.8 + i) * 0.06;
        depth = z + (q - 0.5) * 0.5;
      } else {
        // Approved: leaves to the right and fades.
        const q = (p - 0.72) / 0.28;
        x = GATE_X + q * (RAIL_X1 - GATE_X);
        depth = z - q * 0.8;
        opacity = card.baseOpacity * (1 - q);
      }

      card.mesh.position.set(x, y + Math.sin(t * 0.6 + i * 1.7) * 0.07, depth);
      card.mesh.rotation.z = Math.sin(t * 0.4 + i) * 0.12;

      const mat = card.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = opacity * presence;
      mat.color.lerp(card.tint, 0.08);
    }

    // The gate breathes; its glow is the visual "you approve here".
    const pulse = 0.5 + Math.sin(t * 1.4) * 0.5;
    gateMat.opacity = ((theme === 'dark' ? 0.34 : 0.22) + pulse * 0.22) * presence;
    gateGlowMat.opacity = ((theme === 'dark' ? 0.34 : 0.3) + pulse * 0.2) * presence;
    gateGlow.scale.setScalar(3.2 + pulse * 0.5);
  }

  function dispose(): void {
    disposables.forEach((d) => d.dispose());
    group.clear();
  }

  return { group, update, dispose };
}
