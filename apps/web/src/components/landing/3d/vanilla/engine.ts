/**
 * Minimal vanilla-Three.js scene runner.
 *
 * Deliberately NOT React Three Fiber: R3F v8 conflicts with Next 15's
 * React wiring at runtime (dual reconciler crash). A ~90-line runner
 * gives us the same result with zero extra dependencies, fewer KB,
 * and full control over pausing/disposal.
 *
 * Contract: mount() creates renderer+loop, returns { setRunning, dispose }.
 * Scenes own their geometry; disposal walks and frees GPU resources.
 */

import * as THREE from 'three';

export type SceneHandle = {
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

export type MountOptions = {
  /** Called once per frame while running. dt in seconds. */
  tick?: (dt: number, elapsed: number) => void;
  fov?: number;
  cameraZ?: number;
  cameraY?: number;
};

export function createRenderer(container: HTMLElement): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  return { renderer, scene, camera };
}

export function runLoop(
  container: HTMLElement,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  opts: MountOptions,
  initialDpr: number,
): SceneHandle & { onFrameCallbacks: Set<(dt: number, t: number) => void> } {
  let running = true;
  let raf = 0;
  const clock = new THREE.Clock();
  const onFrameCallbacks = new Set<(dt: number, t: number) => void>();

  function resize(): void {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, initialDpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function frame(): void {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    for (const cb of onFrameCallbacks) cb(dt, t);
    opts.tick?.(dt, t);
    renderer.render(scene, camera);
  }
  frame();

  return {
    onFrameCallbacks,
    setRunning(next: boolean): void {
      running = next;
      if (next) clock.getDelta(); // swallow accumulated time
    },
    dispose(): void {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Shared raycaster helper for pointer picking against objects. */
export function pickAt(
  event: PointerEvent | MouseEvent,
  container: HTMLElement,
  camera: THREE.PerspectiveCamera,
  targets: THREE.Object3D[],
): number {
  const rect = container.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(targets, false);
  return hits.length > 0 ? (hits[0]!.instanceId ?? -2) : -1;
}
