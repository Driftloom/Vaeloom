/**
 * ProblemScene — "fragmentation" beat.
 *
 * Scattered floating shards representing disconnected information:
 * documents, emails, notes, files drifting apart in space.
 * As the beat becomes active, shards slowly rotate and separate further.
 *
 * All geometry is procedural (PlaneGeometry + wireframe + opacity).
 */

import * as THREE from 'three';
import type { ThemeName } from './stageScene';

export interface ProblemScene {
  group: THREE.Group;
  update: (t: number, dt: number, localProgress: number) => void;
  dispose: () => void;
}

interface Shard {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  driftDir: THREE.Vector3;
  size: number;
}

const SHARD_COUNT = 18;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createProblemScene(theme: ThemeName): ProblemScene {
  const group = new THREE.Group();
  const shards: Shard[] = [];

  const baseColor = theme === 'dark' ? '#7c8cf8' : '#4f46e5';
  const edgeColor = theme === 'dark' ? '#2c2c34' : '#c4c9de';
  const accentColor = theme === 'dark' ? '#f87171' : '#dc2626';

  for (let i = 0; i < SHARD_COUNT; i++) {
    const r = seededRandom;
    // Spread shards in a loose cloud
    const x = (r(i * 3) - 0.5) * 8;
    const y = (r(i * 3 + 1) - 0.5) * 5;
    const z = (r(i * 3 + 2) - 0.5) * 4 - 2;

    const w = 0.4 + r(i * 7) * 0.8;
    const h = 0.3 + r(i * 7 + 1) * 0.6;

    const geo = new THREE.PlaneGeometry(w, h);
    const isAccent = i % 5 === 0;
    const mat = new THREE.MeshBasicMaterial({
      color: isAccent ? accentColor : baseColor,
      wireframe: true,
      transparent: true,
      opacity: isAccent ? 0.5 : 0.25 + r(i * 11) * 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(r(i * 13) * Math.PI, r(i * 17) * Math.PI, r(i * 19) * Math.PI * 0.3);
    group.add(mesh);

    shards.push({
      mesh,
      basePos: new THREE.Vector3(x, y, z),
      rotSpeed: new THREE.Vector3(
        (r(i * 23) - 0.5) * 0.3,
        (r(i * 29) - 0.5) * 0.4,
        (r(i * 31) - 0.5) * 0.1,
      ),
      driftDir: new THREE.Vector3(
        (r(i * 37) - 0.5) * 2,
        (r(i * 41) - 0.5) * 1.5,
        (r(i * 43) - 0.5) * 1,
      ).normalize(),
      size: w * h,
    });
  }

  // Edge frame — a broken rectangle suggesting a shattered container
  const edgeMat = new THREE.LineBasicMaterial({
    color: edgeColor,
    transparent: true,
    opacity: 0.2,
  });
  const edgePoints = [
    new THREE.Vector3(-3.5, -2.2, -1),
    new THREE.Vector3(-3.5, 2.2, -1),
    new THREE.Vector3(-0.5, 2.2, -1),
    new THREE.Vector3(0.3, 1.8, -1),
    new THREE.Vector3(3.5, 2.2, -1),
    new THREE.Vector3(3.5, -2.2, -1),
    new THREE.Vector3(0.8, -1.9, -1),
    new THREE.Vector3(-0.3, -2.2, -1),
    new THREE.Vector3(-3.5, -2.2, -1),
  ];
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
  const edgeLine = new THREE.Line(edgeGeo, edgeMat);
  group.add(edgeLine);

  function update(t: number, dt: number, localProgress: number): void {
    // As progress increases, shards drift further apart (fragmentation grows)
    const separation = localProgress * 1.5;
    shards.forEach((s, i) => {
      // Gentle rotation
      s.mesh.rotation.x += s.rotSpeed.x * dt;
      s.mesh.rotation.y += s.rotSpeed.y * dt;
      s.mesh.rotation.z += s.rotSpeed.z * dt;

      // Drift outward from center based on progress
      const drift = s.driftDir.clone().multiplyScalar(separation);
      s.mesh.position.copy(s.basePos).add(drift);

      // Subtle floating bob
      s.mesh.position.y += Math.sin(t * 0.5 + i * 1.7) * 0.05;
    });

    // Edge frame fades as shards scatter
    edgeMat.opacity = Math.max(0, 0.2 - localProgress * 0.15);
  }

  function dispose(): void {
    shards.forEach((s) => {
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    });
    edgeGeo.dispose();
    edgeMat.dispose();
  }

  return { group, update, dispose };
}
