/**
 * COMPOUNDING — memory density growth (vanilla three).
 * A lattice of memory cubes assembles itself as the section scrolls:
 * sparse at day one, dense by year one. Progress-scrubbed, so the
 * visitor drags time forward with their thumb.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, type SceneHandle } from './engine';
import { mulberry32, scenePalette } from '../scene-utils';

const GRID = 8; // 8 x 5 x 8
const GRID_Y = 5;
const COUNT = GRID * GRID_Y * GRID;

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
};

export function mountGrowth({
  container,
  theme,
}: Cfg): SceneHandle & { setProgress: (p: number) => void } {
  const palette = scenePalette(theme);
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(7.5, 5.5, 9.5);
  camera.lookAt(0, 1.2, 0);

  const rand = mulberry32(20260825);
  const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;

  const cubes: Array<{ x: number; y: number; z: number; threshold: number; seed: number }> = [];
  let i = 0;
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID_Y; gy++) {
      for (let gz = 0; gz < GRID; gz++) {
        cubes.push({
          x: (gx - (GRID - 1) / 2) * 0.85,
          y: gy * 0.85 + 0.3,
          z: (gz - (GRID - 1) / 2) * 0.85,
          // bottom-up + center-out assembly with noise
          threshold: Math.min(1, (gy / GRID_Y) * 0.55 + rand() * 0.45),
          seed: rand() * Math.PI * 2,
        });
        i++;
      }
    }
  }
  void i;
  scene.add(mesh);

  // per-instance color by height (indigo -> cyan)
  const color = new THREE.Color();
  const cLow = new THREE.Color(palette.core);
  const cHigh = new THREE.Color(theme === 'light' ? '#0891b2' : '#22d3ee');

  let progress = 0;

  const dummy = new THREE.Object3D();
  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      tick: (dt, t) => {
        camera.position.x = Math.sin(t * 0.08) * 8.2;
        camera.position.z = Math.cos(t * 0.08) * 9.8;
        camera.lookAt(0, 1.2, 0);

        for (let idx = 0; idx < COUNT; idx++) {
          const c = cubes[idx]!;
          const local = Math.min(1, Math.max(0, (progress - c.threshold * 0.85) / 0.15));
          const pop = local * (1 + Math.sin(c.seed + t * 1.6) * 0.06 * local);
          dummy.position.set(c.x, c.y, c.z);
          dummy.scale.setScalar(pop);
          dummy.rotation.y = c.seed + t * 0.1 * local;
          dummy.updateMatrix();
          mesh.setMatrixAt(idx, dummy.matrix);
          color.copy(cLow).lerp(cHigh, c.y / (GRID_Y * 0.85));
          mesh.setColorAt(idx, color);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
    },
    1.6,
  );

  return {
    setRunning: handle.setRunning,
    dispose: handle.dispose,
    setProgress(p: number): void {
      progress = Math.min(1, Math.max(0, p));
    },
  };
}

export function createGrowth(theme: 'dark' | 'light'): {
  group: THREE.Group;
  update: (localProgress: number) => void;
  dispose: () => void;
} {
  const palette = scenePalette(theme);
  const group = new THREE.Group();
  const rand = mulberry32(20260825);
  const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  const cubes: Array<{ x: number; y: number; z: number; threshold: number; seed: number }> = [];
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID_Y; gy++) {
      for (let gz = 0; gz < GRID; gz++) {
        cubes.push({
          x: (gx - (GRID - 1) / 2) * 0.85,
          y: gy * 0.85 + 0.3,
          z: (gz - (GRID - 1) / 2) * 0.85,
          threshold: Math.min(1, (gy / GRID_Y) * 0.55 + rand() * 0.45),
          seed: rand() * Math.PI * 2,
        });
      }
    }
  }
  group.add(mesh);
  const color = new THREE.Color();
  const cLow = new THREE.Color(palette.core);
  const cHigh = new THREE.Color(theme === 'light' ? '#0891b2' : '#22d3ee');
  const dummy = new THREE.Object3D();
  function update(localProgress: number): void {
    const progress = Math.min(1, Math.max(0, localProgress));
    for (let idx = 0; idx < COUNT; idx++) {
      const c = cubes[idx]!;
      const local = Math.min(1, Math.max(0, (progress - c.threshold * 0.85) / 0.15));
      const pop = local * (1 + Math.sin(c.seed) * 0.06 * local);
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.setScalar(pop);
      dummy.rotation.y = c.seed;
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      color.copy(cLow).lerp(cHigh, c.y / (GRID_Y * 0.85));
      mesh.setColorAt(idx, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  function dispose(): void {
    geo.dispose();
    mat.dispose();
  }
  return { group, update, dispose };
}
