/**
 * Volumetric particle field for the hero "living intelligence" environment.
 *
 * Particles are distributed through a BOX volume (not spherical shells) so they
 * exist in front of, behind, above, below and around the core — filling the
 * whole viewport with real 3D depth. Each particle has one of several motion
 * behaviors, all driven by a shared procedural time so the field feels like
 * ONE organism rather than independent star fields.
 *
 * Single THREE.Points + BufferGeometry (no per-particle React state).
 */

import * as THREE from 'three';
import { scenePalette } from '../scene-utils';

export type ParticleFieldHandle = {
  points: THREE.Points;
  update: (t: number, dt: number, mouseX: number, mouseY: number, reducedMotion: boolean) => void;
  dispose: () => void;
};

// behavior types
const T_DRIFT = 0;
const T_ATTRACT = 1;
const T_EMIT = 2;
const T_ORBIT = 3;
const T_FLYBY = 4;

const BOX = { x: 13, y: 9, zBack: 11, zFront: 8 };

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createParticleField(theme: 'dark' | 'light', density: number): ParticleFieldHandle {
  const palette = scenePalette(theme);
  const baseCount = 2600;
  const count = Math.max(400, Math.round(baseCount * density));

  const positions = new Float32Array(count * 3); // final (with parallax)
  const base = new Float32Array(count * 3); // simulated positions
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const ptype = new Uint8Array(count);
  const pseed = new Float32Array(count);
  const pspeed = new Float32Array(count);
  const pdir = new Float32Array(count * 3); // unit dir for attract/emit/flyby
  const pradius = new Float32Array(count); // orbital / spawn radius
  const pangle = new Float32Array(count); // orbital angle
  const ptilt = new Float32Array(count); // orbital tilt

  const cDust = new THREE.Color(palette.dust);
  const cStream = new THREE.Color(palette.streamA);
  const cStruct = new THREE.Color(palette.structure);
  const cLink = new THREE.Color(palette.link ?? palette.structure);

  function respawnShell(i: number, rMin: number, rMax: number) {
    const r = rand(rMin, rMax);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(ph) * Math.cos(th);
    const y = r * Math.cos(ph) * 0.72;
    const z = r * Math.sin(ph) * Math.sin(th);
    base[i * 3] = x;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = z;
    const len = Math.hypot(x, y, z) || 1;
    pdir[i * 3] = x / len;
    pdir[i * 3 + 1] = y / len;
    pdir[i * 3 + 2] = z / len;
  }

  for (let i = 0; i < count; i++) {
    pseed[i] = Math.random() * Math.PI * 2;
    pspeed[i] = rand(0.5, 1.5);

    // weighted behavior selection
    const r = Math.random();
    let type: number;
    if (r < 0.45) type = T_DRIFT;
    else if (r < 0.6) type = T_ATTRACT;
    else if (r < 0.72) type = T_EMIT;
    else if (r < 0.85) type = T_ORBIT;
    else type = T_FLYBY;
    ptype[i] = type;

    if (type === T_FLYBY) {
      base[i * 3] = rand(-8, 8);
      base[i * 3 + 1] = rand(-5, 5);
      base[i * 3 + 2] = rand(-BOX.zBack, BOX.zFront);
      pdir[i * 3] = rand(-0.15, 0.15);
      pdir[i * 3 + 1] = rand(-0.1, 0.1);
      pdir[i * 3 + 2] = 1;
    } else if (type === T_ATTRACT) {
      respawnShell(i, 3.5, 7.5);
    } else if (type === T_EMIT) {
      const rr = rand(0.9, 1.5);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const x = rr * Math.sin(ph) * Math.cos(th);
      const y = rr * Math.cos(ph) * 0.72;
      const z = rr * Math.sin(ph) * Math.sin(th);
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      const len = Math.hypot(x, y, z) || 1;
      pdir[i * 3] = x / len;
      pdir[i * 3 + 1] = y / len;
      pdir[i * 3 + 2] = z / len;
    } else if (type === T_ORBIT) {
      pradius[i] = rand(1.6, 5.2);
      pangle[i] = Math.random() * Math.PI * 2;
      ptilt[i] = rand(-0.6, 0.6);
    } else {
      // drift — fill the whole box
      base[i * 3] = rand(-BOX.x, BOX.x);
      base[i * 3 + 1] = rand(-BOX.y, BOX.y);
      base[i * 3 + 2] = rand(-BOX.zBack, BOX.zFront);
    }

    // color: mostly dust, some accent variety (brand palette only)
    const cr = Math.random();
    let col = cDust;
    if (cr > 0.9) col = cStream;
    else if (cr > 0.78) col = cLink;
    else if (cr > 0.66) col = cStruct;
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;

    // size distribution (70/20/8/2)
    const sr = Math.random();
    let s: number;
    if (sr < 0.7) s = 0.03 + Math.random() * 0.014;
    else if (sr < 0.9) s = 0.05 + Math.random() * 0.016;
    else if (sr < 0.98) s = 0.08 + Math.random() * 0.016;
    else s = 0.11 + Math.random() * 0.02;
    if (type === T_FLYBY) s *= 1.15; // foreground slightly brighter/larger
    sizes[i] = s;
    alphas[i] = type === T_FLYBY ? 0.55 : 0.42 + Math.random() * 0.18;
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
    update: (t, dt, mouseX, mouseY, reducedMotion) => {
      const rm = reducedMotion;
      const motion = rm ? 0.18 : 1;
      const useMouse = rm ? 0 : 1;
      const d = Math.min(dt, 0.05);

      for (let i = 0; i < count; i++) {
        const type = ptype[i]!;
        const sp = pspeed[i]!;

        if (type === T_DRIFT) {
          const sd = pseed[i]!;
          base[i * 3] = base[i * 3]! + Math.sin(t * 0.3 + sd) * 0.0035 * sp * motion;
          base[i * 3 + 1] = base[i * 3 + 1]! + Math.cos(t * 0.25 + sd) * 0.0035 * sp * motion;
          base[i * 3 + 2] = base[i * 3 + 2]! + Math.sin(t * 0.2 + sd * 1.3) * 0.0035 * sp * motion;
          if (base[i * 3]! > BOX.x) base[i * 3] = -BOX.x;
          else if (base[i * 3]! < -BOX.x) base[i * 3] = BOX.x;
          if (base[i * 3 + 1]! > BOX.y) base[i * 3 + 1] = -BOX.y;
          else if (base[i * 3 + 1]! < -BOX.y) base[i * 3 + 1] = BOX.y;
          if (base[i * 3 + 2]! > BOX.zFront) base[i * 3 + 2] = -BOX.zBack;
          else if (base[i * 3 + 2]! < -BOX.zBack) base[i * 3 + 2] = BOX.zFront;
          alphaData[i] = alphas[i]!;
        } else if (type === T_ATTRACT) {
          const x = base[i * 3]!;
          const y = base[i * 3 + 1]!;
          const z = base[i * 3 + 2]!;
          const len = Math.hypot(x, y, z) || 1;
          const step = (0.012 + 0.006 * Math.sin(t * 0.5 + pseed[i]!)) * sp * motion;
          base[i * 3] = x - (x / len) * step;
          base[i * 3 + 1] = y - (y / len) * step;
          base[i * 3 + 2] = z - (z / len) * step;
          if (len < 0.95) respawnShell(i, 3.5, 7.5);
          alphaData[i] = Math.min(0.6, len * 0.1);
        } else if (type === T_EMIT) {
          const x = base[i * 3]!;
          const y = base[i * 3 + 1]!;
          const z = base[i * 3 + 2]!;
          const len = Math.hypot(x, y, z) || 1;
          const step = (0.01 + 0.005 * Math.sin(t * 0.4 + pseed[i]!)) * sp * motion;
          base[i * 3] = x + (x / len) * step;
          base[i * 3 + 1] = y + (y / len) * step;
          base[i * 3 + 2] = z + (z / len) * step;
          if (len > 6.5) {
            const rr = rand(0.9, 1.4);
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            base[i * 3] = rr * Math.sin(ph) * Math.cos(th);
            base[i * 3 + 1] = rr * Math.cos(ph) * 0.72;
            base[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
          }
          const fadeIn = Math.min(1, (len - 0.9) / 0.8);
          const fadeOut = 1 - Math.min(1, Math.max(0, (len - 5) / 1.5));
          alphaData[i] = Math.min(0.6, 0.5 * fadeIn * fadeOut + 0.08);
        } else if (type === T_ORBIT) {
          const ang = pangle[i]! + t * 0.18 * sp * motion;
          const rad = pradius[i]!;
          const tilt = ptilt[i]!;
          base[i * 3] = Math.cos(ang) * rad;
          base[i * 3 + 2] = Math.sin(ang) * rad;
          base[i * 3 + 1] = Math.sin(ang) * rad * tilt;
          alphaData[i] = alphas[i]!;
        } else {
          // FLYBY — travel toward the camera (+Z), respawn far back
          base[i * 3] = base[i * 3]! + pdir[i * 3]! * 0.01 * motion;
          base[i * 3 + 1] = base[i * 3 + 1]! + pdir[i * 3 + 1]! * 0.01 * motion;
          base[i * 3 + 2] =
            base[i * 3 + 2]! + (0.9 + 0.4 * Math.sin(t * 0.3 + pseed[i]!)) * sp * d * motion;
          if (base[i * 3 + 2]! > BOX.zFront) {
            base[i * 3] = rand(-8, 8);
            base[i * 3 + 1] = rand(-5, 5);
            base[i * 3 + 2] = -BOX.zBack;
          }
          alphaData[i] = 0.3 + Math.min(0.5, Math.max(0, (base[i * 3 + 2]! + 2) / 12));
        }

        // parallax: near particles move more with the mouse than far ones
        const z = base[i * 3 + 2]!;
        const par = useMouse * (((z + BOX.zBack) / (BOX.zBack + BOX.zFront)) * 0.9 + 0.1);
        posData[i * 3] = base[i * 3]! + mouseX * 0.9 * par;
        posData[i * 3 + 1] = base[i * 3 + 1]! + mouseY * 0.7 * par;
        posData[i * 3 + 2] = z;
      }

      posArr.needsUpdate = true;
      alphaArr.needsUpdate = true;
    },
    dispose: () => {
      geo.dispose();
      (mat as THREE.ShaderMaterial).dispose();
    },
  };
}
