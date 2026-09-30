import { fetchAgentCatalog, fetchSlashCommands } from '../chat-api';
import { api } from '@/lib/api';
import { agentCatalogApi } from '@/lib/api-client';

/**
 * `chat-api.ts` is the chat's only data layer, and its whole job is honesty about
 * degradation. The previous implementation fetched `/agents/commands` with a bare
 * `fetch()` against a hardcoded `/api/v1` prefix and swallowed every failure with
 * `.catch(() => {})`, so the user saw a hardcoded 11-command list that was
 * indistinguishable from live data.
 *
 * Two things are asserted here, and both are load-bearing:
 *   - the request goes through `api.get` (API_BASE + API_PREFIX + transformKeys +
 *     CSRF + ApiError normalisation), never a hand-built URL;
 *   - a failure returns `state: 'error'`, never a silent fallback.
 */

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

jest.mock('@/lib/api-client', () => ({
  agentCatalogApi: { get: jest.fn() },
}));

const apiGet = api.get as unknown as jest.Mock;
const catalogGet = agentCatalogApi.get as unknown as jest.Mock;

const WORKSPACE = 'ws/1';

interface RawCommandShape {
  trigger?: string;
  desc?: string;
  description?: string;
  agent?: string;
  agent_name?: string;
  color?: string;
}

function commandsResponse(commands: RawCommandShape[]): { commands: RawCommandShape[] } {
  return { commands };
}

function catalogAgent(name: string): Record<string, unknown> {
  return {
    name,
    mission: `do ${name} things`,
    tools: [],
    toolNames: [],
    memoryScopes: { readTypes: [], writeTypes: [] },
    defaultAutonomy: 'suggest',
    isCanonical: true,
    skills: [],
    category: 'general',
  };
}

/** An `AbortError` exactly as the DOM reports it — `chat-api` branches on the instance. */
function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

describe('chat-api', () => {
  // This jsdom build ships no global `fetch`, which is precisely the point: a bare
  // `fetch('/api/v1/agents/commands')` cannot even be written here. One is installed
  // anyway so a regression to a raw fetch fails loudly instead of passing by
  // accident.
  let bareFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    bareFetch = jest.fn(() => Promise.reject(new Error('the raw fetch path must stay unused')));
    (globalThis as unknown as { fetch?: unknown }).fetch = bareFetch;
  });

  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  describe('fetchSlashCommands', () => {
    it('reports ready and normalises the backend command list', async () => {
      apiGet.mockResolvedValue(
        commandsResponse([
          { trigger: '/resume', desc: 'Build a resume', agent: 'resume', color: 'text-sky-300' },
          {
            trigger: '/jobs',
            description: 'Search jobs',
            agent_name: 'ats',
            color: 'text-violet-300',
          },
        ]),
      );

      const result = await fetchSlashCommands(WORKSPACE);

      expect(result.state).toBe('ready');
      expect(result.error).toBeUndefined();
      expect(result.commands).toEqual([
        {
          trigger: '/resume',
          desc: 'Build a resume',
          agent: 'resume',
          color: 'text-sky-300',
        },
        { trigger: '/jobs', desc: 'Search jobs', agent: 'ats', color: 'text-violet-300' },
      ]);
    });

    it('preserves the backend-supplied agent colour rather than duplicating the palette', async () => {
      apiGet.mockResolvedValue(
        commandsResponse([
          {
            trigger: '/resume',
            desc: 'x',
            agent: 'resume',
            color: 'bg-emerald-500/10 text-emerald-300',
          },
        ]),
      );

      const result = await fetchSlashCommands(WORKSPACE);

      expect(result.commands[0]?.color).toBe('bg-emerald-500/10 text-emerald-300');
    });

    it('routes the request through api.get so base URL, key transform and CSRF all apply', async () => {
      apiGet.mockResolvedValue(
        commandsResponse([{ trigger: '/resume', desc: 'x', agent: 'resume' }]),
      );

      const ac = new AbortController();
      await fetchSlashCommands(WORKSPACE, ac.signal);

      expect(apiGet).toHaveBeenCalledTimes(1);
      const [path, init] = apiGet.mock.calls[0] as [string, { signal?: AbortSignal }];
      expect(path).toBe('/agents/commands?workspace_id=ws%2F1');
      // The prefix is applied by api.get, so the path must be relative.
      expect(path).not.toContain('/api/v1');
      expect(init?.signal).toBe(ac.signal);
      expect(bareFetch).not.toHaveBeenCalled();
    });

    it('drops entries the backend left incomplete instead of rendering broken chips', async () => {
      apiGet.mockResolvedValue(
        commandsResponse([
          { trigger: '/resume', desc: 'x', agent: 'resume' },
          { trigger: '', desc: 'no trigger', agent: 'ats' },
          { trigger: '/jobs', desc: 'no agent', agent: '' },
          { trigger: '/cover', desc: 'ok', agent: 'resume' },
        ]),
      );

      const result = await fetchSlashCommands(WORKSPACE);

      expect(result.state).toBe('ready');
      expect(result.commands.map((c) => c.trigger)).toEqual(['/resume', '/cover']);
    });

    it('reports error when the request throws, instead of a silent hardcoded fallback', async () => {
      apiGet.mockRejectedValue(new Error('502 Bad Gateway'));

      const result = await fetchSlashCommands(WORKSPACE);

      expect(result.state).toBe('error');
      expect(result.commands).toEqual([]);
      expect(result.error).toBe('502 Bad Gateway');
    });

    it('reports error for a non-Error rejection without claiming success', async () => {
      apiGet.mockRejectedValue('connection reset');

      const result = await fetchSlashCommands(WORKSPACE);

      expect(result.state).toBe('error');
      expect(result.commands).toEqual([]);
      expect(result.error).toBe('Could not load agent commands.');
    });

    it('reports error when a successful response carries zero valid commands', async () => {
      apiGet.mockResolvedValue(commandsResponse([]));

      const empty = await fetchSlashCommands(WORKSPACE);
      expect(empty.state).toBe('error');
      expect(empty.commands).toEqual([]);

      apiGet.mockResolvedValue({ commands: 'not-an-array' });
      const malformed = await fetchSlashCommands(WORKSPACE);
      expect(malformed.state).toBe('error');
      expect(malformed.commands).toEqual([]);
    });

    it('reports loading on abort, because an aborted load is not a failure', async () => {
      apiGet.mockRejectedValue(abortError());

      const result = await fetchSlashCommands(WORKSPACE);

      expect(result.state).toBe('loading');
      expect(result.error).toBeUndefined();
    });
  });

  describe('fetchAgentCatalog', () => {
    it('reports ready with the published agents', async () => {
      catalogGet.mockResolvedValue({
        agents: [catalogAgent('resume'), catalogAgent('ats')],
        total: 2,
        canonicalCount: 2,
        toolDefinitions: {},
      });

      const result = await fetchAgentCatalog();

      expect(result.state).toBe('ready');
      expect(result.error).toBeUndefined();
      expect(result.agents.map((a) => a.name)).toEqual(['resume', 'ats']);
    });

    it('goes through agentCatalogApi rather than a hand-built catalog URL', async () => {
      catalogGet.mockResolvedValue({ agents: [catalogAgent('resume')] });

      await fetchAgentCatalog();

      expect(catalogGet).toHaveBeenCalledTimes(1);
      expect(bareFetch).not.toHaveBeenCalled();
    });

    it('reports agents: [] and error when the request fails', async () => {
      catalogGet.mockRejectedValue(new Error('503 catalog unavailable'));

      const result = await fetchAgentCatalog();

      expect(result.state).toBe('error');
      expect(result.agents).toEqual([]);
      expect(result.error).toBe('503 catalog unavailable');
    });

    it('treats a successful response with an empty agent list as a failed load', async () => {
      // "0 agents available" printed as fact is a lie about a malformed payload or
      // an unprovisioned workspace, not a successful catalog read.
      catalogGet.mockResolvedValue({
        agents: [],
        total: 0,
        canonicalCount: 0,
        toolDefinitions: {},
      });

      const result = await fetchAgentCatalog();

      expect(result.state).toBe('error');
      expect(result.agents).toEqual([]);
      expect(result.error).toBe('No agents published for this workspace.');
    });

    it('treats a missing agents array as a failed load', async () => {
      catalogGet.mockResolvedValue({ total: 0 });

      const result = await fetchAgentCatalog();

      expect(result.state).toBe('error');
      expect(result.agents).toEqual([]);
    });

    it('reports loading on abort, not an error', async () => {
      catalogGet.mockRejectedValue(abortError());

      const result = await fetchAgentCatalog();

      expect(result.state).toBe('loading');
      expect(result.error).toBeUndefined();
    });
  });
});
