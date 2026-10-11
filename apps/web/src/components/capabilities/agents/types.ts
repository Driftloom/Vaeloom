import {
  CAPABILITY_MAX_REACT_ROUNDS_KEY,
  MAX_REACT_ROUNDS,
  MIN_REACT_ROUNDS,
} from '@/lib/api-client';

export type AutonomyMode = 'suggest' | 'autonomous' | 'approval_required';
export type DetailSubTab = 'mission' | 'scopes' | 'tools' | 'contract' | 'validate';

export { AgentGlyph } from './AgentGlyph';

/**
 * Per-agent accent hue.
 *
 * `globals.css` declares `--agent-hue-*` once per theme, and it is the only
 * accent in the app that already has a light and a high-contrast variant.
 */
export const AGENT_HUE_BY_NAME: Readonly<Record<string, string>> = {
  organization: 'organization',
  memory: 'memory',
  resume: 'resume',
  ats: 'ats',
  job_search: 'jobsearch',
  gmail: 'gmail',
  scheduler: 'scheduler',
};

export interface AgentHue {
  color: string;
  background: string;
  border: string;
}

export const NEUTRAL_HUE: AgentHue = {
  color: 'var(--text-secondary)',
  background: 'var(--surface-elevated)',
  border: 'var(--border)',
};

export function agentHue(name: string): AgentHue {
  const key = AGENT_HUE_BY_NAME[name.toLowerCase()];
  if (!key) return NEUTRAL_HUE;
  const color = `var(--agent-hue-${key})`;
  return {
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `color-mix(in srgb, ${color} 32%, transparent)`,
  };
}

export function formatAgentTitle(name: string): string {
  const words = name.replace(/[_-]+/g, ' ').trim();
  if (!words) return 'Agent';
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} Agent`;
}

export const AUTONOMY_OPTIONS: { value: AutonomyMode; label: string; hint: string }[] = [
  { value: 'suggest', label: 'Suggest Only', hint: 'Proposes actions and waits for a human.' },
  {
    value: 'approval_required',
    label: 'Approval Gated',
    hint: 'Acts, but every consequential step needs explicit approval.',
  },
  { value: 'autonomous', label: 'Autonomous', hint: 'Acts without per-step approval.' },
];

export const AUTONOMY_VALUES: ReadonlySet<string> = new Set<AutonomyMode>([
  'suggest',
  'autonomous',
  'approval_required',
]);

export function coerceAutonomy(value: string | undefined, fallback: AutonomyMode): AutonomyMode {
  return value && AUTONOMY_VALUES.has(value) ? (value as AutonomyMode) : fallback;
}

export const DEFAULT_REACT_ROUNDS = 5;

export const REACT_ROUNDS_PRECEDENCE = `The run resolves the budget in this order: this workspace's capability row (config.${CAPABILITY_MAX_REACT_ROUNDS_KEY}) → the agent's AgentCard → the server's AGENT_MAX_REACT_ROUNDS setting → 5. Values outside ${MIN_REACT_ROUNDS}–${MAX_REACT_ROUNDS} are clamped server-side and logged, so the number below is refused rather than silently rounded.`;

export interface ReactRoundsSetting {
  /** The value the server confirmed, or null when it holds none. */
  rounds: number | null;
  saving: boolean;
  /** Why the current input cannot be written, or the server's own error. */
  issue: string | null;
}
