import { api } from '@/lib/api';
import { agentCatalogApi, type CatalogAgent } from '@/lib/api-client';
import type { SlashCommand } from './types';

/**
 * Chat data layer.
 *
 * The previous implementation fetched `/agents/commands` with a bare `fetch()`:
 *   - hardcoded the `/api/v1` prefix, so it 404'd against the Next.js origin in any
 *     cross-origin deployment where `NEXT_PUBLIC_API_URL` pointed off-site
 *   - skipped `transformKeys`, so any snake_case field added server-side would
 *     arrive unconverted
 *   - skipped CSRF, `ApiError` normalisation and 401 handling
 *   - swallowed every failure with `.catch(() => {})`, so the user was shown a
 *     hardcoded fallback list indistinguishable from real data
 *
 * Everything here routes through `api.*` (API_BASE + API_PREFIX + transformKeys +
 * CSRF + ApiError) and reports degradation instead of hiding it.
 */

export type LoadState = 'loading' | 'ready' | 'error';

export interface CommandsResult {
  commands: SlashCommand[];
  state: LoadState;
  error?: string;
}

export interface CatalogResult {
  agents: CatalogAgent[];
  state: LoadState;
  error?: string;
}

interface RawCommand {
  trigger?: unknown;
  desc?: unknown;
  description?: unknown;
  agent?: unknown;
  agent_name?: unknown;
  color?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Fetch the live slash-command catalog. Returns an explicit state rather than a
 * silent fallback so the UI can say "commands unavailable" instead of pretending.
 */
export async function fetchSlashCommands(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<CommandsResult> {
  try {
    const res = await api.get<{ commands?: RawCommand[] }>(
      `/agents/commands?workspace_id=${encodeURIComponent(workspaceId)}`,
      { signal },
    );
    const raw = Array.isArray(res?.commands) ? res.commands : [];
    const commands: SlashCommand[] = [];
    for (const c of raw) {
      const agent = asString(c.agent) ?? asString(c.agent_name);
      const trigger = asString(c.trigger);
      if (!agent || !trigger) continue;
      commands.push({
        trigger,
        desc: asString(c.desc) ?? asString(c.description) ?? '',
        agent,
        color: asString(c.color),
      });
    }

    if (commands.length === 0) {
      return { commands: [], state: 'error', error: 'No commands published for this workspace.' };
    }
    return { commands, state: 'ready' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { commands: [], state: 'loading' };
    }
    return {
      commands: [],
      state: 'error',
      error: err instanceof Error ? err.message : 'Could not load agent commands.',
    };
  }
}

/** Fetch the agent catalog. An empty list is treated as a failure, not a success. */
export async function fetchAgentCatalog(signal?: AbortSignal): Promise<CatalogResult> {
  try {
    const res = await agentCatalogApi.get();
    const agents = Array.isArray(res?.agents) ? res.agents : [];
    // An empty catalog is never a legitimate success: it means the payload was
    // malformed or the workspace has no agents. Reporting `ready` with zero
    // agents would let the UI print "0 agents available" as if that were a fact
    // rather than a failed load.
    if (agents.length === 0) {
      return { agents: [], state: 'error', error: 'No agents published for this workspace.' };
    }
    return { agents, state: 'ready' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { agents: [], state: 'loading' };
    }
    return {
      agents: [],
      state: 'error',
      error: err instanceof Error ? err.message : 'Could not load the agent catalog.',
    };
  }
}
