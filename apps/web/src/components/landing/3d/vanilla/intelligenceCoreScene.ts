/**
 * Plasma Intelligence Core — the upgraded center.
 *
 * Visual language: a white-hot plasma sphere wrapped in a tangle of
 * luminous energy filaments, circled by irregular energy wisps, with
 * particle streaks radiating in and out. Layered additive glow sprites
 * fake bloom without post-processing.
 *
 * Deliberately removed vs the previous version: wireframe icosahedra,
 * transmission shells, edge veils and flat elliptical rings — they read
 * as mechanical geometry, not living energy.
 *
 * All motion is driven by ONE accumulated clock (coordinated, never
 * synchronized) so the system reads as a single organism.
 */

import * as THREE from 'three';
import { glowTextureStops, mulberry32, scenePalette } from '../scene-utils';

export type CoreHandle = {
  group: THREE.Group;
  update: (t: number, dt: number, opts: { reducedMotion: boolean }) => void;
  dispose: () => void;
};

const FILAMENT_LOOPS = 56;
const FILAMENT_SEGS = 72;
const WISP_ARCS = 6;
const WISP_PTS = 72;
const STREAK_COUNT = 220;
const INNER_COUNT = 140;
const AMBIENT_COUNT = 60;

export function createIntelligenceCore(
  theme: 'dark' | 'light',
  opts: { reducedMotion?: boolean } = {},
): CoreHandle {
  const palette = scenePalette(theme);
  const light = theme === 'light';
  const group = new THREE.Group();
  const rand = mulberry32(20260826);

  const cCore = new THREE.Color(light ? '#6366f1' : palette.core);
  const cHot = new THREE.Color('#ffffff');
  const cStream = new THREE.Color(palette.streamA);
  const cLink = new THREE.Color(palette.link);
  const cStruct = new THREE.Color(palette.structure);

  const blend = light ? THREE.NormalBlending : THREE.AdditiveBlending;

  /* ---------------------------------------------------------------- */
  /* Layer A — plasma core: white-hot center, indigo rim, noise flow   */
  /* ---------------------------------------------------------------- */
  const coreGeo = new THREE.SphereGeometry(0.34, 48, 48);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: cCore },
      uHot: { value: cHot },
      uOpacity: { value: light ? 0.68 : 0.9 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        p += normal * 0.022 * sin(position.x * 7.0 + uTime * 1.3) * cos(position.y * 5.0 + uTime * 0.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uHot;
      uniform float uOpacity;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float n = sin(vPos.x * 4.0 + uTime * 0.7) * 0.5
                + cos(vPos.y * 5.0 - uTime * 0.6) * 0.5
                + sin(vPos.z * 3.0 + uTime * 0.5) * 0.5;
        float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
        float center = pow(facing, 1.8);
        float rim = pow(1.0 - facing, 2.2);
        float flow = sin(vPos.x * 6.0 + uTime * 1.5)
                   * sin(vPos.y * 5.0 - uTime * 1.1)
                   * sin(vPos.z * 4.0 + uTime * 0.9);
        vec3 col = uHot * center * (0.8 + 0.3 * n);
        col += uColor * (rim * 1.15 + 0.32);
        col += uColor * 0.22 * flow;
        float a = uOpacity * (0.5 + center * 0.5 + rim * 0.35);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: blend,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  /* ---------------------------------------------------------------- */
  /* Internal computation points — energy moving inside the core       */
  /* ---------------------------------------------------------------- */
  const innerPos = new Float32Array(INNER_COUNT * 3);
  const innerVel = new Float32Array(INNER_COUNT * 3);
  for (let i = 0; i < INNER_COUNT; i++) {
    const r = Math.random() * 0.3;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    innerPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    innerPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    innerPos[i * 3 + 2] = r * Math.cos(ph);
    innerVel[i * 3] = (Math.random() - 0.5) * 0.008;
    innerVel[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
    innerVel[i * 3 + 2] = (Math.random() - 0.5) * 0.008;
  }
  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute('position', new THREE.BufferAttribute(innerPos, 3));
  const innerMat = new THREE.PointsMaterial({
    size: 0.02,
    color: light ? palette.core : palette.edgeHot,
    transparent: true,
    opacity: light ? 0.5 : 0.75,
    sizeAttenuation: true,
    depthWrite: false,
    blending: blend,
  });
  const innerPoints = new THREE.Points(innerGeo, innerMat);
  group.add(innerPoints);

  /* ---------------------------------------------------------------- */
  /* Filament tangle — the signature: dozens of luminous loops         */
  /* hugging the sphere, pulses of energy traveling along each strand  */
  /* ---------------------------------------------------------------- */
  const fPos: number[] = [];
  const fT: number[] = [];
  const fSeed: number[] = [];
  const fBright: number[] = [];
  for (let l = 0; l < FILAMENT_LOOPS; l++) {
    const seed = rand() * Math.PI * 2;
    const ax = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (ax.lengthSq() < 0.01) ax.set(0, 1, 0);
    ax.normalize();
    const u = new THREE.Vector3(0, 1, 0).cross(ax);
    if (u.lengthSq() < 0.01) u.set(1, 0, 0);
    u.normalize();
    const v = new THREE.Vector3().crossVectors(ax, u).normalize();

    const r0 = 0.42 + rand() * 0.62;
    const phase = rand() * Math.PI * 2;
    const phase2 = rand() * Math.PI * 2;
    const wob = 0.08 + rand() * 0.16;
    const bright = 0.5 + rand() * 0.5;

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < FILAMENT_SEGS; i++) {
      const th = (i / FILAMENT_SEGS) * Math.PI * 2;
      const r = r0 * (1 + wob * Math.sin(th * 2 + phase) + wob * 0.5 * Math.sin(th * 3 - phase2));
      pts.push(
        new THREE.Vector3()
          .addScaledVector(u, Math.cos(th) * r)
          .addScaledVector(v, Math.sin(th) * r)
          .addScaledVector(ax, Math.sin(th * 2 + phase) * r0 * 0.16),
      );
    }
    for (let i = 0; i < FILAMENT_SEGS; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % FILAMENT_SEGS]!;
      fPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      fT.push(i / FILAMENT_SEGS, (i + 1) / FILAMENT_SEGS);
      fSeed.push(seed, seed);
      fBright.push(bright, bright);
    }
  }
  const filGeo = new THREE.BufferGeometry();
  filGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  filGeo.setAttribute('aT', new THREE.Float32BufferAttribute(fT, 1));
  filGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(fSeed, 1));
  filGeo.setAttribute('aBright', new THREE.Float32BufferAttribute(fBright, 1));
  const filMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: cCore },
      uHot: { value: cHot },
      uOpacity: { value: light ? 0.42 : 0.8 },
    },
    vertexShader: `
      attribute float aT;
      attribute float aSeed;
      attribute float aBright;
      varying float vT;
      varying float vSeed;
      varying float vBright;
      void main() {
        vT = aT;
        vSeed = aSeed;
        vBright = aBright;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uHot;
      uniform float uOpacity;
      varying float vT;
      varying float vSeed;
      varying float vBright;
      void main() {
        float pulse = 0.5 + 0.5 * sin(vT * 12.566 + uTime * (0.55 + fract(vSeed) * 0.75) + vSeed * 17.0);
        pulse = pow(pulse, 3.0);
        float flicker = 0.78 + 0.22 * sin(uTime * 1.6 + vSeed * 31.0);
        vec3 col = mix(uColor, uHot, pulse * 0.6);
        float a = uOpacity * vBright * flicker * (0.22 + pulse * 0.9);
        gl_FragColor = vec4(col * (0.8 + pulse * 0.7), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: blend,
  });
  const filaments = new THREE.LineSegments(filGeo, filMat);
  filaments.frustumCulled = false;
  group.add(filaments);

  /* ---------------------------------------------------------------- */
  /* Layered glow sprites — fake bloom (hot / mid / wide)              */
  /* ---------------------------------------------------------------- */
  const hotTex = glowTextureStops(palette.core, light ? '#eef2ff' : '#ffffff');
  const midTex = glowTextureStops(palette.core);
  const outerTex = glowTextureStops(light ? palette.core : palette.structure);

  const mkGlow = (
    tex: HTMLCanvasElement,
    scale: number,
    opacity: number,
  ): {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    baseScale: number;
    baseOpacity: number;
  } => {
    const mat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(tex),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: blend,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(scale);
    group.add(sprite);
    return { sprite, mat, baseScale: scale, baseOpacity: opacity };
  };
  const glowHot = mkGlow(hotTex, 1.7, light ? 0.65 : 0.95);
  const glowMid = mkGlow(midTex, 3.6, light ? 0.35 : 0.5);
  const glowOuter = mkGlow(outerTex, 7.2, light ? 0.18 : 0.22);

  /* ---------------------------------------------------------------- */
  /* Energy wisps — irregular tapered arcs replacing the flat rings    */
  /* ---------------------------------------------------------------- */
  const wPos: number[] = [];
  const wT: number[] = [];
  const wSeed: number[] = [];
  const wBright: number[] = [];
  const wColor: number[] = [];
  const wispPalette = [cCore, cStream, cLink, cStruct];
  for (let k = 0; k < WISP_ARCS; k++) {
    const radius = 1.35 + rand() * 1.3;
    const ry = radius * (0.72 + rand() * 0.4);
    const span = Math.PI * (0.75 + rand() * 0.8);
    const start = rand() * Math.PI * 2;
    const euler = new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    const col = wispPalette[Math.floor(rand() * wispPalette.length)] ?? cCore;
    const bright = 0.5 + rand() * 0.5;
    const seed = rand() * Math.PI * 2;

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < WISP_PTS; i++) {
      const a = start + (i / (WISP_PTS - 1)) * span;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * ry, 0).applyEuler(euler));
    }
    for (let i = 0; i < WISP_PTS - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      wPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const t0 = i / (WISP_PTS - 1);
      const t1 = (i + 1) / (WISP_PTS - 1);
      wT.push(t0, t1);
      wSeed.push(seed, seed);
      wBright.push(bright, bright);
      wColor.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
  }
  const wispGeo = new THREE.BufferGeometry();
  wispGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  wispGeo.setAttribute('aT', new THREE.Float32BufferAttribute(wT, 1));
  wispGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(wSeed, 1));
  wispGeo.setAttribute('aBright', new THREE.Float32BufferAttribute(wBright, 1));
  wispGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(wColor, 3));
  const wispMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: light ? 0.45 : 0.7 },
    },
    vertexShader: `
      attribute float aT;
      attribute float aSeed;
      attribute float aBright;
      attribute vec3 aColor;
      varying float vT;
      varying float vSeed;
      varying float vBright;
      varying vec3 vColor;
      void main() {
        vT = aT;
        vSeed = aSeed;
        vBright = aBright;
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying float vT;
      varying float vSeed;
      varying float vBright;
      varying vec3 vColor;
      void main() {
        float endFade = smoothstep(0.0, 0.16, vT) * (1.0 - smoothstep(0.84, 1.0, vT));
        float pulse = 0.5 + 0.5 * sin(vT * 9.42 + uTime * (0.5 + fract(vSeed) * 0.6) + vSeed * 13.0);
        pulse = pow(pulse, 3.0);
        float a = uOpacity * vBright * endFade * (0.25 + pulse * 0.95);
        gl_FragColor = vec4(vColor * (0.85 + pulse * 0.6), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: blend,
  });
  const wisps = new THREE.LineSegments(wispGeo, wispMat);
  wisps.frustumCulled = false;
  group.add(wisps);

  /* ---------------------------------------------------------------- */
  /* Streaks — short energy dashes radiating in/out of the core        */
  /* ---------------------------------------------------------------- */
  const streakPos = new Float32Array(STREAK_COUNT * 2 * 3);
  const streakAlpha = new Float32Array(STREAK_COUNT * 2);
  const streakColor = new Float32Array(STREAK_COUNT * 2 * 3);
  type Streak = {
    dir: THREE.Vector3;
    r: number;
    speed: number;
    sign: number;
    len: number;
  };
  const streaks: Streak[] = [];

  const spawnStreak = (st: Streak, initial: boolean): void => {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    st.dir.set(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)).normalize();
    st.sign = Math.random() < 0.55 ? 1 : -1;
    st.r = initial ? 0.7 + Math.random() * 2.0 : st.sign > 0 ? 0.62 : 2.7;
    st.speed = 0.3 + Math.random() * 0.55;
    st.len = 0.14 + Math.random() * 0.26;
  };
  for (let i = 0; i < STREAK_COUNT; i++) {
    const st: Streak = {
      dir: new THREE.Vector3(),
      r: 1,
      speed: 0.4,
      sign: 1,
      len: 0.2,
    };
    spawnStreak(st, true);
    streaks.push(st);
    const cr = Math.random();
    const col = cr < 0.6 ? cCore : cr < 0.85 ? cStream : cLink;
    streakColor[i * 6] = col.r;
    streakColor[i * 6 + 1] = col.g;
    streakColor[i * 6 + 2] = col.b;
    streakColor[i * 6 + 3] = col.r;
    streakColor[i * 6 + 4] = col.g;
    streakColor[i * 6 + 5] = col.b;
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  streakGeo.setAttribute('aAlpha', new THREE.BufferAttribute(streakAlpha, 1));
  streakGeo.setAttribute('aColor', new THREE.BufferAttribute(streakColor, 3));
  const streakMat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: light ? 0.5 : 0.85 },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute vec3 aColor;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vAlpha = aAlpha;
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, vAlpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: blend,
  });
  const streakLines = new THREE.LineSegments(streakGeo, streakMat);
  streakLines.frustumCulled = false;
  group.add(streakLines);

  /* ---------------------------------------------------------------- */
  /* Ambient distant motes — sense of scale                            */
  /* ---------------------------------------------------------------- */
  const ambientPos = new Float32Array(AMBIENT_COUNT * 3);
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    const r = 2.8 + Math.random() * 2.2;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    ambientPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    ambientPos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
    ambientPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const ambientGeo = new THREE.BufferGeometry();
  ambientGeo.setAttribute('position', new THREE.BufferAttribute(ambientPos, 3));
  const ambientMat = new THREE.PointsMaterial({
    size: 0.022,
    color: palette.dust,
    transparent: true,
    opacity: light ? 0.22 : 0.38,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const ambientPoints = new THREE.Points(ambientGeo, ambientMat);
  group.add(ambientPoints);

  /* ---------------------------------------------------------------- */
  /* Coordinated update — one clock, many phases                       */
  /* ---------------------------------------------------------------- */
  let animTime = 0;
  let disposed = false;

  return {
    group,
    update: (t, dt, updOpts) => {
      void t;
      if (disposed) return;
      const rm = updOpts.reducedMotion || opts.reducedMotion || false;
      const s = rm ? 0.12 : 1;
      const d = Math.min(dt, 0.05);
      animTime += d * s;
      const at = animTime;

      const breathe = Math.sin(at * 0.7) * 0.014 + Math.sin(at * 1.33 + 1.7) * 0.007;
      coreMesh.scale.setScalar(1 + breathe);
      filaments.scale.setScalar(1 + breathe * 0.45);
      innerPoints.scale.setScalar(1 + breathe * 0.3);

      glowHot.sprite.scale.setScalar(glowHot.baseScale * (1 + Math.sin(at * 1.21) * 0.06));
      glowMid.sprite.scale.setScalar(glowMid.baseScale * (1 + Math.sin(at * 0.74 + 2.1) * 0.05));
      glowOuter.sprite.scale.setScalar(
        glowOuter.baseScale * (1 + Math.sin(at * 0.47 + 4.0) * 0.04),
      );
      glowHot.mat.opacity = glowHot.baseOpacity * (1 + Math.sin(at * 1.21) * 0.1);
      glowMid.mat.opacity = glowMid.baseOpacity * (1 + Math.sin(at * 0.74 + 2.1) * 0.12);
      glowOuter.mat.opacity = glowOuter.baseOpacity * (1 + Math.sin(at * 0.47 + 4.0) * 0.14);

      coreMat.uniforms['uTime']!.value = at;
      filMat.uniforms['uTime']!.value = at;
      wispMat.uniforms['uTime']!.value = at * 1.1;
      coreMat.uniforms['uOpacity']!.value = (light ? 0.68 : 0.9) * (1 + Math.sin(at * 0.6) * 0.08);

      coreMesh.rotation.y += d * 0.06 * s;
      filaments.rotation.y += d * 0.045 * s;
      filaments.rotation.x = Math.sin(at * 0.11) * 0.14;
      filaments.rotation.z = Math.cos(at * 0.07) * 0.08;
      wisps.rotation.y -= d * 0.026 * s;
      wisps.rotation.x = Math.sin(at * 0.08 + 2.0) * 0.1;
      wisps.rotation.z = Math.cos(at * 0.06 + 1.0) * 0.06;
      innerPoints.rotation.y += d * 0.1 * s;
      ambientPoints.rotation.y += d * 0.016 * s;
      ambientPoints.rotation.x = Math.sin(at * 0.05) * 0.04;

      const ipos = innerGeo.getAttribute('position') as THREE.BufferAttribute;
      const iarr = ipos.array as Float32Array;
      for (let i = 0; i < INNER_COUNT; i++) {
        iarr[i * 3] = iarr[i * 3]! + innerVel[i * 3]! * s;
        iarr[i * 3 + 1] = iarr[i * 3 + 1]! + innerVel[i * 3 + 1]! * s;
        iarr[i * 3 + 2] = iarr[i * 3 + 2]! + innerVel[i * 3 + 2]! * s;
        const len = Math.hypot(iarr[i * 3]!, iarr[i * 3 + 1]!, iarr[i * 3 + 2]!);
        if (len > 0.34) {
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          const r = Math.random() * 0.18;
          iarr[i * 3] = r * Math.sin(ph) * Math.cos(th);
          iarr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
          iarr[i * 3 + 2] = r * Math.cos(ph);
        }
      }
      ipos.needsUpdate = true;

      const sPos = streakGeo.getAttribute('position') as THREE.BufferAttribute;
      const sArr = sPos.array as Float32Array;
      const sAlphaAttr = streakGeo.getAttribute('aAlpha') as THREE.BufferAttribute;
      const sAlpha = sAlphaAttr.array as Float32Array;
      for (let i = 0; i < STREAK_COUNT; i++) {
        const st = streaks[i]!;
        st.r += st.sign * st.speed * d * s * 1.2;
        if (st.r > 2.85 || st.r < 0.5) spawnStreak(st, false);

        const headR = st.r;
        const tailR = st.r - st.sign * st.len;
        sArr[i * 6] = st.dir.x * headR;
        sArr[i * 6 + 1] = st.dir.y * headR;
        sArr[i * 6 + 2] = st.dir.z * headR;
        sArr[i * 6 + 3] = st.dir.x * tailR;
        sArr[i * 6 + 4] = st.dir.y * tailR;
        sArr[i * 6 + 5] = st.dir.z * tailR;

        const edge = Math.min(1, Math.max(0, Math.min((st.r - 0.5) / 0.35, (2.85 - st.r) / 0.35)));
        sAlpha[i * 2] = 0.8 * edge;
        sAlpha[i * 2 + 1] = 0.12 * edge;
      }
      sPos.needsUpdate = true;
      sAlphaAttr.needsUpdate = true;
    },
    dispose: () => {
      disposed = true;
      coreGeo.dispose();
      coreMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      filGeo.dispose();
      filMat.dispose();
      glowHot.mat.map?.dispose();
      glowHot.mat.dispose();
      glowMid.mat.map?.dispose();
      glowMid.mat.dispose();
      glowOuter.mat.map?.dispose();
      glowOuter.mat.dispose();
      wispGeo.dispose();
      wispMat.dispose();
      streakGeo.dispose();
      streakMat.dispose();
      ambientGeo.dispose();
      ambientMat.dispose();
    },
  };
}
