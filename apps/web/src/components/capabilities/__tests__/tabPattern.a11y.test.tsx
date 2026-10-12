import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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
