import * as THREE from 'three';
import type { Pointer } from './memoryCoreScene';
import { createMemoryCore } from './memoryCoreScene';
import { createKnowledgeGraph } from './knowledgeGraphScene';
import { createAgentOrbit } from './agentOrbitScene';
import { createConnectorFlow } from './connectorScene';
import { createGrowth } from './growthScene';
import { createJourney } from './journeyScene';
import { createProblemScene } from './problemScene';
import { createDifferenceScene } from './differenceScene';
import { createOrganizationScene } from './organizationScene';
import { createResumeScene } from './resumeScene';
import { createSchedulerScene } from './schedulerScene';
import { BEATS, getBeat } from './worldConstants';

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
  ensureBuilt: (index: number) => void;
  dispose: () => void;
}

export function buildStage(opts: BuildStageOptions, world: THREE.Group): BuildStageResult {
  const { theme, density, tier } = opts;

  type Real = { object: THREE.Object3D; tick: Beat['tick']; dispose: () => void };

  // Per-beat factory. Heavy scene graphs are built LAZILY — only when a beat
  // scrolls near the viewport — so the first paint isn't blocked building all
  // 12 scenes up front. This removes the multi-hundred-ms main-thread freeze
  // that made the hero "load badly" on refresh.
  const makeMeta = (
    th: ThemeName,
    de: number,
    ti: QualityTier,
  ): Array<{ id: string; cameraFor: (lp: number) => CameraState; build: () => Real }> => {
    const heroReal = (): Real => {
      const s = createMemoryCore(th, de, ti, undefined, true);
      const g = new THREE.Group();
      s.objects.forEach((o) => g.add(o));
      return {
        object: g,
        tick: (t, dt, p, rm, lp) => {
          s.update(t, dt, p, rm);
          g.rotation.y = lp * 0.4;
        },
        dispose: s.dispose,
      };
    };
    const ctaReal = (): Real => {
      const s = createMemoryCore(th, de, ti, undefined, false);
      const g = new THREE.Group();
      s.objects.forEach((o) => g.add(o));
      return { object: g, tick: (t, dt, p, rm) => s.update(t, dt, p, rm), dispose: s.dispose };
    };
    const cf = (id: string) => (lp: number) => cameraFor(getBeat(id)!.camera, lp);
    return [
      {
        id: 'hero',
        cameraFor: (lp) => ({ pos: [0, 0.9 - lp * 0.9, 7.4 + lp * 2.8], look: [0, 0, 0], fov: 42 }),
        build: heroReal,
      },
      {
        id: 'problem',
        cameraFor: cf('problem'),
        build: () => {
          const s = createProblemScene(th);
          return {
            object: s.group,
            tick: (_t, _dt, _p, _rm, lp) => s.update(_t, _dt, lp),
            dispose: s.dispose,
          };
        },
      },
      {
        id: 'difference',
        cameraFor: cf('difference'),
        build: () => {
          const s = createDifferenceScene(th);
          return {
            object: s.group,
            tick: (_t, _dt, _p, _rm, lp) => s.update(_t, _dt, lp),
            dispose: s.dispose,
          };
        },
      },
      {
        id: 'journey',
        cameraFor: (lp) => cameraPath(lp),
        build: () => {
          const s = createJourney(th);
          return {
            object: s.group,
            tick: (_t, _dt, _p, _rm, lp) => s.update(lp),
            dispose: s.dispose,
          };
        },
      },
      {
        id: 'memory',
        cameraFor: cf('memory'),
        build: () => {
          const s = createKnowledgeGraph(th);
          return { object: s.group, tick: (t) => s.update(t), dispose: s.dispose };
        },
      },
      {
        id: 'agents',
        cameraFor: cf('agents'),
        build: () => {
          const s = createAgentOrbit(th, [
            'orchestrator',
            'researcher',
            'scholar',
            'planner',
            'writer',
            'critic',
            'journal',
          ]);
          return { object: s.group, tick: (t, dt) => s.update(t, dt), dispose: s.dispose };
        },
      },
      {
        id: 'connectors',
        cameraFor: cf('connectors'),
        build: () => {
          const s = createConnectorFlow(th, de);
          return {
            object: s.group,
            tick: (t, dt, _p, rm) => s.update(t, dt, rm),
            dispose: s.dispose,
          };
        },
      },
      {
        id: 'organization',
        cameraFor: cf('organization'),
        build: () => {
          const s = createOrganizationScene(th);
          return {
            object: s.group,
            tick: (_t, _dt, _p, _rm, lp) => s.update(_t, _dt, lp),
            dispose: s.dispose,
          };
        },
      },
      {
        id: 'resume',
        cameraFor: cf('resume'),
        build: () => {
          const s = createResumeScene(th);
          return {
            object: s.group,
            tick: (_t, _dt, _p, _rm, lp) => s.update(_t, _dt, lp),
            dispose: s.dispose,
          };
        },
      },
      {
        id: 'scheduler',
        cameraFor: cf('scheduler'),
        build: () => {
          const s = createSchedulerScene(th);
          return {
            object: s.group,
            tick: (_t, _dt, _p, _rm, lp) => s.update(_t, _dt, lp),
            dispose: s.dispose,
          };
        },
      },
      {
        id: 'growth',
        cameraFor: cf('growth'),
        build: () => {
          const s = createGrowth(th);
          return {
            object: s.group,
            tick: (_t, _dt, _p, _rm, lp) => s.update(lp),
            dispose: s.dispose,
          };
        },
      },
      { id: 'cta', cameraFor: cf('cta'), build: ctaReal },
    ];
  };

  const meta = makeMeta(theme, density, tier);
  const builtReal: Array<Real | null> = meta.map(() => null);

  const beats: Beat[] = meta.map((m) => {
    const def = getBeat(m.id)!;
    const ph = new THREE.Group();
    ph.position.z = def.z;
    return {
      name: m.id,
      object: ph,
      z: def.z,
      frame: def.camera,
      hasPath: def.hasPath,
      cameraFor: m.cameraFor,
      tick: () => {},
      dispose: () => {},
    };
  });
  // Placeholder groups live in the world immediately so the camera can fly
  // through an (initially empty, never missing) world while real scenes stream in.
  beats.forEach((b) => world.add(b.object));

  function ensureBuilt(i: number): void {
    if (i < 0 || i >= meta.length || builtReal[i]) return;
    const real = meta[i]!.build();
    const b = beats[i]!;
    world.remove(b.object);
    b.object = real.object;
    b.object.position.z = b.z;
    world.add(b.object);
    b.tick = real.tick;
    b.dispose = real.dispose;
    builtReal[i] = real;
  }

  // Build the hero straight away so the first frame is ready almost instantly.
  ensureBuilt(0);

  return {
    beats,
    ensureBuilt,
    dispose: () => {
      beats.forEach((b) => b.dispose());
    },
  };
}

export interface StageHandle {
  attachTo: (el: HTMLElement) => void;
  setActiveBeat: (name: string, getProgress?: () => number) => void;
  /** Recolor scenes for a new theme WITHOUT disposing the renderer/canvas. */
  setTheme: (theme: ThemeName) => void;
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
  /** Fired once after the very first rendered frame — used to hide the
   *  loading poster so the canvas never pops in over an empty beat. */
  onReady?: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function createStage(opts: CreateStageOptions): StageHandle {
  // Single shared world: every beat group lives in one scene graph so the
  // camera can fly through them. Visibility is toggled per beat (active ± 1)
  // to keep only the relevant region drawn while neighbours stay faintly
  // visible during transitions — continuity instead of hard cuts.
  const world = new THREE.Group();
  const built = buildStage(opts, world);
  let builtStage = built;
  let beats = builtStage.beats;

  // Rebuild the scene graph for a new theme in place: the renderer, canvas,
  // and world container persist (no new WebGL context, no canvas remount
  // flash), only the beat objects are recreated with the updated palette.
  function rebuild(nextTheme: ThemeName): void {
    builtStage.dispose();
    world.clear();
    builtStage = buildStage({ theme: nextTheme, density: opts.density, tier: opts.tier }, world);
    beats = builtStage.beats;
    // Rebuild the currently-active beat and its neighbours for the new theme.
    builtStage.ensureBuilt(activeIndex);
    builtStage.ensureBuilt(activeIndex - 1);
    builtStage.ensureBuilt(activeIndex + 1);
    const name = beats[activeIndex]?.name;
    if (name) {
      setActiveBeat(name, getProgress);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  // Start transparent and fade the live canvas in over the poster so the hero
  // never pops in over an empty beat on refresh.
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 600ms ease';

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
  let firstFrameRendered = false;

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
    // Camera keyframes are authored relative to each beat's local origin;
    // shift them into world space by the beat's z so the camera flies through
    // the laid-out world rather than snapping between overlapping scenes.
    const zOff = beat.z;
    tmpPos.set(cs.pos[0], cs.pos[1], cs.pos[2] + zOff);
    tmpLook.set(cs.look[0], cs.look[1], cs.look[2] + zOff);

    const lerp = Math.min(1, dt * 6);
    curPos.lerp(tmpPos, lerp);
    curLook.lerp(tmpLook, lerp);
    camera.position.copy(curPos);
    camera.lookAt(curLook);
    camera.fov += (cs.fov - camera.fov) * lerp;
    camera.updateProjectionMatrix();

    // Continuity: keep the active beat plus its immediate neighbours visible
    // so the previous/next scene stays faintly present during a transition
    // (no blank frame, no hard cut).
    beats.forEach((b, i) => {
      b.object.visible = Math.abs(i - activeIndex) <= 1;
    });

    beat.tick(elapsed, dt, pointer, rm, progress);
    renderer.render(world, camera);
    if (!firstFrameRendered) {
      firstFrameRendered = true;
      canvas.style.opacity = '1';
      opts.onReady?.();
    }
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
    // Stream in the now-active beat and its immediate neighbours so the scene
    // is ready before the camera arrives (no blank frame mid-scroll).
    builtStage.ensureBuilt(idx);
    builtStage.ensureBuilt(idx - 1);
    builtStage.ensureBuilt(idx + 1);
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
    setTheme: (t: ThemeName) => rebuild(t),
    start,
    stop,
    resize,
    getCanvas: () => canvas,
    dispose,
  };
}
