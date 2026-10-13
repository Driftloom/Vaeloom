import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ConnectorDetailDrawer, type CatalogRowData } from '../ConnectorDetailDrawer';
import { connectorsApi } from '@/lib/api-client';

/**
 * PR2B. `connectorsApi.usage` had existed in the client with no caller, so the
 * lifecycle summary was never surfaced anywhere in the product.
 *
 * The assertion that matters most is the failure case: a read that fails must
 * not render as "0 events", because that reads as a connector which has never
 * been used -- a fabrication of exactly the kind this work set out to remove.
 */

jest.mock('@/lib/api-client', () => ({
  connectorsApi: {
    usage: jest.fn(),
    rollback: jest.fn(),
    health: jest.fn(),
    mcp: { listTools: jest.fn() },
  },
}));

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const usageMock = connectorsApi.usage as jest.MockedFunction<typeof connectorsApi.usage>;

const row: CatalogRowData = {
  id: 'conn-1',
  name: 'github',
  provider: 'GitHub',
  protocol: 'rest',
  category: 'connector',
  description: 'GitHub connector',
  scopes: ['repo:read'],
  assignedAgents: [],
} as CatalogRowData;

function renderDrawer() {
  return render(
    <ConnectorDetailDrawer
      isOpen
      onClose={jest.fn()}
      row={row}
      connected
      connectorId="conn-1"
      workspaceId="ws-1"
      onConnect={jest.fn()}
      onDisconnect={jest.fn()}
    />,
  );
}

async function openActivity() {
  renderDrawer();
  fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
}

const baseUsage = {
  connector_id: 'conn-1',
  name: 'github',
  type: 'github',
  status: 'connected',
  last_synced_at: null,
  events_by_action: {},
  total_events: 0,
  last_activity_at: null,
};

describe('ConnectorDetailDrawer Activity tab', () => {
  beforeEach(() => {
    usageMock.mockReset();
  });

  it('exposes Activity as a tab', () => {
    usageMock.mockResolvedValue({ ...baseUsage, config_version: 1 });
    renderDrawer();
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeTruthy();
  });

  it('renders real event counts from the API', async () => {
    usageMock.mockResolvedValue({
      ...baseUsage,
      config_version: 4,
      events_by_action: { created: 1, updated: 7 },
      total_events: 8,
    });
    await openActivity();
    await waitFor(() => expect(screen.getByText('8')).toBeTruthy());
    expect(screen.getByText('updated')).toBeTruthy();
    expect(screen.getByText('created')).toBeTruthy();
  });

  it('shows an explicit empty state when there are genuinely no events', async () => {
    usageMock.mockResolvedValue({ ...baseUsage, config_version: 1 });
    await openActivity();
    await waitFor(() => expect(screen.getByText(/No lifecycle events recorded/i)).toBeTruthy());
  });

  it('surfaces a read failure instead of rendering it as zero events', async () => {
    usageMock.mockRejectedValue(new Error('usage service unavailable'));
    await openActivity();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('usage service unavailable')).toBeTruthy();
    // The dangerous outcome, asserted explicitly.
    expect(screen.queryByText(/No lifecycle events recorded/i)).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('hides rollback at version 1, where there is no snapshot to restore', async () => {
    usageMock.mockResolvedValue({ ...baseUsage, config_version: 1 });
    await openActivity();
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
    expect(screen.queryByText(/Roll back to previous config version/i)).toBeNull();
  });

  it('offers rollback above version 1', async () => {
    usageMock.mockResolvedValue({
      ...baseUsage,
      config_version: 5,
      events_by_action: { updated: 2 },
      total_events: 2,
    });
    await openActivity();
    await waitFor(() => expect(screen.getByText('5')).toBeTruthy());
    expect(screen.getByText(/Roll back to previous config version/i)).toBeTruthy();
  });
});
