/**
 * HOW IT WORKS — journey scene (vanilla three).
 * A scroll-scrubbed camera flight through nine glowing stations along a
 * winding path in space — the visitor literally travels the pipeline.
 * DOM stage cards remain the accessible source of truth; the scene
 * mirrors the active stage via setProgress/setStage.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, type SceneHandle } from './engine';
import { glowTexture, scenePalette } from '../scene-utils';

const STATION_SPACING = 3.4;
const STATIONS = 9;

function stationPosition(i: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(i * 1.1) * 1.5, Math.cos(i * 0.8) * 0.9, -i * STATION_SPACING);
}

const HALO_CYCLE = ['#818cf8', '#22d3ee', '#e879f9'] as const;

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
};

export function mountJourney({
  container,
  theme,
}: Cfg): SceneHandle & { setProgress: (p: number) => void } {
  const palette = scenePalette(theme);
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 0, 7);
  camera.fov = 55;

  /* Path rail — a faint line threading the stations */
  const railPts: THREE.Vector3[] = [];
  for (let i = 0; i < STATIONS; i++) railPts.push(stationPosition(i));
  const railGeo = new THREE.BufferGeometry().setFromPoints(railPts);
  const rail = new THREE.Line(
    railGeo,
    new THREE.LineBasicMaterial({ color: palette.structure, transparent: true, opacity: 0.22 }),
  );
  scene.add(rail);

  /* Stations */
  const halos: THREE.Sprite[] = [];
  const shells: THREE.Mesh[] = [];
  const cores: THREE.Mesh[] = [];
  const haloMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < STATIONS; i++) {
    const pos = stationPosition(i);
    const haloColor = HALO_CYCLE[i % 3]!;
    const mat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowTexture(haloColor)),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(mat);
    halo.position.copy(pos);
    halo.scale.setScalar(1.6);
    scene.add(halo);
    halos.push(halo);
    haloMats.push(mat);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 1),
      new THREE.MeshBasicMaterial({
        color: palette.structure,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      }),
    );
    shell.position.copy(pos);
    scene.add(shell);
    shells.push(shell);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.85 }),
    );
    core.position.copy(pos);
    scene.add(core);
    cores.push(core);
  }

  /* Starfield depth cue */
  const dustCount = Math.round(260 * 0.8);
  const dpos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dpos[i * 3] = (Math.random() - 0.5) * 16;
    dpos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    dpos[i * 3 + 2] = 4 - Math.random() * (STATIONS * STATION_SPACING + 8);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(
    dgeo,
    new THREE.PointsMaterial({
      size: 0.045,
      color: palette.dust,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  dust.frustumCulled = false;
  scene.add(dust);

  let progress = 0;
  const totalDepth = (STATIONS - 1) * STATION_SPACING;

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      tick: (dt, t) => {
        const camZ = 6.5 - progress * (totalDepth + 5);
        camera.position.z += (camZ - camera.position.z) * Math.min(1, dt * 6);
        camera.position.x = Math.sin(progress * Math.PI * 2) * 0.6;
        camera.position.y = Math.cos(progress * Math.PI * 2) * 0.4;
        camera.lookAt(camera.position.x * 0.4, camera.position.y * 0.4, camera.position.z - 5);

        for (let i = 0; i < STATIONS; i++) {
          const s = shells[i]!;
          s.rotation.y = t * 0.4 + i;
          s.rotation.x = t * 0.23;
          const dist = Math.abs(s.position.z - camera.position.z);
          const near = Math.max(0, 1 - dist / 7);
          (s.material as THREE.MeshBasicMaterial).opacity = 0.25 + near * 0.55;
          (cores[i]!.material as THREE.MeshBasicMaterial).opacity = 0.4 + near * 0.6;
          haloMats[i]!.opacity = 0.16 + near * 0.5;
          halos[i]!.scale.setScalar(1.4 + near * 0.9);
        }
      },
    },
    1.75,
  );

  return {
    setRunning: handle.setRunning,
    dispose: handle.dispose,
    setProgress(p: number): void {
      progress = Math.min(1, Math.max(0, p));
    },
  };
}

export function createJourney(theme: 'dark' | 'light'): {
  group: THREE.Group;
  update: (localProgress: number) => void;
  dispose: () => void;
} {
  const palette = scenePalette(theme);
  const group = new THREE.Group();
  const railPts: THREE.Vector3[] = [];
  for (let i = 0; i < STATIONS; i++) railPts.push(stationPosition(i));
  const railGeo = new THREE.BufferGeometry().setFromPoints(railPts);
  const rail = new THREE.Line(
    railGeo,
    new THREE.LineBasicMaterial({ color: palette.structure, transparent: true, opacity: 0.22 }),
  );
  group.add(rail);
  const halos: THREE.Sprite[] = [];
  const shells: THREE.Mesh[] = [];
  const cores: THREE.Mesh[] = [];
  const haloMats: THREE.SpriteMaterial[] = [];
  const shellMats: THREE.MeshBasicMaterial[] = [];
  const coreMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < STATIONS; i++) {
    const pos = stationPosition(i);
    const haloColor = HALO_CYCLE[i % 3]!;
    const mat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowTexture(haloColor)),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(mat);
    halo.position.copy(pos);
    halo.scale.setScalar(1.6);
    group.add(halo);
    halos.push(halo);
    haloMats.push(mat);
    const shellMat = new THREE.MeshBasicMaterial({
      color: palette.structure,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), shellMat);
    shell.position.copy(pos);
    group.add(shell);
    shells.push(shell);
    shellMats.push(shellMat);
    const coreMat = new THREE.MeshBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: 0.85,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), coreMat);
    core.position.copy(pos);
    group.add(core);
    cores.push(core);
    coreMats.push(coreMat);
  }
  const dustCount = Math.round(260 * 0.8);
  const dpos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dpos[i * 3] = (Math.random() - 0.5) * 16;
    dpos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    dpos[i * 3 + 2] = 4 - Math.random() * (STATIONS * STATION_SPACING + 8);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(
    dgeo,
    new THREE.PointsMaterial({
      size: 0.045,
      color: palette.dust,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  dust.frustumCulled = false;
  group.add(dust);
  const totalDepth = (STATIONS - 1) * STATION_SPACING;
  function update(localProgress: number): void {
    const progress = Math.min(1, Math.max(0, localProgress));
    const camZ = 6.5 - progress * (totalDepth + 5);
    for (let i = 0; i < STATIONS; i++) {
      const s = shells[i]!;
      s.rotation.y = i;
      s.rotation.x = 0;
      const dist = Math.abs(s.position.z - camZ);
      const near = Math.max(0, 1 - dist / 7);
      shellMats[i]!.opacity = 0.25 + near * 0.55;
      coreMats[i]!.opacity = 0.4 + near * 0.6;
      haloMats[i]!.opacity = 0.16 + near * 0.5;
      halos[i]!.scale.setScalar(1.4 + near * 0.9);
    }
  }
  function dispose(): void {
    railGeo.dispose();
    (rail.material as THREE.Material).dispose();
    dgeo.dispose();
    (dust.material as THREE.Material).dispose();
    shells.forEach((s, i) => {
      (s.geometry as THREE.BufferGeometry).dispose();
      shellMats[i]!.dispose();
    });
    cores.forEach((c, i) => {
      (c.geometry as THREE.BufferGeometry).dispose();
      coreMats[i]!.dispose();
    });
    haloMats.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  }
  return { group, update, dispose };
}
