/**
 * AgentsView's ReAct round budget.
 *
 * The panel this suite covers carried the sentence "No agent runtime reads this
 * field yet, so it is a recorded setting, not an enforced guardrail." That is no
 * longer true: `services/capability_runtime_config.resolve_agent_max_rounds`
 * reads `config.max_react_rounds` off this workspace's `category='agent'` row
 * first, ahead of the agent card and the deployment setting.
 *
 * Two things the previous version got wrong that these tests pin down:
 *
 *  1. It WROTE the wrong key. It sent `config: { maxReActRounds: n }`, which is
 *     neither the stored name nor the transformed one (`max_react_rounds` in,
 *     `maxReactRounds` out — `toCamelCase` uppercases one letter per underscore).
 *     The resolver reads `max_react_rounds` and nothing else, so the value it
 *     stored was never honoured.
 *  2. It READ the wrong place. `selectedAgent.metadata['maxReActRounds']` cannot
 *     work, because the page's mapping of a server row builds a `CapabilityItem`
 *     with no `metadata` at all — so the field always reported "not saved" after
 *     a successful write.
 *
 * And the clamp: `_coerce` accepts a real integer in [1, 12] and either rejects or
 * clamps everything else with a log. A control that silently coerces produces a
 * number the run never used, so the input refuses instead.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { AgentsView } from '../AgentsView';
import type { CapabilityItem } from '@/lib/capabilities-data';

// ─── Server doubles ──────────────────────────────────────────────────────────

const agentItem = (name: string, overrides: Partial<CapabilityItem> = {}): CapabilityItem => ({
  id: `row-${name}`,
  name,
  category: 'agents',
  tags: [],
  description: `${name} agent`,
  enabled: true,
  source: 'built-in',
  usageCount: 0,
  lastUsedAt: null,
  markdownDoc: '',
  ...overrides,
});

/** `GET /capabilities?category=agent` rows, with the config bag camelCased. */
function agentRow(
  name: string,
  config: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `row-${name}`,
    workspaceId: 'ws-agents-1',
    name,
    category: 'agent' as const,
    description: `${name} agent`,
    version: '1.0.0',
    status: 'ACTIVE',
    enabled: true,
    author: 'Vaeloom',
    type: 'custom',
    runtime: 'system',
    config,
    usageCount: 0,
    lastUsedAt: null,
    ...overrides,
  };
}

const server = {
  agentRows: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ id: string; body: Record<string, unknown> }>,
  failure: null as Error | null,
};

/** Bumped per test so each one gets its own SWR cache key. */
let workspaceSeq = 0;

/**
 * What the client receives back.
 *
 * The wire key is `max_react_rounds`; `transformKeys()` camelCases it to
 * `maxReactRounds` on every response, which is the name `capabilityConfigReactRounds`
 * reads. A double that handed back the stored snake_case bag would make every
 * reader in the component look broken.
 *
 * `mock`-prefixed because a `jest.mock` factory may only close over names that
 * begin with `mock`.
 */
const mockToWire = function mockToWire(config: Record<string, unknown>): Record<string, unknown> {
  return 'max_react_rounds' in config
    ? { ...config, maxReactRounds: config['max_react_rounds'] }
    : config;
};

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    agentCatalogApi: {
      get: jest.fn(async () => ({ agents: [], total: 0 })),
    },
    capabilitiesApi: {
      list: jest.fn(async (category?: string) =>
        category === 'agent'
          ? server.agentRows.map((row) => ({
              ...row,
              config: mockToWire(row['config'] as Record<string, unknown>),
            }))
          : [],
      ),
      update: jest.fn(async (id: string, body: Record<string, unknown>) => {
        if (server.failure) throw server.failure;
        server.updates.push({ id, body });
        // The real PATCH merges into the stored config, and the row that comes
        // back on the next read carries it. A double that dropped the patch would
        // make the component look like it lost a value it had saved.
        const patch = (body['config'] as Record<string, unknown>) ?? {};
        const row = server.agentRows.find((entry) => entry['name'] === 'resume');
        const config = { ...((row?.['config'] as Record<string, unknown>) ?? {}), ...patch };
        if (row) row['config'] = config;
        return agentRow('resume', mockToWire(config), { id });
      }),
      test: jest.fn(),
    },
  };
});

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * A fresh workspace id per test.
 *
 * The view reads its rows through SWR under `['agent-capability-rows', workspaceId]`,
 * and that cache outlives `jest.clearAllMocks()`. Sharing one id across the file
 * would let the first test's row answer every later one.
 */
function renderView(agents: CapabilityItem[] = [agentItem('resume')]) {
  workspaceSeq += 1;
  return render(
    <AgentsView
      agents={agents}
      workspaceId={`ws-agents-${workspaceSeq}`}
      onToggleAgent={jest.fn()}
      initialAgentName="resume"
    />,
  );
}

function roundsInput(): HTMLInputElement {
  return screen.getByLabelText('Max rounds') as HTMLInputElement;
}

function roundsBadge(): HTMLElement {
  return screen.getByText(/^Saved: \d+$|^Not set on this row$|^Not saved$/);
}

function panel(): HTMLElement {
  return screen.getByRole('group', { name: 'ReAct round budget' });
}

async function waitForRows(): Promise<void> {
  await waitFor(() => expect(screen.getByText(/Max rounds/)).toBeInTheDocument());
}

function type(value: string): void {
  fireEvent.change(roundsInput(), { target: { value } });
}

function commit(): void {
  fireEvent.blur(roundsInput());
}

beforeEach(() => {
  jest.clearAllMocks();
  server.agentRows = [];
  server.updates = [];
  server.failure = null;
});

// ─── Reading the row ─────────────────────────────────────────────────────────

describe('AgentsView ReAct round budget: reading', () => {
  it('seeds the field from the row the resolver actually reads', async () => {
    server.agentRows = [agentRow('resume', { maxReactRounds: 8 })];
    renderView();
    await waitForRows();

    await waitFor(() => expect(roundsInput()).toHaveValue(8));
    expect(roundsBadge()).toHaveTextContent('Saved: 8');
    expect(panel()).toHaveTextContent('Stored as');
    expect(panel()).toHaveTextContent('max_react_rounds=8');
  });

  it('says nothing is set when the row carries no value, and does not present the default as saved', async () => {
    server.agentRows = [agentRow('resume', { archetype: 'specialist' })];
    renderView();
    await waitForRows();

    expect(roundsBadge()).toHaveTextContent('Not set on this row');
    expect(panel()).toHaveTextContent('this row contributes nothing');
    expect(panel()).toHaveTextContent('form default, not a stored value');
  });

  it('reports a stored value the resolver would reject instead of showing it as the budget', async () => {
    // 30 is above MAX_MAX_REACT_ROUNDS, so the run clamps it to 12 with a log. The
    // form must not present 30 as the number the run used.
    server.agentRows = [agentRow('resume', { maxReactRounds: 30 })];
    renderView();
    await waitForRows();

    expect(roundsBadge()).toHaveTextContent('Not set on this row');
    expect(roundsInput()).toHaveValue(5);
    expect(panel()).toHaveTextContent('max_react_rounds=30');
    expect(panel()).toHaveTextContent('which the resolver rejects');
    expect(panel()).toHaveTextContent('clamps anything above 12 down to 12');
  });

  it('reports a stored boolean as rejected, because bool is an int subclass', async () => {
    server.agentRows = [agentRow('resume', { maxReactRounds: true })];
    renderView();
    await waitForRows();

    expect(panel()).toHaveTextContent('which the resolver rejects');
    expect(panel()).toHaveTextContent('the server rejects a boolean');
  });

  it('says the row could not be read rather than claiming nothing is set', async () => {
    const mocked = jest.requireMock('@/lib/api-client') as {
      capabilitiesApi: { list: jest.Mock };
    };
    mocked.capabilitiesApi.list.mockRejectedValueOnce(new Error('502 Bad Gateway'));
    renderView();
    await waitForRows();

    expect(panel()).toHaveTextContent('could not be read');
    expect(panel()).toHaveTextContent('502 Bad Gateway');
    expect(panel()).toHaveTextContent('what the row holds is unknown');
  });

  it('states the real precedence and drops the "nothing reads this" claim', async () => {
    server.agentRows = [agentRow('resume', { maxReactRounds: 5 })];
    renderView();
    await waitForRows();

    expect(panel()).toHaveTextContent("this workspace's capability row");
    expect(panel()).toHaveTextContent("the agent's AgentCard");
    expect(panel()).toHaveTextContent('AGENT_MAX_REACT_ROUNDS');
    expect(document.body.textContent ?? '').not.toContain('No agent runtime reads this field yet');
    expect(document.body.textContent ?? '').not.toContain('not an enforced guardrail');
  });
});

// ─── Writing the row ─────────────────────────────────────────────────────────

describe('AgentsView ReAct round budget: writing', () => {
  it('writes config.max_react_rounds, the key the resolver reads', async () => {
    server.agentRows = [agentRow('resume', {})];
    renderView();
    await waitForRows();

    type('7');
    commit();

    await waitFor(() => expect(server.updates).toHaveLength(1));
    expect(server.updates[0]).toEqual({
      id: 'row-resume',
      body: { config: { max_react_rounds: 7 } },
    });
    // The camelCase spelling is the transform's OUTPUT shape, not the stored key.
    expect(server.updates[0].body['config']).not.toHaveProperty('maxReactRounds');
  });

  it('reports the confirmed value as saved only after the server echoes it back', async () => {
    server.agentRows = [agentRow('resume', {})];
    renderView();
    await waitForRows();

    type('9');
    commit();

    await waitFor(() => expect(roundsBadge()).toHaveTextContent('Saved: 9'));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', title: 'ReAct round budget set to 9' }),
    );
  });

  it('does not claim a value as saved when the response does not carry it', async () => {
    server.agentRows = [agentRow('resume', {})];
    renderView();
    await waitForRows();

    // A server that answers the write with a row that lacks the value must leave
    // the form un-saved rather than showing the operator's number as the budget.
    const mocked = jest.requireMock('@/lib/api-client') as {
      capabilitiesApi: { update: jest.Mock };
    };
    mocked.capabilitiesApi.update.mockImplementationOnce(async () => agentRow('resume', {}));

    type('4');
    commit();

    await waitFor(() => expect(roundsBadge()).toHaveTextContent('Not saved'));
    expect(mocked.capabilitiesApi.update).toHaveBeenCalledTimes(1);
    expect(mocked.capabilitiesApi.update.mock.calls[0][1]).toEqual({
      config: { max_react_rounds: 4 },
    });
    expect(panel()).toHaveTextContent('the row does not hold 4');
  });

  it('shows the server error and keeps the previous value when the write is rejected', async () => {
    server.agentRows = [agentRow('resume', { maxReactRounds: 5 })];
    renderView();
    await waitForRows();

    server.failure = Object.assign(new Error('Capability not found'), { status: 404 });
    type('6');
    commit();

    await waitFor(() => expect(roundsBadge()).toHaveTextContent('Not saved'));
    expect(panel()).toHaveTextContent('Capability not found');
    expect(panel()).toHaveTextContent('Nothing was written');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', title: 'Round budget not saved' }),
    );
  });

  it('issues no request when the value did not change', async () => {
    server.agentRows = [agentRow('resume', { maxReactRounds: 6 })];
    renderView();
    await waitForRows();
    await waitFor(() => expect(roundsInput()).toHaveValue(6));

    type('6');
    commit();

    await waitFor(() => expect(roundsBadge()).toHaveTextContent('Saved: 6'));
    expect(server.updates).toHaveLength(0);
  });
});

// ─── Client-side validation ──────────────────────────────────────────────────

describe('AgentsView ReAct round budget: refused input', () => {
  /**
   * Every one of these is refused by `_coerce` or clamped with a log.
   *
   * No non-numeric-text case: `type="number"` sanitises it to an empty value in the
   * DOM, so the input can only ever hand this component `''` or a number. The
   * non-numeric path is still reachable — a stored row can hold one — and is
   * covered against `reactRoundsAcceptance` in the api-client suite.
   */
  const refused: Array<[string, string, RegExp]> = [
    ['0', 'zero', /clamps anything below 1 up to 1/],
    ['-3', 'A negative', /clamps anything below 1 up to 1/],
    ['2.5', 'A fraction', /not a whole number of rounds/],
    ['13', 'Above the ceiling', /clamps anything above 12 down to 12/],
    ['999', 'An absurd value', /clamps anything above 12 down to 12/],
    ['', 'An empty field', /Empty; the server treats this as unset/],
  ];

  it.each(refused)(
    'refuses %s (%s) instead of letting the server clamp it',
    async (_v, label, reason) => {
      server.agentRows = [agentRow('resume', { maxReactRounds: 5 })];
      renderView();
      await waitForRows();

      type(_v);
      commit();

      await waitFor(() => expect(panel()).toHaveTextContent(reason));
      expect(server.updates).toHaveLength(0);
      expect(roundsBadge()).toHaveTextContent('Not saved');
      expect(panel()).toHaveTextContent('Nothing was written');
      // The failure is attributed to the input, not to the server.
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'Round budget not saved' }),
      );
      void label;
    },
  );

  it('accepts both ends of the accepted range', async () => {
    server.agentRows = [agentRow('resume', {})];
    renderView();
    await waitForRows();

    type('1');
    commit();
    await waitFor(() => expect(server.updates).toHaveLength(1));
    expect(server.updates[0].body).toEqual({ config: { max_react_rounds: 1 } });

    type('12');
    commit();
    await waitFor(() => expect(server.updates).toHaveLength(2));
    expect(server.updates[1].body).toEqual({ config: { max_react_rounds: 12 } });
    expect(within(panel()).queryByText(/Nothing was written/)).toBeNull();
  });

  it('bounds the input to the range the runtime honours', async () => {
    server.agentRows = [agentRow('resume', { maxReactRounds: 5 })];
    renderView();
    await waitForRows();

    expect(roundsInput()).toHaveAttribute('min', '1');
    expect(roundsInput()).toHaveAttribute('max', '12');
    expect(roundsInput()).toHaveAttribute('step', '1');
  });
});
