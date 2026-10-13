import React from 'react';
import { render, screen } from '@testing-library/react';

import { AgentCard } from '../agents/AgentCard';
import type { CapabilityItem } from '@/lib/capabilities-data';

/**
 * The workbench merges SEED_CAPABILITIES into the server list rather than
 * replacing it, so a hardcoded row used to render identically to one the API
 * returned -- same source, same badge, and an enabled toggle that could only
 * ever fail with a 404.
 */

function makeAgent(overrides: Partial<CapabilityItem> = {}): CapabilityItem {
  return {
    id: 'agent-organization',
    name: 'organization',
    category: 'agents',
    tags: ['Core'],
    description: 'Autonomous workspace organizer.',
    enabled: true,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    markdownDoc: '',
    ...overrides,
  };
}

describe('AgentCard seed provenance', () => {
  it('labels a seeded row as a Sample', () => {
    render(
      <AgentCard
        agent={makeAgent({ isSeed: true })}
        hasCatalogLoaded
        isSelected={false}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.getByText('Sample')).toBeTruthy();
  });

  it('does not label a server-sourced row as a Sample', () => {
    render(
      <AgentCard
        agent={makeAgent({ isSeed: false })}
        hasCatalogLoaded
        isSelected={false}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.queryByText('Sample')).toBeNull();
  });

  it('still reports "Not in registry" for a real row the catalog omits', () => {
    render(
      <AgentCard
        agent={makeAgent({ isSeed: false })}
        hasCatalogLoaded
        isSelected={false}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.getByText('Not in registry')).toBeTruthy();
  });

  it('does not stack "Not in registry" under "Sample"', () => {
    render(
      <AgentCard
        agent={makeAgent({ isSeed: true })}
        hasCatalogLoaded
        isSelected={false}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    // A seeded row is by definition absent from the registry. Showing both
    // badges restates one fact twice and crowds the row.
    expect(screen.queryByText('Not in registry')).toBeNull();
  });

  it('disables the toggle on a seeded row', () => {
    render(
      <AgentCard
        agent={makeAgent({ isSeed: true })}
        hasCatalogLoaded
        isSelected={false}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle.hasAttribute('disabled')).toBe(true);
  });

  it('leaves the toggle enabled on a server-sourced row', () => {
    render(
      <AgentCard
        agent={makeAgent({ isSeed: false })}
        hasCatalogLoaded
        isSelected={false}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle.hasAttribute('disabled')).toBe(false);
  });
});
