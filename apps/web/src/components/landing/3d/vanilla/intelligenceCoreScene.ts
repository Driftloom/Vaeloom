/**
 * Living Intelligence Core — the upgraded center.
 * 6 coordinated layers that feel like ONE organism, not 6 spinning things.
 * One orbit is shifted to streamA (#22d3ee) per request — intentional accent.
 */

import * as THREE from 'three';
import { scenePalette } from '../scene-utils';

export type CoreHandle = {
  group: THREE.Group;
  update: (t: number, dt: number, opts: { reducedMotion: boolean }) => void;
  dispose: () => void;
};

export function createIntelligenceCore(
  theme: 'dark' | 'light',
  opts: { reducedMotion?: boolean } = {},
): CoreHandle {
  const palette = scenePalette(theme);
  const group = new THREE.Group();

  // Shared time — coordinated, not synchronized
  // All layers sample these with different phases/speeds

  // Layer A — Internal energy field (smallest, most active)
  const coreGeo = new THREE.SphereGeometry(0.32, 32, 32);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      colorA: { value: new THREE.Color(palette.core) },
      colorB: { value: new THREE.Color('#ffffff') },
      opacity: { value: theme === 'light' ? 0.55 : 0.72 },
    },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vNormal;
      uniform float time;
      void main() {
        vPos = position;
        vNormal = normal;
        vec3 p = position;
        // subtle noise deformation
        p += normal * 0.015 * sin(position.x * 8.0 + time * 1.4) * cos(position.y * 6.0 + time * 0.9);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform float opacity;
      varying vec3 vPos;
      varying vec3 vNormal;
      // simple fbm-ish
      float noise(vec3 p) {
        return sin(p.x*4.0 + time*0.7)*0.5 + cos(p.y*5.0 - time*0.6)*0.5 + sin(p.z*3.0 + time*0.5)*0.5;
      }
      void main() {
        float n = noise(vPos * 2.2);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), vec3(0.0,0.0,1.0))), 2.0);
        vec3 col = mix(colorA, colorB, fresnel * 0.45 + n * 0.15);
        // internal flow
        col += vec3(0.08) * sin(n*6.0 + time*1.2);
        gl_FragColor = vec4(col, opacity * (0.85 + fresnel*0.3));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // Tiny internal points — computation happening inside
  const innerCount = 90;
  const innerPos = new Float32Array(innerCount * 3);
  const innerVel = new Float32Array(innerCount * 3);
  for (let i = 0; i < innerCount; i++) {
    const r = Math.random() * 0.28;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    innerPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    innerPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    innerPos[i * 3 + 2] = r * Math.cos(ph);
    innerVel[i * 3] = (Math.random() - 0.5) * 0.006;
    innerVel[i * 3 + 1] = (Math.random() - 0.5) * 0.006;
    innerVel[i * 3 + 2] = (Math.random() - 0.5) * 0.006;
  }
  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute('position', new THREE.BufferAttribute(innerPos, 3));
  const innerPoints = new THREE.Points(
    innerGeo,
    new THREE.PointsMaterial({
      size: 0.018,
      color: palette.core,
      transparent: true,
      opacity: theme === 'light' ? 0.45 : 0.65,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(innerPoints);

  // Layer B — Inner geometric structure
  const innerStruct = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.52, 1),
    new THREE.MeshBasicMaterial({
      color: palette.core,
      wireframe: true,
      transparent: true,
      opacity: theme === 'light' ? 0.22 : 0.32,
    }),
  );
  group.add(innerStruct);

  // Layer C — Semi-transparent shell (breathing)
  const shellGeo = new THREE.IcosahedronGeometry(0.85, 2);
  // Keep original positions for deformation
  const shellPosAttr = shellGeo.getAttribute('position') as THREE.BufferAttribute;
  const shellOrig = Float32Array.from(shellPosAttr.array as Float32Array);
  const shellMesh = new THREE.Mesh(
    shellGeo,
    new THREE.MeshPhysicalMaterial({
      color: palette.core,
      transparent: true,
      opacity: theme === 'light' ? 0.08 : 0.13,
      transmission: theme === 'light' ? 0.55 : 0.72,
      roughness: 0.18,
      metalness: 0.12,
      depthWrite: false,
    }),
  );
  group.add(shellMesh);

  // Layer D — Network veil
  const netGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.85, 2));
  const netMat = new THREE.LineBasicMaterial({
    color: palette.structure,
    transparent: true,
    opacity: theme === 'light' ? 0.14 : 0.22,
  });
  const netLines = new THREE.LineSegments(netGeo, netMat);
  netLines.scale.setScalar(1.45);
  group.add(netLines);

  // Halo
  const haloMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(
      (() => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d')!;
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, palette.core);
        g.addColorStop(0.35, palette.core + '66');
        g.addColorStop(1, palette.core + '00');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        return c;
      })(),
    ),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(4.4);
  group.add(halo);

  // Layer E — Orbital systems (4 shells) — one shifted to streamA
  const orbits: Array<{ line: THREE.Line; speed: number; axis: THREE.Vector3; tilt: number }> = [];
  const orbitDefs = [
    { radius: 1.18, tilt: 18, speed: 0.07, color: palette.structure, opacity: 0.22, segments: 96 },
    { radius: 1.42, tilt: -24, speed: 0.11, color: '#22d3ee', opacity: 0.32, segments: 96 }, // <-- shifted accent
    { radius: 1.68, tilt: 32, speed: -0.06, color: palette.structure, opacity: 0.18, segments: 96 },
    { radius: 1.92, tilt: -12, speed: 0.045, color: palette.core, opacity: 0.15, segments: 96 },
  ];
  orbitDefs.forEach((def) => {
    const curve = new THREE.EllipseCurve(
      0,
      0,
      def.radius,
      def.radius * 0.92,
      0,
      Math.PI * 2,
      false,
      0,
    );
    const pts = curve.getPoints(def.segments);
    const geo = new THREE.BufferGeometry().setFromPoints(pts as unknown as THREE.Vector3[]);
    const mat = new THREE.LineBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: def.opacity,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.rotation.x = (def.tilt * Math.PI) / 180;
    line.rotation.z = (Math.random() - 0.5) * 0.15;
    group.add(line);
    orbits.push({ line, speed: def.speed, axis: new THREE.Vector3(0, 1, 0), tilt: def.tilt });
  });

  // Layer F will be handled by the outer dust/motes, but we add a local ambient field
  // Tiny distant points for scale
  const ambientCount = 60;
  const ambientPos = new Float32Array(ambientCount * 3);
  for (let i = 0; i < ambientCount; i++) {
    const r = 2.8 + Math.random() * 2.2;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    ambientPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    ambientPos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
    ambientPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const ambientGeo = new THREE.BufferGeometry();
  ambientGeo.setAttribute('position', new THREE.BufferAttribute(ambientPos, 3));
  const ambientPoints = new THREE.Points(
    ambientGeo,
    new THREE.PointsMaterial({
      size: 0.022,
      color: palette.dust,
      transparent: true,
      opacity: theme === 'light' ? 0.22 : 0.38,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
  group.add(ambientPoints);

  let disposed = false;

  return {
    group,
    update: (t: number, dt: number, updOpts: { reducedMotion: boolean }) => {
      if (disposed) return;
      const rm = updOpts.reducedMotion || opts.reducedMotion;
      const s = rm ? 0.12 : 1; // reduce intensity, not kill

      // Core breathing + pulse
      const breathe = Math.sin(t * 0.7) * 0.012 * s + Math.sin(t * 1.4) * 0.006 * s;
      coreMesh.scale.setScalar(1 + breathe);
      innerStruct.scale.setScalar(1 + breathe * 0.6);
      shellMesh.scale.setScalar(1 + breathe * 0.35);
      netLines.scale.setScalar(1.45 + breathe * 0.18);
      halo.scale.setScalar(4.4 + Math.sin(t * 1.4) * 0.12 * s);

      // Internal energy time
      (coreMat.uniforms as any)['time'].value = t * 0.9;
      (coreMat.uniforms as any)['opacity'].value =
        theme === 'light'
          ? 0.52 + Math.sin(t * 0.6) * 0.08 * s
          : 0.68 + Math.sin(t * 0.6) * 0.12 * s;

      // Inner points drift
      const ipos = innerGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = ipos.array as Float32Array;
      for (let i = 0; i < innerCount; i++) {
        arr[i * 3] = arr[i * 3]! + innerVel[i * 3]! * s;
        arr[i * 3 + 1] = arr[i * 3 + 1]! + innerVel[i * 3 + 1]! * s;
        arr[i * 3 + 2] = arr[i * 3 + 2]! + innerVel[i * 3 + 2]! * s;
        // curl + respawn if too far
        const len = Math.hypot(arr[i * 3]!, arr[i * 3 + 1]!, arr[i * 3 + 2]!);
        if (len > 0.32) {
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          const r = Math.random() * 0.18;
          arr[i * 3] = r * Math.sin(ph) * Math.cos(th);
          arr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
          arr[i * 3 + 2] = r * Math.cos(ph);
        }
      }
      ipos.needsUpdate = true;

      // Inner structure rotation (slightly faster than core)
      innerStruct.rotation.y += dt * 0.09 * s;
      innerStruct.rotation.x = Math.sin(t * 0.08) * 0.1 * s;

      // Shell rotation — coordinated but different speeds/orientations
      shellMesh.rotation.y += dt * 0.05 * s;
      shellMesh.rotation.x = Math.sin(t * 0.07) * 0.06 * s;
      netLines.rotation.y += dt * 0.04 * s;
      netLines.rotation.z = Math.sin(t * 0.06) * 0.05 * s;

      // Shell deformation — very subtle electromagnetic breathing
      if (!rm) {
        const pos = shellPosAttr;
        const arr2 = pos.array as Float32Array;
        for (let i = 0; i < arr2.length; i += 3) {
          const ox = shellOrig[i]!;
          const oy = shellOrig[i + 1]!;
          const oz = shellOrig[i + 2]!;
          const n = new THREE.Vector3(ox, oy, oz).normalize();
          const deform =
            Math.sin(t * 0.5 + ox * 3.0) * 0.012 + Math.cos(t * 0.4 + oy * 2.0) * 0.008;
          arr2[i] = ox + n.x * deform;
          arr2[i + 1] = oy + n.y * deform;
          arr2[i + 2] = oz + n.z * deform;
        }
        pos.needsUpdate = true;
        shellGeo.computeVertexNormals();
        // Opacity pulse only slightly, not synced to heartbeat
        (netMat as any).opacity =
          theme === 'light'
            ? 0.14 + Math.sin(t * 0.55) * 0.04 * s
            : 0.22 + Math.sin(t * 0.55) * 0.06 * s;
      }

      // Orbits — each has its own tilt and speed, all slow
      orbits.forEach((o, idx) => {
        const speedVar = Math.sin(t * 0.18 + idx) * 0.018 * s;
        o.line.rotation.y += dt * (o.speed + speedVar) * s;
        // subtle deformation: oval wobble
        o.line.scale.x = 1 + Math.sin(t * 0.22 + idx) * 0.015 * s;
        o.line.scale.y = 1 + Math.cos(t * 0.2 + idx * 0.7) * 0.012 * s;
      });

      // Ambient drift
      ambientPoints.rotation.y += dt * 0.018 * s;
      ambientPoints.rotation.x = Math.sin(t * 0.05) * 0.04 * s;
    },
    dispose: () => {
      disposed = true;
      coreGeo.dispose();
      (coreMat as any).dispose?.();
      innerGeo.dispose();
      (innerPoints.material as any).dispose?.();
      shellGeo.dispose();
      (shellMesh.material as any).dispose?.();
      netGeo.dispose();
      (netLines.material as any).dispose?.();
      (haloMat.map as THREE.CanvasTexture)?.dispose?.();
      (haloMat as any).dispose?.();
      orbits.forEach((o) => {
        (o.line.geometry as THREE.BufferGeometry).dispose();
        (o.line.material as any).dispose?.();
      });
      ambientGeo.dispose();
      (ambientPoints.material as any).dispose?.();
    },
  };
}
