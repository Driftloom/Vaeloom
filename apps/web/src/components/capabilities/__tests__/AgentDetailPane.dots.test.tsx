import React from 'react';
import { render } from '@testing-library/react';

import { AgentDetailPane } from '../agents/AgentDetailPane';
import type { CapabilityItem } from '@/lib/capabilities-data';

/**
 * Task 14 dot census site 3 (`AgentDetailPane.tsx` footer). The pane carried a
 * raw `w-1.5 h-1.5 rounded-full bg-success|bg-text-muted` conditional chip.
 *
 * The selector asserts StatusDot's own signature string for its dot node
 * ("relative inline-flex rounded-full ..."), which a raw span can never match —
 * a raw span starts with its size classes, not with that constant prefix. The
 * drawer analog of this assertion lives in
 * ConnectorDetailDrawer.activity.test.tsx, so this file stays name-scoped to
 * its own component.
 */

jest.mock('@/lib/api-client', () => ({
  capabilitiesApi: { update: jest.fn(), test: jest.fn() },
  capabilityConfigReactRounds: jest.fn(() => ({ state: 'absent' })),
  reactRoundsAcceptance: jest.fn(() => ({ ok: true, rounds: 8 })),
  CAPABILITY_MAX_REACT_ROUNDS_KEY: 'max_react_rounds',
  MIN_REACT_ROUNDS: 1,
  MAX_REACT_ROUNDS: 12,
}));

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

/** StatusDot dot node only: the prefix excludes wrappers, badges and raw spans. */
const dotNode = (color: string) =>
  `[class^="relative inline-flex rounded-full"][class*="${color}"]`;

const agentItem = (enabled: boolean): CapabilityItem => ({
  id: 'row-resume-agent',
  name: 'resume',
  category: 'agents',
  tags: [],
  description: 'resume agent',
  enabled,
  source: 'built-in',
  usageCount: 0,
  lastUsedAt: null,
  markdownDoc: '',
});

function renderPane(enabled: boolean) {
  return render(
    <AgentDetailPane
      selectedAgent={agentItem(enabled)}
      selectedCatalogEntry={null}
      selectedCapabilityRow={null}
      catalogLoading={false}
      workspaceId="ws-dots-1"
      agentCapabilityRowsError={null}
      mutateAgentCapabilityRows={jest.fn()}
    />,
  );
}

describe('AgentDetailPane footer status dots', () => {
  it('renders the enabled footer chip as a StatusDot (bg-success)', () => {
    const { container } = renderPane(true);
    expect(container.querySelector(dotNode('bg-success'))).toBeTruthy();
    expect(container.querySelector(dotNode('bg-text-dim'))).toBeNull();
  });

  it('renders the disabled footer chip as a StatusDot (bg-text-dim)', () => {
    const { container } = renderPane(false);
    expect(container.querySelector(dotNode('bg-text-dim'))).toBeTruthy();
    expect(container.querySelector(dotNode('bg-success'))).toBeNull();
  });
});
