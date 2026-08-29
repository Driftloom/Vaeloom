/**
 * SchedulerScene — "timeline particles" beat.
 *
 * A horizontal timeline with floating event particles that pulse and shift.
 * Represents deadline detection and schedule conflict visualization.
 *
 * All geometry is procedural (line timeline + Points particles).
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';

export interface SchedulerScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

const PARTICLE_COUNT = 40;
const TIMELINE_LENGTH = 8;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createSchedulerScene(theme: ThemeName): SchedulerScene {
  const group = new THREE.Group();

  const lineColor = theme === 'dark' ? '#818cf8' : '#4f46e5';
  const particleColor = theme === 'dark' ? '#c084fc' : '#9333ea';
  const warningColor = theme === 'dark' ? '#fbbf24' : '#d97706';
  const safeColor = theme === 'dark' ? '#34d399' : '#059669';

  // ─── Timeline axis ───────────────────────────────────────────
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-TIMELINE_LENGTH / 2, 0, 0),
    new THREE.Vector3(TIMELINE_LENGTH / 2, 0, 0),
  ]);
  const axisMat = new THREE.LineBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: 0.3,
  });
  group.add(new THREE.Line(axisGeo, axisMat));

  // Tick marks
  for (let i = 0; i <= 8; i++) {
    const x = -TIMELINE_LENGTH / 2 + (i / 8) * TIMELINE_LENGTH;
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -0.15, 0),
      new THREE.Vector3(x, 0.15, 0),
    ]);
    const tickMat = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: 0.2,
    });
    group.add(new THREE.Line(tickGeo, tickMat));
  }

  // ─── Event particles ─────────────────────────────────────────
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const particleData: { baseY: number; speed: number; isWarning: boolean }[] = [];

  const warningColorObj = new THREE.Color(warningColor);
  const safeColorObj = new THREE.Color(safeColor);
  const particleColorObj = new THREE.Color(particleColor);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = seededRandom;
    const x = (r(i * 3) - 0.5) * TIMELINE_LENGTH;
    const y = (r(i * 3 + 1) - 0.5) * 2;
    const z = (r(i * 3 + 2) - 0.5) * 1;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const isWarning = r(i * 7) > 0.7;
    const c = isWarning ? warningColorObj : r(i * 11) > 0.5 ? safeColorObj : particleColorObj;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    particleData.push({
      baseY: y,
      speed: 0.3 + r(i * 13) * 0.5,
      isWarning,
    });
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  // ─── Conflict indicators (warning lines between close particles) ──
  const conflictMat = new THREE.LineBasicMaterial({
    color: warningColor,
    transparent: true,
    opacity: 0.15,
  });

  function update(t: number, dt: number, localProgress: number): void {
    const posAttr = particleGeo.attributes['position'] as THREE.BufferAttribute;

    // Move particles along timeline and bob vertically
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const d = particleData[i]!;
      const i3 = i * 3;
      posAttr.array[i3] = (posAttr.array[i3] ?? 0) + dt * 0.1;
      if ((posAttr.array[i3] ?? 0) > TIMELINE_LENGTH / 2) posAttr.array[i3] = -TIMELINE_LENGTH / 2;
      posAttr.array[i3 + 1] = d.baseY + Math.sin(t * d.speed + i) * 0.3;
    }
    posAttr.needsUpdate = true;

    // Warning particles pulse more intensely
    particleMat.opacity = 0.4 + localProgress * 0.3;

    // Subtle group rotation
    group.rotation.y = Math.sin(t * 0.1) * 0.03;
  }

  function dispose(): void {
    axisGeo.dispose();
    axisMat.dispose();
    particleGeo.dispose();
    particleMat.dispose();
    conflictMat.dispose();
    group.traverse((c) => {
      if (c instanceof THREE.Line) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    });
  }

  return { group, update, dispose };
}
