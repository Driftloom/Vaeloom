/**
 * Scene theming — both themes designed intentionally, mirroring
 * globals.css landing tokens. Hex values match the CSS custom
 * properties so WebGL and DOM stay visually identical.
 */

export type ScenePalette = {
  /** Wireframe / structural lines */
  structure: string;
  /** Primary glow (indigo core) */
  core: string;
  /** Data-stream accent (cyan) */
  streamA: string;
  /** Memory-link accent (fuchsia) */
  link: string;
  /** Graph base edge */
  edge: string;
  /** Graph highlighted edge */
  edgeHot: string;
  /** Node fill by semantic type */
  nodes: Record<string, string>;
  /** Soft particle tint */
  dust: string;
};

const DARK: ScenePalette = {
  structure: '#7c8cf8',
  core: '#818cf8',
  streamA: '#22d3ee',
  link: '#e879f9',
  edge: '#2c2c34',
  edgeHot: '#a5b4fc',
  nodes: {
    person: '#ec4899',
    skill: '#8b5cf6',
    project: '#3b82f6',
    org: '#6366f1',
    document: '#f59e0b',
    event: '#f97316',
    entity: '#06b6d4',
    topic: '#10b981',
  },
  dust: '#a5b4fc',
};

const LIGHT: ScenePalette = {
  structure: '#4f46e5',
  core: '#4f46e5',
  streamA: '#0891b2',
  link: '#c026d3',
  edge: '#c4c9de',
  edgeHot: '#4338ca',
  nodes: {
    person: '#be185d',
    skill: '#7c3aed',
    project: '#1d4ed8',
    org: '#4338ca',
    document: '#b45309',
    event: '#c2410c',
    entity: '#0e7490',
    topic: '#047857',
  },
  dust: '#6366f1',
};

export function scenePalette(theme: 'dark' | 'light'): ScenePalette {
  return theme === 'light' ? LIGHT : DARK;
}

/**
 * Procedural radial-gradient sprite texture — soft glow without
 * postprocessing. Generated once per color on a tiny canvas.
 */
let glowTexCache: Map<string, HTMLCanvasElement> | null = null;

export function glowTexture(color: string): HTMLCanvasElement {
  if (!glowTexCache) glowTexCache = new Map();
  const hit = glowTexCache.get(color);
  if (hit) return hit;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.35, `${color}66`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowTexCache.set(color, canvas);
  return canvas;
}

/** Deterministic PRNG so layouts are stable between renders/builds. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Per-agent hues shared between the WebGL orbit and DOM legends.
 * Lives here (not in the canvas chunk) so sections never pull
 * three.js into their bundles just for a color map.
 */
export const AGENT_HUES: Record<string, string> = {
  orchestrator: '#818cf8',
  organization: '#22d3ee',
  memory: '#e879f9',
  resume: '#34d399',
  ats: '#fbbf24',
  jobsearch: '#f97316',
  gmail: '#f87171',
  scheduler: '#38bdf8',
};
