/**
 * Bidirectional data streams for the hero core.
 *
 * INWARD streams: connector data converging into the core (existing look).
 * OUTWARD streams: processed information radiated back out (new).
 *
 * Both share the coordinated time system from memoryCoreScene so emission
 * appears to "answer" absorption. Occasional per-point acceleration gives the
 * feeling of intelligent bursts without obvious repetition.
 */

import * as THREE from 'three';
import { scenePalette } from '../scene-utils';

export type StreamsHandle = {
  objects: THREE.Object3D[];
  update: (t: number, dt: number, reducedMotion: boolean) => void;
  dispose: () => void;
};

type Dir = 'in' | 'out';

const STREAM_RADIUS = 5.2;

export function createStreams(
  theme: 'dark' | 'light',
  density: number,
  opts: { outward?: boolean } = {},
): StreamsHandle {
  const palette = scenePalette(theme);
  // brand accents, theme-adaptive (cyan streamA, indigo core, pink link)
  const INWARD = [
    { angle: -0.5, tilt: 0.35, color: palette.streamA },
    { angle: 0.65, tilt: -0.25, color: palette.core },
    { angle: 1.4, tilt: -0.18, color: palette.structure },
    { angle: 2.1, tilt: 0.2, color: palette.link ?? palette.structure },
    { angle: 4.71, tilt: 0, color: palette.streamA },
    { angle: 4.9, tilt: 0.28, color: palette.core },
    { angle: 5.6, tilt: 0.22, color: palette.structure },
    { angle: 3.2, tilt: -0.32, color: palette.streamA },
  ];

  const OUTWARD = [
    { angle: 0.2, tilt: 0.4, color: palette.streamA },
    { angle: 1.9, tilt: -0.3, color: palette.core },
    { angle: 3.7, tilt: 0.25, color: palette.link ?? palette.structure },
    { angle: 5.2, tilt: -0.15, color: palette.structure },
  ];

  const perStream = Math.round(180 * density);

  const objects: THREE.Object3D[] = [];

  type Stream = {
    cfg: { angle: number; tilt: number; color: string };
    dir: Dir;
    geo: THREE.BufferGeometry;
    progress: Float32Array;
    seeds: Float32Array;
    mat: THREE.PointsMaterial;
  };
  const streams: Stream[] = [];

  const builder = (
    list: ReadonlyArray<{ angle: number; tilt: number; color: string }>,
    dir: Dir,
  ) => {
    list.forEach((cfg) => {
      const progress = new Float32Array(perStream);
      const seeds = new Float32Array(perStream);
      for (let i = 0; i < perStream; i++) {
        progress[i] = Math.random() * STREAM_RADIUS;
        seeds[i] = Math.random() * Math.PI * 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(perStream * 3), 3));
      const mat = new THREE.PointsMaterial({
        size: 0.045,
        color: cfg.color,
        transparent: true,
        opacity: 0.95,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      objects.push(pts);
      streams.push({ cfg: { ...cfg }, dir, geo, progress, seeds, mat });
    });
  };

  builder(INWARD, 'in');
  if (opts.outward) builder(OUTWARD, 'out');

  return {
    objects,
    update: (t, dt, reducedMotion) => {
      const d = Math.min(dt, 0.05);
      const burst = reducedMotion ? 0 : 1;
      for (const st of streams) {
        const attr = st.geo.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < perStream; i++) {
          // occasional acceleration pulse (not synchronized)
          const accel = 1 + burst * 0.5 * Math.sin(t * 0.3 + st.seeds[i]!);
          let p = st.progress[i]! + d * (1.4 + (i % 7) * 0.18) * accel;
          if (p > STREAM_RADIUS) p -= STREAM_RADIUS;
          st.progress[i] = p;

          const a = st.cfg.angle + Math.sin(st.seeds[i]!) * 0.12;
          const wobble = 0.55 * (p / STREAM_RADIUS);

          let r: number;
          if (st.dir === 'in') {
            const eased = Math.pow(p / STREAM_RADIUS, 1.6);
            r = STREAM_RADIUS * (1 - eased);
          } else {
            // outward: start near core, travel to the rim
            const eased = Math.pow(p / STREAM_RADIUS, 1.4);
            r = 0.9 + (STREAM_RADIUS - 0.9) * eased;
          }
          arr[i * 3] = Math.cos(a) * r + Math.sin(st.seeds[i]!) * wobble;
          arr[i * 3 + 2] = Math.sin(a) * r + Math.cos(st.seeds[i]!) * wobble;
          arr[i * 3 + 1] =
            Math.sin(st.cfg.tilt + a) * r * 0.4 + Math.cos(st.seeds[i]!) * wobble * 0.5;
        }
        attr.needsUpdate = true;
      }
    },
    dispose: () => {
      for (const st of streams) {
        st.geo.dispose();
        st.mat.dispose();
      }
    },
  };
}
