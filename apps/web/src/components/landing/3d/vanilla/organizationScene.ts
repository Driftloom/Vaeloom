/**
 * OrganizationScene — "approval orbits" beat.
 *
 * Central hub with orbiting approval nodes that pulse when active.
 * Represents the auto-organizing workspace with approval-gated suggestions.
 *
 * All geometry is procedural (InstancedMesh + ring lines).
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';
import { scenePalette } from '../scene-utils';

export interface OrganizationScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

const ORBIT_COUNT = 5;
const RING_SEGMENTS = 64;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createOrganizationScene(theme: ThemeName): OrganizationScene {
  const group = new THREE.Group();

  // Colors come from the shared palette, not from private literals here. This
  // scene was the worst offender: it kept its own `theme === 'dark' ? …` set,
  // so it never received the light-theme redesign, and its approval rings —
  // the section's entire named visual — composited to 1.017:1 against the
  // light band. Mathematically the same colour as the background.
  const palette = scenePalette(theme);
  const hubColor = palette.core;
  const nodeColor = palette.nodes['topic'];
  const ringColor = palette.edge;
  const pulseColor = palette.streamA;

  // ─── Central hub ─────────────────────────────────────────────
  const hubGeo = new THREE.IcosahedronGeometry(0.6, 2);
  const hubMat = new THREE.MeshBasicMaterial({
    color: hubColor,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  group.add(hub);

  // ─── Orbit rings ─────────────────────────────────────────────
  const orbitNodes: {
    mesh: THREE.Mesh;
    ring: THREE.Line;
    angle: number;
    speed: number;
    radius: number;
  }[] = [];
  for (let i = 0; i < ORBIT_COUNT; i++) {
    const r = 1.5 + i * 0.6;
    const angle = seededRandom(i * 17) * Math.PI * 2;
    const speed = 0.15 + seededRandom(i * 23) * 0.2;

    // Ring
    const ringPts: THREE.Vector3[] = [];
    for (let j = 0; j <= RING_SEGMENTS; j++) {
      const a = (j / RING_SEGMENTS) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.3, 0));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringMat = new THREE.LineBasicMaterial({
      color: ringColor,
      transparent: true,
      // 0.15 was tuned when this scene had its own darker light palette. Once
      // the edge colour came from the shared palette the effective alpha
      // (material x slot 0.30) landed the rings at 4.5% — invisible. These
      // rings ARE the section's concept, so they get a floor.
      opacity: 0.45,
    });
    const ring = new THREE.Line(ringGeo, ringMat);
    ring.rotation.x = seededRandom(i * 31) * 0.4;
    ring.rotation.z = seededRandom(i * 37) * 0.3;
    group.add(ring);

    // Node on ring
    const nodeGeo = new THREE.OctahedronGeometry(0.15, 0);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? nodeColor : pulseColor,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(nodeGeo, nodeMat);
    group.add(mesh);

    orbitNodes.push({ mesh, ring, angle, speed, radius: r });
  }

  // ─── Connection lines from hub to nodes ──────────────────────
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array(ORBIT_COUNT * 6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: pulseColor,
    transparent: true,
    opacity: 0.35,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  group.add(lines);

  function update(t: number, dt: number, localProgress: number): void {
    // Hub rotates
    hub.rotation.y = t * 0.2;
    hub.rotation.x = Math.sin(t * 0.15) * 0.1;

    // Orbit nodes move along their rings
    const posAttr = lineGeo.attributes['position'] as THREE.BufferAttribute;
    orbitNodes.forEach((node, i) => {
      node.angle += node.speed * dt;
      const x = Math.cos(node.angle) * node.radius;
      const y = Math.sin(node.angle) * node.radius * 0.3;
      node.mesh.position.set(x, y, 0);
      node.mesh.rotation.y = t * 0.5;
      node.mesh.rotation.x = t * 0.3;

      // Connection line from hub to node
      posAttr.array[i * 6] = 0;
      posAttr.array[i * 6 + 1] = 0;
      posAttr.array[i * 6 + 2] = 0;
      posAttr.array[i * 6 + 3] = x;
      posAttr.array[i * 6 + 4] = y;
      posAttr.array[i * 6 + 5] = 0;
    });
    posAttr.needsUpdate = true;

    // Pulse effect as progress increases
    const pulse = 0.5 + Math.sin(t * 2) * 0.15 * localProgress;
    hubMat.opacity = pulse;
    // Floor kept in step with the constructor: the hub-to-node links are what
    // make the orbits read as orbits rather than as stray circles.
    lineMat.opacity = 0.35 + localProgress * 0.25;
  }

  function dispose(): void {
    hubGeo.dispose();
    hubMat.dispose();
    orbitNodes.forEach((n) => {
      n.mesh.geometry.dispose();
      (n.mesh.material as THREE.Material).dispose();
      n.ring.geometry.dispose();
      (n.ring.material as THREE.Material).dispose();
    });
    lineGeo.dispose();
    lineMat.dispose();
  }

  return { group, update, dispose };
}
