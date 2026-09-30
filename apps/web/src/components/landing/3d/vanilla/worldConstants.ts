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
export const BEAT_COUNT = 15;

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
// Career is a pipeline the camera looks down: pulled back, near-axis, so the
// stage reads as depth rather than as a subject you have to inspect.
const careerCam: CameraKey = { pos: [0, 0.6, 8.8], look: [0, 0, 0], fov: 46 };
const schedulerCam: CameraKey = { pos: [0, 1.5, 7.2], look: [0, 0.2, 0], fov: 50 };
// Trust is the calmest beat on the page — camera holds still and wide so the
// permission table stays the loudest thing in the section.
const trustCam: CameraKey = { pos: [0, 1.6, 9.2], look: [0, 0.2, 0], fov: 44 };
// Compounding sits in a tall framed box, so the camera frames the lattice as a
// monument rather than a distant object. Kept close to the Z axis: pushing far
// off-axis skewed the lattice into one corner of the frame and left the rest
// of the box empty.
const growthCam: CameraKey = { pos: [3.0, 3.2, 8.8], look: [0, 2.1, 0], fov: 46 };
// FAQ is the reading beat: widest, flattest framing, dimmest scene.
const faqCam: CameraKey = { pos: [0, 1.2, 10.5], look: [0, 0, 0], fov: 42 };
const ctaCam: CameraKey = heroCam; // Return to hero-like calm

/**
 * All beats in scroll order.
 * Index 0 = hero (top of page), index N = CTA (bottom).
 * z positions are computed from BEAT_SPACING.
 *
 * ORDER IS LOAD-BEARING: it must mirror the DOM order of the sections that
 * mount a `StageSlot`, because the stage walks this array by index to decide
 * which scene is built, which neighbours stream in, and how far the camera
 * travels. Adding or reordering a section means reordering this table too.
 *
 * The active beat is resolved from live element geometry (see StageProvider),
 * NOT from a scroll-position table — a static table drifts out of sync with
 * the real layout the moment any section's height changes.
 */
export const BEATS: BeatDef[] = [
  { id: 'hero', z: 0, camera: heroCam, class: 'A' },
  { id: 'problem', z: -BEAT_SPACING, camera: problemCam, class: 'A' },
  { id: 'difference', z: -BEAT_SPACING * 2, camera: differenceCam, class: 'A' },
  { id: 'journey', z: -BEAT_SPACING * 3, camera: journeyCam, hasPath: true, class: 'A' },
  { id: 'memory', z: -BEAT_SPACING * 4, camera: memoryCam, class: 'A' },
  { id: 'agents', z: -BEAT_SPACING * 5, camera: agentsCam, class: 'A' },
  { id: 'connectors', z: -BEAT_SPACING * 6, camera: connectorsCam, class: 'A' },
  { id: 'organization', z: -BEAT_SPACING * 7, camera: organizationCam, class: 'A' },
  { id: 'resume', z: -BEAT_SPACING * 8, camera: resumeCam, class: 'A' },
  { id: 'career', z: -BEAT_SPACING * 9, camera: careerCam, class: 'A' },
  { id: 'scheduler', z: -BEAT_SPACING * 10, camera: schedulerCam, class: 'A' },
  { id: 'trust', z: -BEAT_SPACING * 11, camera: trustCam, class: 'A' },
  { id: 'growth', z: -BEAT_SPACING * 12, camera: growthCam, class: 'A' },
  { id: 'faq', z: -BEAT_SPACING * 13, camera: faqCam, class: 'A' },
  { id: 'cta', z: -BEAT_SPACING * 14, camera: ctaCam, class: 'A' },
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

// ─── COLORS ────────────────────────────────────────────────────

/**
 * Color lives in `../scene-utils` and nowhere else.
 *
 * This file used to carry a second copy of the scene palette, the node-type
 * map, and the agent hue map. Nothing read them — every scene imports
 * `scenePalette()` / `AGENT_HUES` from scene-utils — so the two copies drifted
 * and a light-mode fix had to be applied twice to land. Do not re-add them.
 */

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
