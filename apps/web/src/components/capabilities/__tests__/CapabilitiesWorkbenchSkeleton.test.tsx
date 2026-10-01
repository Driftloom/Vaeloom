/**
 * The route is a two-pane master/detail workbench behind a category tablist. A
 * skeleton of any other shape is a visible layout jump on every navigation to
 * the route, and nothing else in the suite would catch it: the skeleton is
 * `aria-hidden` leaf divs, so it can be plausible and still be wrong.
 *
 * These assertions are structural rather than visual -- a fixed-width left rail
 * beside an inspector, a row of tab pills, and no card grid -- because those are
 * the properties that drifted.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import CapabilitiesLoading from '../../../app/workspace/[workspaceId]/capabilities/loading';
import { CapabilitiesWorkbenchSkeleton } from '../CapabilitiesWorkbenchSkeleton';

function railAndInspector(container: HTMLElement): {
  rail: HTMLElement | null;
  inspector: HTMLElement | null;
} {
  const panes = Array.from(container.querySelectorAll('div')).filter((node) =>
    (node.className || '').includes('flex-1 flex min-h-0'),
  );
  expect(panes).toHaveLength(1);
  const pane = panes[0] as HTMLElement;
  const [rail, inspector] = Array.from(pane.children) as HTMLElement[];
  return { rail, inspector };
}

describe('capabilities loading skeleton', () => {
  it('is the two-pane workbench, not a card grid', () => {
    const { container } = render(<CapabilitiesWorkbenchSkeleton />);

    expect(screen.getByRole('status', { name: 'Loading capabilities' })).toBeInTheDocument();

    const { rail, inspector } = railAndInspector(container);
    expect(rail).not.toBeNull();
    expect(inspector).not.toBeNull();
    // Fixed-width rail, flexible inspector: the same split the real route uses.
    expect(rail?.className).toContain('w-[320px]');
    expect(rail?.className).toContain('shrink-0');
    expect(inspector?.className).toContain('flex-1');

    // Eight row stubs in the rail, three blocks in the inspector.
    expect(rail?.children).toHaveLength(8);
    expect(inspector?.children).toHaveLength(3);
  });

  it('renders a header block and one tab pill per category', () => {
    const { container } = render(<CapabilitiesWorkbenchSkeleton />);

    // Title stub then description stub, then the toolbar, then the panes.
    const status = screen.getByRole('status');
    expect(Array.from(status.children).map((node) => node.className || '')).toEqual([
      expect.stringContaining('pt-4'),
      expect.stringContaining('border-b'),
      expect.stringContaining('flex-1'),
    ]);
    const header = status.children[0] as HTMLElement;
    expect(header.children).toHaveLength(2);

    // Six categories, so six pills -- a grid of cards has no equivalent count.
    const pills = Array.from(container.querySelectorAll('div')).find((node) =>
      (node.className || '').includes('flex items-center gap-2 min-w-0'),
    );
    expect(pills?.children).toHaveLength(6);
  });

  it('uses no card-grid markup, which is the shape that caused the layout jump', () => {
    const { container } = render(<CapabilitiesWorkbenchSkeleton />);

    expect(container.querySelector('.grid')).toBeNull();
    expect(
      Array.from(container.querySelectorAll('div')).some((node) =>
        (node.className || '').includes('grid-cols-'),
      ),
    ).toBe(false);
  });

  it('hides every decorative stub from assistive technology', () => {
    render(<CapabilitiesWorkbenchSkeleton />);

    const status = screen.getByRole('status');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    // Nothing in the skeleton is a focusable target waiting for a keyboard.
    expect(status.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0);
  });

  it('is the component the route-level loading.tsx renders, so the two cannot differ', () => {
    const route = render(<CapabilitiesLoading />);
    const shared = render(<CapabilitiesWorkbenchSkeleton />);

    expect(route.container.innerHTML).toBe(shared.container.innerHTML);
    expect(screen.getAllByRole('status', { name: 'Loading capabilities' })).toHaveLength(2);
  });
});
