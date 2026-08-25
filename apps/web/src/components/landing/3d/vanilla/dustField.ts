/**
 * Global ambient dust — a fixed, full-viewport particle field behind the
 * entire landing. Cheap (one Points draw), scroll-parallaxed, tier-gated.
 * This is what makes pure black feel alive instead of empty.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, type SceneHandle } from './engine';

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  density: number;
};

export function mountDustField({ container, theme, density }: Cfg): SceneHandle {
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 0, 10);

  const count = Math.round(170 * density);
  const pos = new Float32Array(count * 3);
  const depth = new Float32Array(count); // 0 far .. 1 near (parallax + size)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 22;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    depth[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const color = theme === 'light' ? '#4f46e5' : '#a5b4fc';
  const mat = new THREE.PointsMaterial({
    size: 0.055,
    color,
    transparent: true,
    opacity: theme === 'light' ? 0.35 : 0.5,
    sizeAttenuation: true,
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
        for (let i = 0; i < count; i++) {
          // slow upward drift + gentle horizontal sway
          const y = arr[i * 3 + 1]!;
          arr[i * 3 + 1] = y + dt * (0.08 + depth[i]! * 0.12);
          arr[i * 3] = arr[i * 3]! + Math.sin(t * 0.3 + i) * dt * 0.02;
          if (y > 7) arr[i * 3 + 1] = -7;
        }
        attr.needsUpdate = true;
        // scroll parallax — nearer dust moves more
        points.position.y = scrollY * 0.0012;
        points.rotation.z = Math.sin(t * 0.05) * 0.02;
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
