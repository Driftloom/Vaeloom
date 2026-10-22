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

  it('labels every panel with its tab', async () => {
    usageMock.mockResolvedValue({ ...baseUsage, config_version: 2 });
    renderDrawer();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    // No tab may carry aria-controls: only the active panel is mounted, so a
    // reference from an inactive tab would dangle.
    for (const tab of tabs) {
      expect(tab.getAttribute('aria-controls')).toBeNull();
      expect(tab.id).toBeTruthy();
    }
    // The active panel points back at its tab, which is the direction that
    // matters for announcing content.
    const panel = document.getElementById('connector-panel-overview');
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe('connector-tab-overview');
  });

  it('navigates the tablist with arrow keys', async () => {
    usageMock.mockResolvedValue({ ...baseUsage, config_version: 1 });
    renderDrawer();
    const tabs = screen.getAllByRole('tab');
    const list = screen.getByRole('tablist');
    tabs[0]?.focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });
});

/**
 * Task 14 (D2/D4). The drawer's two census dots (:361 idle/scope list,
 * :599 active/zero-trust heading) and the destructive rollback gate.
 *
 * The rollback assertions pin the exact interpolated message split of the
 * original `window.confirm` string: the question became a dialog title, the
 * credentials sentence became its description; Escape/Cancel must never reach
 * `connectorsApi.rollback`.
 */

/** StatusDot dot node only. For :599 the md size is part of the selector
 * because the drawer header already renders a sm active StatusDot in the
 * Connected badge — without the size token the pre-conversion header dot
 * would satisfy the assertion and mask the :599 site. */
const dotNode = (color: string, size = '') => {
  const prefix =
    size === 'md'
      ? 'relative inline-flex rounded-full h-2 w-2'
      : 'relative inline-flex rounded-full';
  return `[class^="${prefix}"][class*="${color}"]`;
};

describe('ConnectorDetailDrawer status dots', () => {
  it('renders the scope-list idle dot via StatusDot (overview tab)', () => {
    usageMock.mockResolvedValue({ ...baseUsage, config_version: 1 });
    const { container } = renderDrawer();
    expect(container.querySelector(dotNode('bg-primary'))).toBeTruthy();
  });

  it('renders the zero-trust active dot via StatusDot (security tab)', async () => {
    usageMock.mockResolvedValue({ ...baseUsage, config_version: 1 });
    renderDrawer();
    fireEvent.click(screen.getByRole('tab', { name: 'Zero-Trust & Health' }));
    expect(document.querySelector(dotNode('bg-success', 'md'))).toBeTruthy();
  });
});

describe('ConnectorDetailDrawer rollback confirmation dialog', () => {
  beforeEach(() => {
    usageMock.mockReset();
    (connectorsApi.rollback as jest.Mock).mockClear();
  });

  async function openWithRollbackAvailable() {
    usageMock.mockResolvedValue({
      ...baseUsage,
      config_version: 5,
      events_by_action: {},
      total_events: 0,
      name: 'github',
    });
    await openActivity();
    await waitFor(() => expect(screen.getByText('5')).toBeTruthy());
  }

  it('shows the ConfirmationDialog with the exact interpolated title and description', async () => {
    await openWithRollbackAvailable();
    fireEvent.click(screen.getByText(/Roll back to previous config version/i));
    expect(
      screen.getByRole('heading', { name: 'Restore github to config version 4?' }),
    ).toBeTruthy();
    expect(
      screen.getByText('The stored config and credentials are replaced by that snapshot.'),
    ).toBeTruthy();
  });

  it('does not call rollback when the dialog is cancelled (Cancel or Escape)', async () => {
    await openWithRollbackAvailable();
    fireEvent.click(screen.getByText(/Roll back to previous config version/i));

    // Escape cancels the dialog without touching the restore path.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('heading', { name: 'Restore github to config version 4?' }),
    ).toBeNull();
    expect(connectorsApi.rollback).not.toHaveBeenCalled();

    // The Cancel button answers the same way.
    fireEvent.click(screen.getByText(/Roll back to previous config version/i));
    expect(
      screen.getByRole('heading', { name: 'Restore github to config version 4?' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('heading', { name: 'Restore github to config version 4?' }),
    ).toBeNull();
    expect(connectorsApi.rollback).not.toHaveBeenCalled();
  });

  it('proceeds on confirm and rolls back to config_version - 1', async () => {
    await openWithRollbackAvailable();
    fireEvent.click(screen.getByText(/Roll back to previous config version/i));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(connectorsApi.rollback).toHaveBeenCalledWith('conn-1', 4));
  });
});
