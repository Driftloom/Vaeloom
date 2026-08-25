/**
 * CONNECTORS — sources feeding memory (vanilla three).
 * Six scoped source nodes on a ring stream particles through an
 * ingestion torus into the core. Slow, calm, readable.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, type SceneHandle } from './engine';
import { glowTexture, scenePalette } from '../scene-utils';

const RING_RADIUS = 3.1;
const SOURCES = ['#22d3ee', '#818cf8', '#e879f9', '#34d399', '#fbbf24', '#f87171'] as const;

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  density: number;
};

export function mountConnectorFlow({ container, theme, density }: Cfg): SceneHandle {
  const palette = scenePalette(theme);
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 2.6, 6.8);
  camera.lookAt(0, 0, 0);

  const ring = new THREE.Group();
  scene.add(ring);

  /* Ingestion torus + core */
  ring.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.02, 8, 96),
      new THREE.MeshBasicMaterial({ color: palette.structure, transparent: true, opacity: 0.5 }),
    ),
  );
  ring.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.008, 8, 96),
      new THREE.MeshBasicMaterial({ color: palette.structure, transparent: true, opacity: 0.25 }),
    ),
  );
  const coreHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowTexture(palette.core)),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  coreHalo.scale.setScalar(2.2);
  scene.add(coreHalo);
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 24),
      new THREE.MeshBasicMaterial({ color: palette.core }),
    ),
  );

  /* Source nodes + streams */
  const perSource = Math.round(34 * density);
  const nodeGeo = new THREE.OctahedronGeometry(0.17, 0);
  const streams = SOURCES.map((color, si) => {
    const angle = (si / SOURCES.length) * Math.PI * 2;
    const node = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color }));
    ring.add(node);

    const progress = new Float32Array(perSource);
    const seeds = new Float32Array(perSource);
    for (let i = 0; i < perSource; i++) {
      progress[i] = Math.random();
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(perSource * 3), 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.06,
        color,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    pts.frustumCulled = false;
    scene.add(pts);
    return { angle, color, node, geo, progress, seeds };
  });

  /* Link lines: source -> torus edge */
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(SOURCES.length * 6), 3),
  );
  const links = new THREE.LineSegments(
    linkGeo,
    new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: 0.6 }),
  );
  scene.add(links);

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      tick: (dt, t) => {
        ring.rotation.y = t * 0.1;
        coreHalo.material.opacity = 0.45 + Math.sin(t * 1.3) * 0.1;

        const linkPos = (linkGeo.getAttribute('position') as THREE.BufferAttribute)
          .array as Float32Array;
        streams.forEach((st, si) => {
          const a = st.angle + t * 0.1; // nodes ride the rotating ring
          const nx = Math.cos(a) * RING_RADIUS;
          const nz = Math.sin(a) * RING_RADIUS;
          st.node.position.set(nx, Math.sin(t * 1.2 + si * 1.4) * 0.12, nz);

          linkPos.set(
            [nx, st.node.position.y, nz, Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35],
            si * 6,
          );

          const attr = st.geo.getAttribute('position') as THREE.BufferAttribute;
          const arr = attr.array as Float32Array;
          for (let i = 0; i < perSource; i++) {
            let p = st.progress[i]! + dt * (0.35 + (i % 5) * 0.05);
            if (p > 1) p -= 1;
            st.progress[i] = p;
            const eased = Math.pow(p, 1.4);
            const r = RING_RADIUS + (0 - RING_RADIUS) * eased;
            arr[i * 3] = Math.cos(a) * r + Math.sin(st.seeds[i]!) * 0.14 * (1 - eased);
            arr[i * 3 + 2] = Math.sin(a) * r + Math.cos(st.seeds[i]!) * 0.14 * (1 - eased);
            arr[i * 3 + 1] = st.node.position.y * (1 - eased) + Math.sin(st.seeds[i]!) * 0.1;
          }
          attr.needsUpdate = true;
        });
        (linkGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      },
    },
    1.75,
  );

  return handle;
}
