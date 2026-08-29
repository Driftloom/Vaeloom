import * as THREE from 'three';
import type { Pointer } from './memoryCoreScene';
import { createMemoryCore } from './memoryCoreScene';
import { createKnowledgeGraph } from './knowledgeGraphScene';
import { createAgentOrbit } from './agentOrbitScene';
import { createConnectorFlow } from './connectorScene';
import { createGrowth } from './growthScene';
import { createJourney } from './journeyScene';

export type QualityTier = 'high' | 'medium' | 'low';
export type ThemeName = 'dark' | 'light';

export interface Beat {
  name: string;
  object: THREE.Object3D;
  z: number;
  frame: CameraKey;
  hasPath?: boolean;
  cameraFor: (localProgress: number) => CameraState;
  tick: (t: number, dt: number, pointer: Pointer, rm: boolean, localProgress: number) => void;
  dispose: () => void;
}

export interface CameraKey {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

export interface CameraState {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

export interface BuildStageOptions {
  theme: 'dark' | 'light';
  density: number;
  tier: QualityTier;
}

const GAP = 60;

const heroKF: CameraKey = { pos: [0, 0.9, 7.4], look: [0, 0, 0], fov: 42 };
const memoryKF: CameraKey = { pos: [0, 1.4, 8.6], look: [0, 0, 0], fov: 48 };
const agentsKF: CameraKey = { pos: [0, 1.9, 6.4], look: [0, 0, 0], fov: 50 };
const connectorsKF: CameraKey = { pos: [0, 2.6, 6.8], look: [0, 0, 0], fov: 52 };
const growthKF: CameraKey = { pos: [7.5, 5.5, 9.5], look: [0, 1.2, 0], fov: 55 };
const ctaKF = heroKF;

function cameraPath(localT: number): CameraState {
  const a = localT * Math.PI * 2;
  const x = Math.sin(a) * 0.6;
  const y = Math.cos(a) * 0.4;
  const camZ = 6.5 - localT * (27.2 + 5);
  return {
    pos: [x, y, camZ],
    look: [x * 0.4, y * 0.4, camZ - 5],
    fov: 55,
  };
}

function cameraFor(key: CameraKey, localT: number): CameraState {
  const z = key.pos[2];
  return {
    pos: [key.pos[0], key.pos[1], z],
    look: [key.look[0], key.look[1], key.look[2]],
    fov: key.fov,
  };
}

export interface BuildStageResult {
  beats: Beat[];
  dispose: () => void;
}

export function buildStage(opts: BuildStageOptions): BuildStageResult {
  const { theme, density, tier } = opts;
  const hero = createMemoryCore(theme, density, tier, undefined, true);
  const journey = createJourney(theme);
  const memory = createKnowledgeGraph(theme);
  const agents = createAgentOrbit(theme, [
    'orchestrator',
    'researcher',
    'scholar',
    'planner',
    'writer',
    'critic',
    'journal',
  ]);
  const connectors = createConnectorFlow(theme, density);
  const growth = createGrowth(theme);
  const cta = createMemoryCore(theme, density, tier, undefined, false);

  const beats: Beat[] = [
    {
      name: 'hero',
      object: (() => {
        const g = new THREE.Group();
        hero.objects.forEach((o) => g.add(o));
        return g;
      })(),
      z: 0,
      frame: heroKF,
      cameraFor: (lp: number) => cameraFor(heroKF, lp),
      tick: (t, dt, p, rm) => hero.update(t, dt, p, rm),
      dispose: hero.dispose,
    },
    {
      name: 'journey',
      object: journey.group,
      z: -GAP,
      frame: { pos: [0, 0, 6.5], look: [0, 0, 1.5], fov: 55 },
      hasPath: true,
      cameraFor: (lp: number) => cameraPath(lp),
      tick: (_t, _dt, _p, _rm, lp) => journey.update(lp),
      dispose: journey.dispose,
    },
    {
      name: 'memory',
      object: memory.group,
      z: -GAP * 2,
      frame: memoryKF,
      cameraFor: (lp: number) => cameraFor(memoryKF, lp),
      tick: (t) => memory.update(t),
      dispose: memory.dispose,
    },
    {
      name: 'agents',
      object: agents.group,
      z: -GAP * 3,
      frame: agentsKF,
      cameraFor: (lp: number) => cameraFor(agentsKF, lp),
      tick: (t, dt) => agents.update(t, dt),
      dispose: agents.dispose,
    },
    {
      name: 'connectors',
      object: connectors.group,
      z: -GAP * 4,
      frame: connectorsKF,
      cameraFor: (lp: number) => cameraFor(connectorsKF, lp),
      tick: (t, dt, _p, rm) => connectors.update(t, dt, rm),
      dispose: connectors.dispose,
    },
    {
      name: 'growth',
      object: growth.group,
      z: -GAP * 5,
      frame: growthKF,
      cameraFor: (lp: number) => cameraFor(growthKF, lp),
      tick: (_t, _dt, _p, _rm, lp) => growth.update(lp),
      dispose: growth.dispose,
    },
    {
      name: 'cta',
      object: (() => {
        const g = new THREE.Group();
        cta.objects.forEach((o) => g.add(o));
        return g;
      })(),
      z: -GAP * 6,
      frame: ctaKF,
      cameraFor: (lp: number) => cameraFor(ctaKF, lp),
      tick: (t, dt, p, rm) => cta.update(t, dt, p, rm),
      dispose: cta.dispose,
    },
  ];

  return {
    beats,
    dispose: () => {
      beats.forEach((b) => b.dispose());
    },
  };
}

export interface StageHandle {
  start: () => void;
  stop: () => void;
  resize: () => void;
  getCanvas: () => HTMLCanvasElement;
  dispose: () => void;
}

export interface CreateStageOptions {
  theme: ThemeName;
  density: number;
  tier: QualityTier;
  /** Total page scroll progress 0..1 — drives the continuous flythrough. */
  getProgress: () => number;
  /** Debug/QA: pin the camera to a single beat (e.g. ?stageBeat=memory). */
  forcedBeat?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function createStage(opts: CreateStageOptions): StageHandle {
  const { getProgress, forcedBeat } = opts;
  const built = buildStage(opts);
  const beats = built.beats;
  const N = beats.length;

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  );
  renderer.setSize(1, 1, false);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
  camera.position.set(0, 0.9, 7.4);
  camera.lookAt(0, 0, 0);

  // Lay every beat out along -Z in a single root group so the camera flies
  // through one continuous world instead of teleporting between canvases.
  const root = new THREE.Group();
  beats.forEach((b) => {
    b.object.position.z = b.z;
    root.add(b.object);
  });

  const pointer: Pointer = { x: 0, y: 0 };
  const rm = prefersReducedMotion();

  let raf = 0;
  let last = 0;
  let running = false;
  let elapsed = 0;

  function resize(): void {
    const el = canvas.parentElement;
    if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function onPointer(e: PointerEvent): void {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    // Global page progress -> which segment of the world we're flying through.
    const gp = forcedBeat
      ? (Math.max(
          0,
          beats.findIndex((b) => b.name === forcedBeat),
        ) +
          0.5) /
        (N - 1)
      : Math.min(1, Math.max(0, getProgress()));
    const t = gp * (N - 1);
    const i = Math.min(Math.floor(t), N - 2);
    const f = t - i;
    const e = f * f * (3 - 2 * f); // smoothstep between adjacent beats

    const ca = beats[i]!.cameraFor(f);
    const cb = beats[i + 1]!.cameraFor(0);
    const za = beats[i]!.z;
    const zb = beats[i + 1]!.z;
    const pax = ca.pos[0];
    const pay = ca.pos[1];
    const paz = ca.pos[2] + za;
    const pbx = cb.pos[0];
    const pby = cb.pos[1];
    const pbz = cb.pos[2] + zb;
    const lax = ca.look[0];
    const lay = ca.look[1];
    const laz = ca.look[2] + za;
    const lbx = cb.look[0];
    const lby = cb.look[1];
    const lbz = cb.look[2] + zb;

    tmpPos.set(lerp(pax, pbx, e), lerp(pay, pby, e), lerp(paz, pbz, e));
    tmpLook.set(lerp(lax, lbx, e), lerp(lay, lby, e), lerp(laz, lbz, e));
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    camera.fov = lerp(ca.fov, cb.fov, e);
    camera.updateProjectionMatrix();

    beats.forEach((b, k) => {
      b.object.visible = true; // always present; camera reveals the active beat
      b.tick(elapsed, dt, pointer, rm, Math.min(1, Math.max(0, t - k)));
    });

    renderer.render(root, camera);
  }

  function start(): void {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop(): void {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function dispose(): void {
    stop();
    if (typeof window !== 'undefined') window.removeEventListener('pointermove', onPointer);
    built.dispose();
    renderer.dispose();
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
  }

  if (typeof window !== 'undefined')
    window.addEventListener('pointermove', onPointer, { passive: true });

  return {
    start,
    stop,
    resize,
    getCanvas: () => canvas,
    dispose,
  };
}
