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
  attachTo: (el: HTMLElement) => void;
  setActiveBeat: (name: string, getProgress?: () => number) => void;
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
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function createStage(opts: CreateStageOptions): StageHandle {
  const built = buildStage(opts);
  const beats = built.beats;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  );
  renderer.setSize(1, 1, false);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 0.9, 7.4);
  camera.lookAt(0, 0, 0);

  const pointer: Pointer = { x: 0, y: 0 };
  let parentEl: HTMLElement | null = null;
  let activeIndex = 0;
  let getProgress: () => number = () => 0;
  const rm = prefersReducedMotion();

  let raf = 0;
  let last = 0;
  let running = false;
  let elapsed = 0;

  function resize(): void {
    if (!parentEl) return;
    const w = Math.max(1, parentEl.clientWidth);
    const h = Math.max(1, parentEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function onPointer(e: PointerEvent): void {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -((e.clientY / window.innerHeight) * 2 - 1);
    pointer.x = x;
    pointer.y = y;
  }

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const curPos = new THREE.Vector3();
  const curLook = new THREE.Vector3();

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    const beat: Beat = beats[activeIndex]!;
    const progress = Math.min(1, Math.max(0, getProgress()));
    const cs = beat.cameraFor(progress);

    tmpPos.set(cs.pos[0], cs.pos[1], cs.pos[2]);
    tmpLook.set(cs.look[0], cs.look[1], cs.look[2]);

    const lerp = Math.min(1, dt * 6);
    curPos.lerp(tmpPos, lerp);
    curLook.lerp(tmpLook, lerp);
    camera.position.copy(curPos);
    camera.lookAt(curLook);
    camera.fov += (cs.fov - camera.fov) * lerp;
    camera.updateProjectionMatrix();

    beats.forEach((b, i) => {
      b.object.visible = i === activeIndex;
    });

    beat.tick(elapsed, dt, pointer, rm, progress);
    renderer.render(beats[activeIndex]!.object, camera);
  }

  function attachTo(el: HTMLElement): void {
    parentEl = el;
    if (canvas.parentElement !== el) el.appendChild(canvas);
    resize();
  }

  function setActiveBeat(name: string, getProg?: () => number): void {
    const idx = beats.findIndex((b) => b.name === name);
    if (idx < 0) return;
    activeIndex = idx;
    if (getProg) getProgress = getProg;
    else getProgress = () => 0;
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
    attachTo,
    setActiveBeat,
    start,
    stop,
    resize,
    getCanvas: () => canvas,
    dispose,
  };
}
