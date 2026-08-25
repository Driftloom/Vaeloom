/**
 * Hero — living memory core (vanilla three).
 * Connector data streams converge into a breathing crystalline core.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, type SceneHandle } from './engine';
import { glowTexture, scenePalette } from '../scene-utils';

const STREAM_RADIUS = 5.2;
const CORE_RADIUS = 0.85;

const STREAMS = [
  { angle: -0.5, tilt: 0.35, color: '#22d3ee' },
  { angle: 0.65, tilt: -0.25, color: '#818cf8' },
  { angle: 2.1, tilt: 0.2, color: '#e879f9' },
  { angle: 3.6, tilt: -0.35, color: '#22d3ee' },
  { angle: 4.9, tilt: 0.28, color: '#818cf8' },
] as const;

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  density: number;
  /** false -> calm variant (core + motes only, used behind the final CTA) */
  streams?: boolean;
};

export function mountMemoryCore({ container, theme, density, streams = true }: Cfg): SceneHandle {
  const palette = scenePalette(theme);
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 0.6, 7.4);

  /* Core ---------------------------------------------------------------- */
  const haloTex = new THREE.CanvasTexture(glowTexture(palette.core));
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.setScalar(4.4);
  scene.add(halo);

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(CORE_RADIUS, 1),
    new THREE.MeshBasicMaterial({
      color: palette.core,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    }),
  );
  scene.add(shell);

  const latticeGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(CORE_RADIUS, 2));
  const lattice = new THREE.LineSegments(
    latticeGeo,
    new THREE.LineBasicMaterial({ color: palette.structure, transparent: true, opacity: 0.28 }),
  );
  lattice.scale.setScalar(1.45);
  scene.add(lattice);

  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(CORE_RADIUS * 0.42, 24, 24),
    new THREE.MeshBasicMaterial({ color: palette.core, transparent: true, opacity: 0.9 }),
  );
  scene.add(inner);

  /* Motes --------------------------------------------------------------- */
  const moteCount = Math.round(220 * density);
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const r = CORE_RADIUS + 1.1 + Math.random() * 1.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    motePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    motePos[i * 3 + 1] = r * Math.cos(phi) * 0.7;
    motePos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      size: 0.05,
      color: palette.dust,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
  motes.frustumCulled = false;
  scene.add(motes);

  /* Streams ------------------------------------------------------------- */
  const streamCount = Math.round(110 * density);
  const streamsList = streams
    ? STREAMS.map((cfg) => {
        const progress = new Float32Array(streamCount);
        const seeds = new Float32Array(streamCount);
        for (let i = 0; i < streamCount; i++) {
          progress[i] = Math.random() * STREAM_RADIUS;
          seeds[i] = Math.random() * Math.PI * 2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(streamCount * 3), 3),
        );
        const pts = new THREE.Points(
          geo,
          new THREE.PointsMaterial({
            size: 0.07,
            color: cfg.color,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        pts.frustumCulled = false;
        scene.add(pts);
        return { cfg, geo, progress, seeds };
      })
    : [];

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      cameraZ: 7.4,
      tick: (dt, t) => {
        // gentle camera drift
        camera.position.x = Math.sin(t * 0.08) * 0.35;
        camera.position.y = 0.15 + Math.sin(t * 0.06) * 0.12;
        camera.lookAt(0, 0, 0);

        shell.rotation.y = t * 0.12;
        shell.rotation.x = Math.sin(t * 0.1) * 0.18;
        const s = 1 + Math.sin(t * 1.4) * 0.06;
        inner.scale.setScalar(s);
        (halo.material as THREE.SpriteMaterial).opacity = 0.5 + Math.sin(t * 1.4) * 0.12;

        motes.rotation.y += dt * 0.07;

        for (const st of streamsList) {
          const attr = st.geo.getAttribute('position') as THREE.BufferAttribute;
          const arr = attr.array as Float32Array;
          for (let i = 0; i < streamCount; i++) {
            let p = st.progress[i]! + dt * (1.4 + (i % 7) * 0.18);
            if (p > STREAM_RADIUS) p -= STREAM_RADIUS;
            st.progress[i] = p;
            const eased = Math.pow(p / STREAM_RADIUS, 1.6);
            const r = STREAM_RADIUS * (1 - eased);
            const wobble = 0.55 * eased;
            const a = st.cfg.angle + Math.sin(st.seeds[i]!) * 0.12;
            arr[i * 3] = Math.cos(a) * r + Math.sin(st.seeds[i]!) * wobble;
            arr[i * 3 + 2] = Math.sin(a) * r + Math.cos(st.seeds[i]!) * wobble;
            arr[i * 3 + 1] =
              Math.sin(st.cfg.tilt + a) * r * 0.4 + Math.cos(st.seeds[i]!) * wobble * 0.5;
          }
          attr.needsUpdate = true;
        }
      },
    },
    theme === 'light' ? 1.75 : 1.75,
  );
  return handle;
}
