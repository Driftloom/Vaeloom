import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { ConnectorsHeader } from '../connectors/ConnectorsHeader';

/**
 * Minimal tab-pattern harness. It mirrors the contract McpView now implements:
 * role="tablist" owning role="tab" buttons with roving tabindex, arrow-key
 * navigation that also moves focus, and aria-controls linking to a tabpanel.
 *
 * This asserts the pattern rather than McpView itself. McpView pulls in the
 * MCP client, server registry and SWR activity log; mounting that to test two
 * tabs would assert the mocks, not the behaviour.
 */

const TABS = ['inspector', 'manifest'] as const;
type Tab = (typeof TABS)[number];

function TabPattern({ initial = 'inspector' }: { initial?: Tab }) {
  const [active, setActive] = React.useState<Tab>(initial);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = active === 'inspector' ? 'manifest' : 'inspector';
    setActive(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <>
      <div role="tablist" aria-label="Pane" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            type="button"
            role="tab"
            aria-selected={active === t}
            aria-controls={`panel-${t}`}
            tabIndex={active === t ? 0 : -1}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {TABS.map((t) =>
        active === t ? (
          <div key={t} role="tabpanel" id={`panel-${t}`} aria-labelledby={`tab-${t}`}>
            {t} panel
          </div>
        ) : null,
      )}
    </>
  );
}

describe('tab pattern', () => {
  it('exposes a single tab stop', () => {
    render(<TabPattern />);
    const tabs = screen.getAllByRole('tab') as HTMLButtonElement[];
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('moves selection and focus with ArrowRight, wrapping at the end', () => {
    render(<TabPattern />);
    const tabs = screen.getAllByRole('tab');
    const list = screen.getByRole('tablist');
    tabs[0]?.focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('moves backwards with ArrowLeft', () => {
    render(<TabPattern />);
    const tabs = screen.getAllByRole('tab');
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('links the selected tab to a labelled panel', () => {
    render(<TabPattern />);
    const selected = (screen.getAllByRole('tab') as HTMLButtonElement[]).find(
      (t) => t.getAttribute('aria-selected') === 'true',
    );
    const controls = selected?.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    const panel = document.getElementById(controls as string);
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe(selected?.id);
  });
});

/**
 * ConnectorsHeader (task 14 / D5-D6). The real tablist is mounted rather than a
 * duplicate harness: it already owns the roving-tabIndex/arrow-key logic, so
 * wiring in a clone would assert the copy instead of the component. The three
 * tabpanels are provided by this file, mirroring how ConnectorsView mounts
 * them; the tab headers' own panels are never mounted here (weight).
 */
const CONNECTOR_TABS = ['discover', 'yours', 'studio'] as const;
type ConnectorTab = (typeof CONNECTOR_TABS)[number];

function ConnectorsTabsHarness({ initial = 'discover' }: { initial?: ConnectorTab }) {
  const [active, setActive] = React.useState<ConnectorTab>(initial);

  return (
    <>
      <ConnectorsHeader
        activeSubTab={active}
        onTabChange={setActive}
        composioTotalCount={null}
        composioEnabled={null}
        installedCount={0}
        composioSyncing={false}
        onSyncAllComposio={jest.fn()}
        onOpenAddModal={jest.fn()}
      />
      {CONNECTOR_TABS.map((t) =>
        active === t ? (
          <div
            key={t}
            role="tabpanel"
            id={`connector-panel-${t}`}
            aria-labelledby={`connector-tab-${t}`}
          >
            {t} panel
          </div>
        ) : null,
      )}
    </>
  );
}

describe('ConnectorsHeader roving tabs', () => {
  const connectorTabs = () => screen.getAllByRole('tab') as HTMLButtonElement[];
  const connectorTab = (id: ConnectorTab) =>
    document.getElementById(`connector-tab-${id}`) as HTMLButtonElement;
  const selectedConnectorTabId = () =>
    (connectorTabs().find((t) => t.getAttribute('aria-selected') === 'true')?.id ?? '').replace(
      'connector-tab-',
      '',
    );

  it('exposes a single tab stop across the three connector tabs', () => {
    render(<ConnectorsTabsHarness />);
    expect(connectorTabs()).toHaveLength(3);
    expect(connectorTabs().filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(connectorTab('discover').getAttribute('tabindex')).toBe('0');
    expect(connectorTab('yours').getAttribute('tabindex')).toBe('-1');
    expect(connectorTab('studio').getAttribute('tabindex')).toBe('-1');
  });

  it('moves selection and focus with ArrowRight, wrapping from studio back to discover', () => {
    render(<ConnectorsTabsHarness />);
    const list = screen.getByRole('tablist', { name: 'Connector view' });
    connectorTab('discover').focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selectedConnectorTabId()).toBe('yours');
    expect(document.activeElement).toBe(connectorTab('yours'));

    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selectedConnectorTabId()).toBe('studio');
    expect(document.activeElement).toBe(connectorTab('studio'));

    // Wrap at the trailing end.
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selectedConnectorTabId()).toBe('discover');
    expect(document.activeElement).toBe(connectorTab('discover'));
  });

  it('moves backwards with ArrowLeft, wrapping below discover', () => {
    render(<ConnectorsTabsHarness />);
    const list = screen.getByRole('tablist', { name: 'Connector view' });
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selectedConnectorTabId()).toBe('studio');
    expect(document.activeElement).toBe(connectorTab('studio'));

    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selectedConnectorTabId()).toBe('yours');
    expect(document.activeElement).toBe(connectorTab('yours'));
  });

  it('keeps aria-selected truth-consistent and links every tab to a resolved panel', () => {
    render(<ConnectorsTabsHarness />);
    const tabs = connectorTabs();
    const selected = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    for (const tab of tabs) {
      const isSelf = tab === selected[0];
      expect(tab.getAttribute('aria-selected') === 'true').toBe(isSelf);
      const controls = tab.getAttribute('aria-controls');
      expect(controls).toBe(`connector-panel-${tab.id.replace('connector-tab-', '')}`);
      const panel = document.getElementById(controls as string);
      // Only the active panel is mounted, mirroring ConnectorsView.
      if (isSelf) {
        expect(panel?.getAttribute('role')).toBe('tabpanel');
        expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
      } else {
        expect(panel).toBeNull();
      }
    }
  });
});
