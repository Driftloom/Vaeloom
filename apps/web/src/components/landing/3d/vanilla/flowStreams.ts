/**
 * Flow streams — subtle inbound "information flow" from the lower-left and
 * lower-right corners toward the central intelligence core, plus a small
 * outbound "processed output" subset.
 *
 * Implemented as a SINGLE THREE.Points + BufferGeometry (one draw call) reusing
 * the exact particle-field shader so the look stays consistent with the rest of
 * the hero. Only existing scenePalette colors are used. No new shells, rings,
 * glow systems, effects, UI, or layout changes.
 */

import * as THREE from 'three';
import { scenePalette } from '../scene-utils';

export type FlowStreamsHandle = {
  points: THREE.Points;
  update: (t: number, dt: number, reducedMotion: boolean) => void;
  dispose: () => void;
};

const OUT_RATIO = 0.36; // OUT count relative to IN_LEFT count
const IN_RIGHT_RATIO = 1.0; // right not reduced; left is the stronger inlet (see LEFT_BASE)
const OUT_START_R = 0.5;
const OUT_END_R = 3.0;

// corner spawn points (world space). The hero canvas is 130% tall and shifted
// up 15% (HeroSection), so the bottom ~15% of the frustum is below the fold —
// keep spawns inside the visible lower band (world y ~ -1.5) near the left/right
// edges so the streams read as on-screen corner inlets, not off-screen sources.
const SL = { x: -4.3, y: -1.6, z: -0.2 };
const SR = { x: 4.1, y: -1.3, z: 0.2 };

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// rotate (S->O) direction 90deg to get a perpendicular bow direction
function perpUnit(sx: number, sy: number): [number, number] {
  const dx = -sx;
  const dy = -sy;
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

export function createFlowStreams(theme: 'dark' | 'light', density: number): FlowStreamsHandle {
  const palette = scenePalette(theme);

  const cStream = new THREE.Color(palette.streamA);
  const cLink = new THREE.Color(palette.link ?? palette.structure);
  const cStruct = new THREE.Color(palette.structure);
  const cCore = new THREE.Color(palette.core);
  const cDust = new THREE.Color(palette.dust);

  const inLeft = Math.max(40, Math.round(170 * density));
  const inRight = Math.max(36, Math.round(110 * density * IN_RIGHT_RATIO));
  const outCount = Math.max(10, Math.round(inLeft * OUT_RATIO));
  const count = inLeft + inRight + outCount;

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  // per-particle static attributes (one-time allocation)
  const seed = new Float32Array(count);
  const speed = new Float32Array(count);
  const pathAmpX = new Float32Array(count); // perpendicular bow unit * amplitude (x)
  const pathAmpY = new Float32Array(count); // perpendicular bow unit * amplitude (y)
  const kFreq = new Float32Array(count);
  const phase = new Float32Array(count);
  const z0 = new Float32Array(count);
  const kZ = new Float32Array(count);
  const baseAlpha = new Float32Array(count);
  const prog = new Float32Array(count); // 0..1 progress along path
  const isOut = new Uint8Array(count);
  const odir = new Float32Array(count * 3); // outward direction for OUT

  function pickColor(i: number, weighted: 'in' | 'out') {
    const r = Math.random();
    let col: THREE.Color;
    if (weighted === 'out') {
      if (r > 0.7) col = cStream;
      else if (r > 0.4) col = cCore;
      else if (r > 0.15) col = cStruct;
      else col = cLink;
    } else {
      if (r > 0.72) col = cStream;
      else if (r > 0.58) col = cLink;
      else if (r > 0.42) col = cStruct;
      else col = cDust;
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const [plx, ply] = perpUnit(SL.x, SL.y);
  const [prx, pry] = perpUnit(SR.x, SR.y);

  let i = 0;
  // ---- IN_LEFT ----
  for (let n = 0; n < inLeft; n++, i++) {
    seed[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.15 + Math.random() * 0.15;
    const amp = 0.35 + Math.random() * 0.6;
    pathAmpX[i] = plx * amp;
    pathAmpY[i] = ply * amp;
    kFreq[i] = 1.6 + Math.random() * 2.0;
    phase[i] = Math.random() * Math.PI * 2;
    z0[i] = -1.6 + Math.random() * 3.2;
    kZ[i] = 1.0 + Math.random() * 1.5;
    baseAlpha[i] = 0.78 + Math.random() * 0.22;
    prog[i] = Math.random();
    isOut[i] = 0;
    pickColor(i, 'in');
    const sr = Math.random();
    sizes[i] = sr < 0.75 ? 0.07 + Math.random() * 0.03 : 0.1 + Math.random() * 0.03;
  }
  // ---- IN_RIGHT (slightly faster + phase-offset -> coordinated, not symmetric) ----
  for (let n = 0; n < inRight; n++, i++) {
    seed[i] = Math.random() * Math.PI * 2;
    speed[i] = (0.15 + Math.random() * 0.15) * 1.15;
    const amp = 0.35 + Math.random() * 0.6;
    pathAmpX[i] = prx * amp;
    pathAmpY[i] = pry * amp;
    kFreq[i] = 1.6 + Math.random() * 2.0;
    phase[i] = Math.random() * Math.PI * 2 + 0.7;
    z0[i] = -1.6 + Math.random() * 3.2;
    kZ[i] = 1.0 + Math.random() * 1.5;
    baseAlpha[i] = 0.6 + Math.random() * 0.3;
    prog[i] = Math.random();
    isOut[i] = 0;
    pickColor(i, 'in');
    const sr = Math.random();
    sizes[i] = sr < 0.75 ? 0.05 + Math.random() * 0.025 : 0.08 + Math.random() * 0.025;
  }
  // ---- OUT (processed output leaves subtly) ----
  for (let n = 0; n < outCount; n++, i++) {
    seed[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.12 + Math.random() * 0.12;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const x = Math.sin(ph) * Math.cos(th);
    const y = Math.cos(ph) * 0.6; // bias toward a horizontal band
    const z = Math.sin(ph) * Math.sin(th);
    const len = Math.hypot(x, y, z) || 1;
    odir[i * 3] = x / len;
    odir[i * 3 + 1] = y / len;
    odir[i * 3 + 2] = z / len;
    phase[i] = 0;
    z0[i] = 0;
    kZ[i] = 0;
    baseAlpha[i] = 0.3 + Math.random() * 0.2;
    prog[i] = Math.random();
    isOut[i] = 1;
    pickColor(i, 'out');
    sizes[i] = 0.03 + Math.random() * 0.014;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: theme === 'light' ? 0.7 : 0.85 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute vec3 aColor;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vAlpha = aAlpha;
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (190.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;
      uniform float uOpacity;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float edge = smoothstep(0.5, 0.18, d);
        gl_FragColor = vec4(vColor, vAlpha * edge * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const posArr = geo.getAttribute('position') as THREE.BufferAttribute;
  const alphaArr = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
  const posData = posArr.array as Float32Array;
  const alphaData = alphaArr.array as Float32Array;

  return {
    points,
    update: (t, dt, reducedMotion) => {
      void t;
      const motion = reducedMotion ? 0.18 : 1;
      const d = Math.min(dt, 0.05);

      for (let i = 0; i < count; i++) {
        if (isOut[i]) {
          const np = (prog[i]! + speed[i]! * motion * d) % 1;
          prog[i] = np;
          const r = OUT_START_R + np * (OUT_END_R - OUT_START_R);
          posData[i * 3] = odir[i * 3]! * r;
          posData[i * 3 + 1] = odir[i * 3 + 1]! * r;
          posData[i * 3 + 2] = odir[i * 3 + 2]! * r;
          alphaData[i] = baseAlpha[i]! * smoothstep(0, 0.15, np) * (1 - smoothstep(0.75, 1.0, np));
        } else {
          const np = (prog[i]! + speed[i]! * motion * d) % 1;
          prog[i] = np;
          // ease-in toward core (accelerate inward)
          const e = np * np;
          const sx = i < inLeft ? SL.x : SR.x;
          const sy = i < inLeft ? SL.y : SR.y;
          const sz = i < inLeft ? SL.z : SR.z;
          const bx = sx + (0 - sx) * e;
          const by = sy + (0 - sy) * e;
          const bz = sz + (0 - sz) * e;
          // lateral bow shrinks to 0 as it nears the core -> trajectories tighten
          const lateral = Math.sin(kFreq[i]! * np + phase[i]!) * (1 - np);
          const z = z0[i]! + 0.25 * Math.sin(kZ[i]! * np + phase[i]!);
          posData[i * 3] = bx + pathAmpX[i]! * lateral;
          posData[i * 3 + 1] = by + pathAmpY[i]! * lateral;
          posData[i * 3 + 2] = bz + z;
          // Visible from the corner along the whole path, merging only into
          // the core glow at the very end (reads as a directed inbound streak).
          alphaData[i] = baseAlpha[i]! * smoothstep(0, 0.03, np) * (1 - smoothstep(0.82, 1.0, np));
        }
      }

      posArr.needsUpdate = true;
      alphaArr.needsUpdate = true;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
