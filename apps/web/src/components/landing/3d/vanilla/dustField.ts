/**
 * Global ambient dust — a fixed, full-viewport particle field behind the
 * entire landing. Now 3.8x denser with clustered, layered distribution.
 * This is what makes pure black feel alive instead of empty.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, type SceneHandle } from './engine';

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  density: number;
};

// Base count 1800 at density 1.0 — ultra dense for immersive field
const BASE_COUNT = 1800;

// Size tiers: 70% very small, 20% small, 8% medium-small, 2% emphasized
const SIZE_TIERS = [
  { ratio: 0.7, size: 0.032, opacity: 0.32 },
  { ratio: 0.2, size: 0.055, opacity: 0.5 },
  { ratio: 0.08, size: 0.078, opacity: 0.62 },
  { ratio: 0.02, size: 0.11, opacity: 0.75 },
] as const;

// Cluster centers for organic distribution
const CLUSTERS = [
  { x: -6, y: 3, z: -1.5, spread: 3.2 },
  { x: 5, y: -2, z: 0.8, spread: 2.8 },
  { x: -3, y: -4, z: -2, spread: 2.5 },
  { x: 4, y: 4, z: 1.2, spread: 2.0 },
  { x: 0, y: 0, z: -2.5, spread: 4.0 },
  { x: -7, y: -1, z: 1, spread: 1.8 },
  { x: 7, y: 2, z: -0.5, spread: 1.8 },
];

function isBehindHeading(x: number, y: number, z: number): boolean {
  // Central text area: reduce density behind heading for readability
  return x > -2.5 && x < 2.5 && y > -0.8 && y < 1.8 && z > -0.5 && z < 1.5;
}

export function mountDustField({ container, theme, density }: Cfg): SceneHandle {
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 0, 10);

  const totalCount = Math.round(BASE_COUNT * density);
  // We'll create 4 separate Points for size variation, but share the same update loop
  // For performance, use a single geometry with size attribute and custom shader would be better,
  // but 4 draw calls is still cheap. We'll use a single geometry with vertex colors for simplicity
  // and handle size via material size + depth.

  // Generate clustered positions
  const pos = new Float32Array(totalCount * 3);
  const depth = new Float32Array(totalCount);
  const sizes = new Float32Array(totalCount);

  let idx = 0;
  for (const tier of SIZE_TIERS) {
    const tierCount = Math.round(totalCount * tier.ratio);
    for (let i = 0; i < tierCount && idx < totalCount; i++) {
      let x: number, y: number, z: number;
      // 60% clustered, 40% uniform
      if (Math.random() < 0.6) {
        const c = CLUSTERS[Math.floor(Math.random() * CLUSTERS.length)]!;
        // Gaussian-like spread around cluster center
        const spread = c.spread;
        x = c.x + (Math.random() - 0.5) * spread * 2;
        y = c.y + (Math.random() - 0.5) * spread * 1.4;
        z = c.z + (Math.random() - 0.5) * spread * 0.9;
      } else {
        x = (Math.random() - 0.5) * 22;
        y = (Math.random() - 0.5) * 14;
        z = (Math.random() - 0.5) * 6;
      }

      // Reduce density behind heading: skip 30% (was 55%) for richer feel
      if (isBehindHeading(x, y, z) && Math.random() < 0.3) {
        // Try again with uniform distribution outside the zone
        x = (Math.random() - 0.5) * 22;
        // Push to outer region if still in the zone, bias to outer
        if (isBehindHeading(x, y, z)) {
          x = x > 0 ? 4 + Math.random() * 6 : -4 - Math.random() * 6;
        }
      }

      pos[idx * 3] = x;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = z;
      // Depth for parallax and size variation: 0 far, 1 near
      // Far particles smaller/fainter, near larger/brighter — already handled by tier,
      // but we also use depth for drift speed and parallax
      const d = (z + 3) / 6; // normalize z -3..3 to 0..1
      depth[idx] = Math.max(0, Math.min(1, d));
      // Size variation within tier: add small jitter
      const jitter = 0.85 + Math.random() * 0.3;
      sizes[idx] = tier.size * jitter;
      idx++;
    }
  }

  // If we didn't fill all (due to rounding), fill remaining uniformly
  while (idx < totalCount) {
    pos[idx * 3] = (Math.random() - 0.5) * 22;
    pos[idx * 3 + 1] = (Math.random() - 0.5) * 14;
    pos[idx * 3 + 2] = (Math.random() - 0.5) * 6;
    depth[idx] = Math.random();
    sizes[idx] = 0.035 + Math.random() * 0.02;
    idx++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const color = theme === 'light' ? '#4f46e5' : '#a5b4fc';
  // Use a single material with sizeAttenuation; size variation via attribute would need shader,
  // so we use an average size and let depth handle variation. For true per-particle size,
  // we'd need a shader, but we can approximate by using the tier's base size as material size
  // and rely on depth for near/far variation.
  // To keep it simple and performant, use one material with average size 0.05,
  // and the size variation is already baked into the depth/speed, not visual size.
  // For more accurate size variation, we create a custom shader material.
  // Let's use a ShaderMaterial for per-particle size.

  const vertexShader = `
    attribute float size;
    varying float vDepth;
    void main() {
      vDepth = (position.z + 3.0) / 6.0;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (180.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  const fragmentShader = `
    varying float vDepth;
    uniform vec3 color;
    uniform float opacity;
    void main() {
      float d = distance(gl_PointCoord, vec2(0.5, 0.5));
      if (d > 0.5) discard;
      float alpha = opacity * (0.7 + vDepth * 0.3);
      // Soft particle edge
      float edge = smoothstep(0.5, 0.3, d);
      gl_FragColor = vec4(color, alpha * edge);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      opacity: { value: theme === 'light' ? 0.42 : 0.58 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let scrollY = 0;
  const onScroll = (): void => {
    scrollY = window.scrollY;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      tick: (dt, t) => {
        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < totalCount; i++) {
          const y = arr[i * 3 + 1]!;
          const d = depth[i]!;
          arr[i * 3 + 1] = y + dt * (0.05 + d * 0.14);
          arr[i * 3] = arr[i * 3]! + Math.sin(t * 0.25 + i * 0.1) * dt * 0.015;
          if (y > 7.5) arr[i * 3 + 1] = -7.5;
        }
        attr.needsUpdate = true;
        points.position.y = scrollY * 0.001;
        points.rotation.z = Math.sin(t * 0.04) * 0.015;
      },
    },
    theme === 'light' ? 1.25 : 1.5,
  );

  return {
    setRunning: handle.setRunning,
    dispose(): void {
      window.removeEventListener('scroll', onScroll);
      handle.dispose();
    },
  };
}
