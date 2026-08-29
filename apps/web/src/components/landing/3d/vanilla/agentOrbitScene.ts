/**
 * Agents — orbiting specialists around one shared core (vanilla three).
 * Selecting an agent swings the ring so it faces the camera and
 * highlights its link into the core.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, pickAt, type SceneHandle } from './engine';
import { AGENT_HUES, glowTexture, scenePalette } from '../scene-utils';

const ORBIT_RADIUS = 2.6;
const RING_TILT = 0.32;
const agentAngle = (i: number): number => (i / 8) * Math.PI * 2;

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  ids: string[];
  selectedId: string;
  onSelect?: (id: string) => void;
};

export function mountAgentOrbit({
  container,
  theme,
  ids,
  selectedId,
  onSelect,
}: Cfg): SceneHandle & { setSelected: (id: string) => void } {
  const palette = scenePalette(theme);
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 1.9, 6.4);

  /* Core */
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowTexture(palette.core)),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.setScalar(2.6);
  scene.add(halo);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshBasicMaterial({
      color: palette.core,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    }),
  );
  scene.add(shell);
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 20),
      new THREE.MeshBasicMaterial({ color: palette.core }),
    ),
  );

  /* Ring group */
  const ring = new THREE.Group();
  ring.rotation.x = RING_TILT;
  scene.add(ring);

  /* Orbit guide */
  ring.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(ORBIT_RADIUS, 0.008, 8, 128),
      new THREE.MeshBasicMaterial({ color: palette.structure, transparent: true, opacity: 0.35 }),
    ),
  );

  /* Agent nodes — instanced octahedra */
  const n = ids.length;
  const mesh = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial(),
    n,
  );
  mesh.frustumCulled = false;
  ring.add(mesh);

  /* Links to core */
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  linkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const links = new THREE.LineSegments(
    linkGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
  );
  links.frustumCulled = false;
  ring.add(links);

  let currentRotation = -agentAngle(Math.max(0, ids.indexOf(selectedId)));
  let targetId = selectedId;

  function updateLinks(): void {
    const posArr = (linkGeo.getAttribute('position') as THREE.BufferAttribute)
      .array as Float32Array;
    const colArr = (linkGeo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const hot = new THREE.Color(palette.link);
    const dim = new THREE.Color(palette.edge);
    ids.forEach((id, i) => {
      const a = agentAngle(i);
      posArr.set([Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS, 0, 0, 0], i * 6);
      const c = id === targetId ? hot : dim;
      colArr.set([c.r, c.g, c.b], i * 6);
      colArr.set([c.r, c.g, c.b], i * 6 + 3);
    });
    (linkGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (linkGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
  updateLinks();

  const dummy = new THREE.Object3D();

  const onMove = (e: PointerEvent): void => {
    const id = pickAt(e, container, camera, [mesh]);
    if (id >= 0 && id < n) {
      const picked = ids[id];
      if (picked && picked !== targetId && onSelect) onSelect(picked);
    }
  };
  container.addEventListener('pointermove', onMove);

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      tick: (dt, t) => {
        // swing selected agent to the front
        const idx = Math.max(0, ids.indexOf(targetId));
        const target = -agentAngle(idx);
        let diff = target - currentRotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        currentRotation += diff * Math.min(1, dt * 4);
        ring.rotation.y = currentRotation;

        ids.forEach((id, i) => {
          const a = agentAngle(i);
          const bob = Math.sin(t * 1.1 + i * 1.7) * 0.08;
          dummy.position.set(Math.cos(a) * ORBIT_RADIUS, bob, Math.sin(a) * ORBIT_RADIUS);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, new THREE.Color(AGENT_HUES[id] ?? '#818cf8'));
        });
        if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        camera.lookAt(0, 0, 0);
      },
    },
    1.75,
  );

  return {
    setRunning: handle.setRunning,
    dispose(): void {
      container.removeEventListener('pointermove', onMove);
      handle.dispose();
    },
    setSelected(id: string): void {
      targetId = id;
      updateLinks();
    },
  };
}

export function createAgentOrbit(
  theme: 'dark' | 'light',
  ids: string[],
): {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
  focus: (id: string) => void;
  dispose: () => void;
} {
  const palette = scenePalette(theme);
  const group = new THREE.Group();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowTexture(palette.core)),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.setScalar(2.6);
  group.add(halo);
  group.add(
    new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshBasicMaterial({
        color: palette.core,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      }),
    ),
  );
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 20),
      new THREE.MeshBasicMaterial({ color: palette.core }),
    ),
  );
  const ring = new THREE.Group();
  ring.rotation.x = RING_TILT;
  group.add(ring);
  ring.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(ORBIT_RADIUS, 0.008, 8, 128),
      new THREE.MeshBasicMaterial({ color: palette.structure, transparent: true, opacity: 0.35 }),
    ),
  );
  const n = ids.length;
  const mesh = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial(),
    n,
  );
  mesh.frustumCulled = false;
  ring.add(mesh);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  linkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const links = new THREE.LineSegments(
    linkGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
  );
  links.frustumCulled = false;
  ring.add(links);
  let currentRotation = 0;
  let targetId = ids[0] ?? '';
  function updateLinks(): void {
    const posArr = (linkGeo.getAttribute('position') as THREE.BufferAttribute)
      .array as Float32Array;
    const colArr = (linkGeo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const hot = new THREE.Color(palette.link);
    const dim = new THREE.Color(palette.edge);
    ids.forEach((id, i) => {
      const a = agentAngle(i);
      posArr.set([Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS, 0, 0, 0], i * 6);
      const c = id === targetId ? hot : dim;
      colArr.set([c.r, c.g, c.b], i * 6);
      colArr.set([c.r, c.g, c.b], i * 6 + 3);
    });
    (linkGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (linkGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
  updateLinks();
  const dummy = new THREE.Object3D();
  function update(t: number, dt: number): void {
    const idx = Math.max(0, ids.indexOf(targetId));
    const target = -agentAngle(idx);
    let diff = target - currentRotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    currentRotation += diff * Math.min(1, dt * 4);
    ring.rotation.y = currentRotation;
    ids.forEach((id, i) => {
      const a = agentAngle(i);
      const bob = Math.sin(t * 1.1 + i * 1.7) * 0.08;
      dummy.position.set(Math.cos(a) * ORBIT_RADIUS, bob, Math.sin(a) * ORBIT_RADIUS);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(AGENT_HUES[id] ?? '#818cf8'));
    });
    if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  function focus(id: string): void {
    targetId = id;
    updateLinks();
  }
  function dispose(): void {
    (mesh.geometry as THREE.BufferGeometry).dispose();
    (mesh.material as THREE.Material).dispose();
    linkGeo.dispose();
  }
  return { group, update, focus, dispose };
}
