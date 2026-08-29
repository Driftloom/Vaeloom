/**
 * ResumeScene — "document assembly" beat.
 *
 * A central document shape that assembles from scattered fragments.
 * Fragments fly in from edges and attach to the document as progress increases.
 * Represents the master resume being assembled from evidence.
 *
 * All geometry is procedural (PlaneGeometry fragments + central doc shape).
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';

export interface ResumeScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

const FRAGMENT_COUNT = 12;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createResumeScene(theme: ThemeName): ResumeScene {
  const group = new THREE.Group();

  const docColor = theme === 'dark' ? '#818cf8' : '#4f46e5';
  const fragColor = theme === 'dark' ? '#38bdf8' : '#0284c7';
  const lineColor = theme === 'dark' ? '#22d3ee' : '#0891b2';

  // ─── Central document (wireframe rectangle) ──────────────────
  const docGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.4, 3.2));
  const docMat = new THREE.LineBasicMaterial({
    color: docColor,
    transparent: true,
    opacity: 0.3,
  });
  const docLine = new THREE.LineSegments(docGeo, docMat);
  group.add(docLine);

  // Inner content lines (text simulation)
  const contentMat = new THREE.LineBasicMaterial({
    color: docColor,
    transparent: true,
    opacity: 0.15,
  });
  const contentGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const y = 1.2 - i * 0.35;
    const w = 1.4 + seededRandom(i * 7) * 0.6;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-w / 2, y, 0.01),
      new THREE.Vector3(w / 2, y, 0.01),
    ]);
    group.add(new THREE.Line(lineGeo, contentMat));
    contentGeos.push(lineGeo);
  }

  // ─── Scattered fragments that fly in ─────────────────────────
  const fragments: {
    mesh: THREE.Mesh;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startRot: THREE.Euler;
    endRot: THREE.Euler;
    delay: number;
  }[] = [];

  for (let i = 0; i < FRAGMENT_COUNT; i++) {
    const r = seededRandom;
    // Start position: scattered around the periphery
    const angle = r(i * 13) * Math.PI * 2;
    const dist = 3 + r(i * 17) * 3;
    const startX = Math.cos(angle) * dist;
    const startY = Math.sin(angle) * dist;
    const startZ = (r(i * 19) - 0.5) * 2;

    // End position: on the document
    const endX = (r(i * 23) - 0.5) * 1.8;
    const endY = (r(i * 29) - 0.5) * 2.6;

    const w = 0.2 + r(i * 31) * 0.4;
    const h = 0.15 + r(i * 37) * 0.3;

    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: fragColor,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(startX, startY, startZ);
    group.add(mesh);

    fragments.push({
      mesh,
      startPos: new THREE.Vector3(startX, startY, startZ),
      endPos: new THREE.Vector3(endX, endY, 0.02),
      startRot: new THREE.Euler(r(i * 41) * Math.PI, r(i * 43) * Math.PI, 0),
      endRot: new THREE.Euler(0, 0, 0),
      delay: r(i * 47) * 0.6,
    });
  }

  // ─── Provenance links (dashed lines from fragments to doc) ───
  const linkMat = new THREE.LineDashedMaterial({
    color: lineColor,
    transparent: true,
    opacity: 0.2,
    dashSize: 0.1,
    gapSize: 0.05,
  });

  function update(t: number, dt: number, localProgress: number): void {
    // Document gently breathes
    docLine.scale.setScalar(1 + Math.sin(t * 0.5) * 0.02);
    docMat.opacity = 0.2 + localProgress * 0.2;

    // Fragments fly in based on progress
    fragments.forEach((f) => {
      const p = Math.max(0, Math.min(1, (localProgress - f.delay) / (1 - f.delay)));
      // Ease out cubic
      const eased = 1 - Math.pow(1 - p, 3);

      f.mesh.position.lerpVectors(f.startPos, f.endPos, eased);
      f.mesh.rotation.x = f.startRot.x * (1 - eased);
      f.mesh.rotation.y = f.startRot.y * (1 - eased);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = 0.15 + eased * 0.35;
    });

    // Subtle rotation
    group.rotation.y = Math.sin(t * 0.12) * 0.04;
  }

  function dispose(): void {
    docGeo.dispose();
    docMat.dispose();
    contentMat.dispose();
    contentGeos.forEach((g) => g.dispose());
    linkMat.dispose();
    fragments.forEach((f) => {
      f.mesh.geometry.dispose();
      (f.mesh.material as THREE.Material).dispose();
    });
  }

  return { group, update, dispose };
}
