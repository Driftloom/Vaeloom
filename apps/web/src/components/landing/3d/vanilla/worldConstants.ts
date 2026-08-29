/**
 * World constants — centralized spatial architecture for the landing 3D experience.
 *
 * Every beat position, camera keyframe, and transition is defined here.
 * Scene files import from this module rather than hardcoding coordinates.
 *
 * COORDINATE SYSTEM:
 * - Z axis: scroll direction (negative = deeper into page)
 * - X axis: horizontal spread
 * - Y axis: vertical height
 * - All beats spaced along -Z by BEAT_SPACING units
 */

import type { QualityTier } from './stageScene';

// ─── WORLD LAYOUT ──────────────────────────────────────────────

/** Spacing between consecutive beats along the Z axis. */
export const BEAT_SPACING = 60;

/** Total number of narrative beats. */
export const BEAT_COUNT = 12;

/** Total world depth (negative Z). */
export const WORLD_DEPTH = -(BEAT_COUNT - 1) * BEAT_SPACING;

// ─── BEAT DEFINITIONS ──────────────────────────────────────────

export interface BeatDef {
  /** Unique beat identifier — matches StageSlot beat prop. */
  id: string;
  /** Position along Z axis. */
  z: number;
  /** Camera keyframe when this beat is active. */
  camera: CameraKey;
  /** Whether this beat has scroll-driven camera path. */
  hasPath?: boolean;
  /** Scroll range (0..1 page progress) where this beat is dominant. */
  scrollRange: [number, number];
  /** Section class: 'A' = primary 3D, 'B' = shared/transitional, 'C' = HTML-first. */
  class: 'A' | 'B' | 'C';
}

export interface CameraKey {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

// Camera keyframes — each beat has a resting camera position.
const heroCam: CameraKey = { pos: [0, 0.9, 7.4], look: [0, 0, 0], fov: 42 };
const problemCam: CameraKey = { pos: [0, 1.2, 8.0], look: [0, 0, 0], fov: 45 };
const differenceCam: CameraKey = { pos: [0, 1.5, 8.5], look: [0, 0.2, 0], fov: 48 };
const journeyCam: CameraKey = { pos: [0, 0, 6.5], look: [0, 0, 1.5], fov: 55 };
const memoryCam: CameraKey = { pos: [0, 1.4, 8.6], look: [0, 0, 0], fov: 48 };
const agentsCam: CameraKey = { pos: [0, 1.9, 6.4], look: [0, 0, 0], fov: 50 };
const connectorsCam: CameraKey = { pos: [0, 2.6, 6.8], look: [0, 0, 0], fov: 52 };
const organizationCam: CameraKey = { pos: [0, 1.8, 7.5], look: [0, 0.5, 0], fov: 50 };
const resumeCam: CameraKey = { pos: [0, 1.2, 7.0], look: [0, 0.3, 0], fov: 48 };
const schedulerCam: CameraKey = { pos: [0, 1.5, 7.2], look: [0, 0.2, 0], fov: 50 };
const growthCam: CameraKey = { pos: [7.5, 5.5, 9.5], look: [0, 1.2, 0], fov: 55 };
const ctaCam: CameraKey = heroCam; // Return to hero-like calm

/**
 * All beats in scroll order.
 * Index 0 = hero (top of page), index N = CTA (bottom).
 * z positions are computed from BEAT_SPACING.
 */
export const BEATS: BeatDef[] = [
  {
    id: 'hero',
    z: 0,
    camera: heroCam,
    hasPath: false,
    scrollRange: [0, 0.06],
    class: 'A',
  },
  {
    id: 'problem',
    z: -BEAT_SPACING,
    camera: problemCam,
    scrollRange: [0.06, 0.11],
    class: 'A',
  },
  {
    id: 'difference',
    z: -BEAT_SPACING * 2,
    camera: differenceCam,
    scrollRange: [0.11, 0.17],
    class: 'A',
  },
  {
    id: 'journey',
    z: -BEAT_SPACING * 3,
    camera: journeyCam,
    hasPath: true,
    scrollRange: [0.17, 0.25],
    class: 'A',
  },
  {
    id: 'memory',
    z: -BEAT_SPACING * 4,
    camera: memoryCam,
    scrollRange: [0.25, 0.35],
    class: 'A',
  },
  {
    id: 'agents',
    z: -BEAT_SPACING * 5,
    camera: agentsCam,
    scrollRange: [0.35, 0.44],
    class: 'A',
  },
  {
    id: 'connectors',
    z: -BEAT_SPACING * 6,
    camera: connectorsCam,
    scrollRange: [0.44, 0.51],
    class: 'A',
  },
  {
    id: 'organization',
    z: -BEAT_SPACING * 7,
    camera: organizationCam,
    scrollRange: [0.51, 0.55],
    class: 'A',
  },
  {
    id: 'resume',
    z: -BEAT_SPACING * 8,
    camera: resumeCam,
    scrollRange: [0.55, 0.64],
    class: 'A',
  },
  {
    id: 'scheduler',
    z: -BEAT_SPACING * 9,
    camera: schedulerCam,
    scrollRange: [0.64, 0.76],
    class: 'A',
  },
  {
    id: 'growth',
    z: -BEAT_SPACING * 10,
    camera: growthCam,
    scrollRange: [0.76, 0.93],
    class: 'A',
  },
  {
    id: 'cta',
    z: -BEAT_SPACING * 11,
    camera: ctaCam,
    scrollRange: [0.93, 1.0],
    class: 'A',
  },
];

// ─── CAMERA TRANSITION ─────────────────────────────────────────

/** Camera lerp factor per second (higher = faster follow). */
export const CAMERA_LERP_SPEED = 6;

/** Transition overlap: how many beats can be partially visible during transition. */
export const TRANSITION_OVERLAP = 0.15;

// ─── QUALITY SCALING ───────────────────────────────────────────

/** DPR caps per tier. */
export const DPR_BY_TIER: Record<QualityTier, [number, number]> = {
  low: [0.75, 1],
  medium: [1, 1.25],
  high: [1, 1.75],
};

/** Particle density multiplier per tier. */
export const DENSITY_BY_TIER: Record<QualityTier, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1,
};

// ─── SCENE COLORS (dark/light) ─────────────────────────────────

export interface ScenePalette {
  structure: string;
  core: string;
  streamA: string;
  link: string;
  edge: string;
  edgeHot: string;
  dust: string;
}

export const PALETTE: Record<'dark' | 'light', ScenePalette> = {
  dark: {
    structure: '#7c8cf8',
    core: '#818cf8',
    streamA: '#22d3ee',
    link: '#e879f9',
    edge: '#2c2c34',
    edgeHot: '#a5b4fc',
    dust: '#a5b4fc',
  },
  light: {
    structure: '#4f46e5',
    core: '#4f46e5',
    streamA: '#0891b2',
    link: '#c026d3',
    edge: '#c4c9de',
    edgeHot: '#4338ca',
    dust: '#6366f1',
  },
};

// ─── NODE TYPE COLORS ──────────────────────────────────────────

export const NODE_COLORS: Record<string, Record<'dark' | 'light', string>> = {
  person: { dark: '#ec4899', light: '#be185d' },
  skill: { dark: '#8b5cf6', light: '#7c3aed' },
  project: { dark: '#3b82f6', light: '#1d4ed8' },
  org: { dark: '#6366f1', light: '#4338ca' },
  document: { dark: '#f59e0b', light: '#b45309' },
  event: { dark: '#f97316', light: '#c2410c' },
  entity: { dark: '#06b6d4', light: '#0e7490' },
  topic: { dark: '#10b981', light: '#047857' },
};

// ─── AGENT HUE MAP ─────────────────────────────────────────────

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

// ─── HELPER ────────────────────────────────────────────────────

/** Get beat definition by id. */
export function getBeat(id: string): BeatDef | undefined {
  return BEATS.find((b) => b.id === id);
}

/** Get beat index by id. */
export function getBeatIndex(id: string): number {
  return BEATS.findIndex((b) => b.id === id);
}

/** Get beat z-position by id. */
export function getBeatZ(id: string): number {
  return getBeat(id)?.z ?? 0;
}
