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

/**
 * Light theme is DESIGNED, not inverted.
 *
 * Dark mode gets saturated hues against near-black: the color is the only
 * thing carrying the image, so it can be loud. Light mode inverts that — the
 * background is the thing carrying the image, so hue drops to a supporting
 * role and every value moves toward the tint it sits on. Two rules:
 *
 *  1. Nothing structural is darker than ~`#6366f1`. On white, a saturated
 *     magenta or cyan particle stops being atmosphere and becomes confetti,
 *     and once it drifts across dark headline text it wrecks legibility.
 *  2. `dust` and `nodes` are the worst offenders because they are the small,
 *     high-count elements — they carry the most visual weight per pixel and
 *     are the ones that land on top of type.
 *
 * So: hues are desaturated toward indigo, values are held in a mid band
 * (roughly L* 45-60) rather than pushed dark, and the near-accents that read
 * as "energy" in dark mode (fuchsia link, cyan stream) are pulled back to
 * their indigo family. The scene reads as depth, not as glitter.
 */
const LIGHT: ScenePalette = {
  structure: '#6366f1',
  core: '#4f46e5',
  // Cyan stays a cyan, but a deep one: it has to read as a second channel
  // without competing with `core` for attention.
  streamA: '#0e7490',
  // Fuchsia is pulled almost all the way to indigo. This is the single
  // biggest legibility win in light mode — it was the loudest thing on the
  // page and it crossed the hero headline.
  link: '#7c3aed',
  edge: '#d7dbec',
  edgeHot: '#4338ca',
  nodes: {
    person: '#be185d',
    skill: '#6d28d9',
    project: '#1d4ed8',
    org: '#4338ca',
    document: '#a16207',
    event: '#c2410c',
    entity: '#0e7490',
    topic: '#047857',
  },
  dust: '#818cf8',
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

/**
 * Multi-stop radial glow — hot core falling off through the tint color.
 * Used for the plasma core's layered "fake bloom" sprites. Cached per
 * color/hot pair; the cache owns the canvas, callers never dispose.
 */
let glowStopsCache: Map<string, HTMLCanvasElement> | null = null;

export function glowTextureStops(color: string, hot?: string): HTMLCanvasElement {
  const key = `${color}|${hot ?? ''}`;
  if (!glowStopsCache) glowStopsCache = new Map();
  const hit = glowStopsCache.get(key);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    if (hot) {
      g.addColorStop(0, hot);
      g.addColorStop(0.22, color);
      g.addColorStop(0.45, `${color}66`);
      g.addColorStop(0.75, `${color}22`);
    } else {
      g.addColorStop(0, color);
      g.addColorStop(0.3, `${color}88`);
      g.addColorStop(0.65, `${color}2e`);
    }
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowStopsCache.set(key, canvas);
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
