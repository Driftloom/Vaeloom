/**
 * DifferenceScene — "before/after" beat.
 *
 * Two visual halves: left = scattered chatbot particles (chaos),
 * right = connected Vaeloom graph (order). As localProgress increases,
 * the left fades and right brightens, showing the contrast.
 *
 * All geometry is procedural (Points + Lines).
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';

export interface DifferenceScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

const CHAOS_COUNT = 60;
const ORDER_COUNT = 24;
const CONNECTIONS = 18;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createDifferenceScene(theme: ThemeName): DifferenceScene {
  const group = new THREE.Group();

  const chaosColor = theme === 'dark' ? '#f87171' : '#dc2626';
  const orderColor = theme === 'dark' ? '#818cf8' : '#4f46e5';
  const linkColor = theme === 'dark' ? '#22d3ee' : '#0891b2';

  // ─── LEFT: Chaos particles (scattered, no connections) ───────
  const chaosPositions = new Float32Array(CHAOS_COUNT * 3);
  const chaosVelocities: THREE.Vector3[] = [];
  for (let i = 0; i < CHAOS_COUNT; i++) {
    const x = (seededRandom(i * 3) - 0.5) * 5 - 2.5;
    const y = (seededRandom(i * 3 + 1) - 0.5) * 4;
    const z = (seededRandom(i * 3 + 2) - 0.5) * 2 - 1;
    chaosPositions[i * 3] = x;
    chaosPositions[i * 3 + 1] = y;
    chaosPositions[i * 3 + 2] = z;
    chaosVelocities.push(
      new THREE.Vector3(
        (seededRandom(i * 7) - 0.5) * 0.3,
        (seededRandom(i * 11) - 0.5) * 0.2,
        (seededRandom(i * 13) - 0.5) * 0.1,
      ),
    );
  }
  const chaosGeo = new THREE.BufferGeometry();
  chaosGeo.setAttribute('position', new THREE.BufferAttribute(chaosPositions, 3));
  const chaosMat = new THREE.PointsMaterial({
    color: chaosColor,
    size: 0.08,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });
  const chaosPoints = new THREE.Points(chaosGeo, chaosMat);
  chaosPoints.position.x = -2.5;
  group.add(chaosPoints);

  // ─── RIGHT: Order particles (structured grid + connections) ──
  const orderPositions = new Float32Array(ORDER_COUNT * 3);
  const cols = 6;
  const spacing = 0.7;
  for (let i = 0; i < ORDER_COUNT; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = col * spacing - (cols * spacing) / 2 + spacing / 2;
    const y = row * spacing - 1.5;
    const z = Math.sin(i * 0.8) * 0.3;
    orderPositions[i * 3] = x;
    orderPositions[i * 3 + 1] = y;
    orderPositions[i * 3 + 2] = z;
  }
  const orderGeo = new THREE.BufferGeometry();
  orderGeo.setAttribute('position', new THREE.BufferAttribute(orderPositions, 3));
  const orderMat = new THREE.PointsMaterial({
    color: orderColor,
    size: 0.1,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });
  const orderPoints = new THREE.Points(orderGeo, orderMat);
  orderPoints.position.x = 2.5;
  group.add(orderPoints);

  // ─── Connections between order nodes ─────────────────────────
  const linkPositions = new Float32Array(CONNECTIONS * 6);
  let linkIdx = 0;
  for (let i = 0; i < ORDER_COUNT && linkIdx < CONNECTIONS; i++) {
    const neighbors = [(i + 1) % ORDER_COUNT, (i + cols) % ORDER_COUNT];
    for (const j of neighbors) {
      if (linkIdx >= CONNECTIONS) break;
      const i3 = i * 3;
      const j3 = j * 3;
      linkPositions[linkIdx * 6] = orderPositions[i3]!;
      linkPositions[linkIdx * 6 + 1] = orderPositions[i3 + 1]!;
      linkPositions[linkIdx * 6 + 2] = orderPositions[i3 + 2]!;
      linkPositions[linkIdx * 6 + 3] = orderPositions[j3]!;
      linkPositions[linkIdx * 6 + 4] = orderPositions[j3 + 1]!;
      linkPositions[linkIdx * 6 + 5] = orderPositions[j3 + 2]!;
      linkIdx++;
    }
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
  const linkMat = new THREE.LineBasicMaterial({
    color: linkColor,
    transparent: true,
    opacity: 0.3,
  });
  const linkLines = new THREE.LineSegments(linkGeo, linkMat);
  linkLines.position.x = 2.5;
  group.add(linkLines);

  // ─── Divider line ────────────────────────────────────────────
  const divGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -3, -1),
    new THREE.Vector3(0, 3, -1),
  ]);
  const divMat = new THREE.LineBasicMaterial({
    color: linkColor,
    transparent: true,
    opacity: 0.15,
  });
  group.add(new THREE.Line(divGeo, divMat));

  // ─── Labels (wireframe rectangles) ───────────────────────────
  const labelMat = new THREE.LineBasicMaterial({
    color: chaosColor,
    transparent: true,
    opacity: 0.15,
  });
  const leftLabel = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.5, 0.4)),
    labelMat,
  );
  leftLabel.position.set(-2.5, 2.8, -1);
  group.add(leftLabel);

  const rightLabelMat = new THREE.LineBasicMaterial({
    color: orderColor,
    transparent: true,
    opacity: 0.15,
  });
  const rightLabel = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.5, 0.4)),
    rightLabelMat,
  );
  rightLabel.position.set(2.5, 2.8, -1);
  group.add(rightLabel);

  function update(t: number, dt: number, localProgress: number): void {
    // Chaos: particles drift randomly, more scattered over time
    const chaosPos = chaosGeo.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i < CHAOS_COUNT; i++) {
      const v = chaosVelocities[i]!;
      const i3 = i * 3;
      chaosPos.array[i3] = (chaosPos.array[i3] ?? 0) + v.x * dt * (1 + localProgress);
      chaosPos.array[i3 + 1] = (chaosPos.array[i3 + 1] ?? 0) + v.y * dt * (1 + localProgress);
      if (Math.abs(chaosPos.array[i3] ?? 0) > 4) v.x *= -1;
      if (Math.abs(chaosPos.array[i3 + 1] ?? 0) > 3) v.y *= -1;
    }
    chaosPos.needsUpdate = true;
    chaosMat.opacity = Math.max(0.1, 0.6 - localProgress * 0.4);

    // Order: particles gently pulse, connections brighten
    orderMat.opacity = 0.3 + localProgress * 0.5;
    linkMat.opacity = 0.1 + localProgress * 0.4;

    // Subtle group rotation
    group.rotation.y = Math.sin(t * 0.15) * 0.05;
  }

  function dispose(): void {
    chaosGeo.dispose();
    chaosMat.dispose();
    orderGeo.dispose();
    orderMat.dispose();
    linkGeo.dispose();
    linkMat.dispose();
    divGeo.dispose();
    divMat.dispose();
    labelMat.dispose();
    leftLabel.geometry.dispose();
    rightLabelMat.dispose();
    rightLabel.geometry.dispose();
  }

  return { group, update, dispose };
}
