/**
 * Agents — orbiting specialists around one shared core (vanilla three).
 * Selecting an agent swings the ring so it faces the camera and
 * highlights its link into the core.
 */

import * as THREE from 'three';
import { agentHue, glowTexture, scenePalette } from '../scene-utils';

const ORBIT_RADIUS = 2.6;
const RING_TILT = 0.32;
/**
 * Angle for node `i` of `n` around the ring.
 *
 * `n` is a parameter, not a constant. This used to be hardcoded to 8, which
 * silently assumed the caller passed the full agent list: with the wrong
 * count the ring still spaced nodes by 1/8 turn, so the last gap was double
 * the others and left a visible hole in the orbit. Deriving it from the array
 * length means a wrong count degrades to even spacing instead of a broken ring.
 */
const agentAngle = (i: number, n: number): number => (i / Math.max(1, n)) * Math.PI * 2;

export function createAgentOrbit(
  theme: 'dark' | 'light',
  ids: string[],
): {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
  /**
   * Swing the ring so `id` faces the camera and light up its link into the
   * core. The swing itself is driven from `update`, easing `currentRotation`
   * toward the selected agent's angle.
   * lives in `update`, which eases `currentRotation` toward the selected
   * agent's angle, so this only records the target and repaints the links.
   */
  setSelected: (id: string) => void;
  /** Historical name for setSelected, kept so existing callers keep working. */
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
      blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
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
      const a = agentAngle(i, ids.length);
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
    const target = -agentAngle(idx, ids.length);
    let diff = target - currentRotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    currentRotation += diff * Math.min(1, dt * 4);
    ring.rotation.y = currentRotation;
    ids.forEach((id, i) => {
      const a = agentAngle(i, ids.length);
      const bob = Math.sin(t * 1.1 + i * 1.7) * 0.08;
      dummy.position.set(Math.cos(a) * ORBIT_RADIUS, bob, Math.sin(a) * ORBIT_RADIUS);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(agentHue(theme, id)));
    });
    if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  function setSelected(id: string): void {
    targetId = id;
    updateLinks();
  }
  function dispose(): void {
    group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        const mats = Array.isArray(mat) ? mat : [mat];
        mats.forEach((mt) => {
          const sm = mt as THREE.SpriteMaterial;
          sm.map?.dispose();
          mt.dispose();
        });
      }
    });
  }
  return { group, update, setSelected, focus: setSelected, dispose };
}
