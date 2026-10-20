import { render, screen } from '@testing-library/react';
import React from 'react';
import MemoryGraphWorkbenchPage from '@/app/workspace/[workspaceId]/memory/graph/page';
import { GRAPH_NODE_STYLES, GRAPH_NODE_TYPE_ORDER } from '@/components/memory/GraphViewer';

jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-1' }),
}));

jest.mock('@/lib/dynamic-imports', () => ({
  DynamicGraphViewer: () => <div data-testid="graph-viewer-stub" />,
}));

/**
 * The legend under the canvas is the user-facing documentation of the node
 * taxonomy. It must be generated from the same constant map the canvas uses —
 * previously it was hand-maintained hex values that had already drifted from
 * the renderer (9 colours on the canvas vs 6 in this card).
 */
describe('Knowledge graph workbench page', () => {
  it('renders the workbench and its viewer', () => {
    render(<MemoryGraphWorkbenchPage />);
    expect(screen.getByTestId('graph-viewer-stub')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Knowledge Graph Workbench' })).toBeInTheDocument();
  });

  it('reports the real node type count instead of a version claim', () => {
    render(<MemoryGraphWorkbenchPage />);
    expect(screen.getByText('8 Node Types')).toBeInTheDocument();
    expect(screen.queryByText(/Semantic Graph Engine/)).toBeNull();
  });

  it('documents every node type in the legend, exactly once', () => {
    const { container } = render(<MemoryGraphWorkbenchPage />);
    const entries = container.querySelectorAll('[data-legend-type]');
    expect(entries).toHaveLength(GRAPH_NODE_TYPE_ORDER.length);

    for (const type of GRAPH_NODE_TYPE_ORDER) {
      const entry = container.querySelector(`[data-legend-type="${type}"]`);
      expect(entry).not.toBeNull();
    }
  });

  it('draws each legend swatch with the exact fill the canvas paints for that type', () => {
    const { container } = render(<MemoryGraphWorkbenchPage />);

    for (const type of GRAPH_NODE_TYPE_ORDER) {
      const style = GRAPH_NODE_STYLES[type];
      const swatch = container.querySelector(
        `[data-legend-type="${type}"] svg [fill="${style.fill}"]`,
      );
      expect({ type, found: swatch !== null }).toEqual({ type, found: true });
      const stroked = container.querySelector(
        `[data-legend-type="${type}"] svg [stroke="${style.stroke}"]`,
      );
      expect({ type, found: stroked !== null }).toEqual({ type, found: true });
    }
  });

  it('shows the dashed channel in the legend for dashed node types', () => {
    const { container } = render(<MemoryGraphWorkbenchPage />);
    const conceptSwatch = container.querySelector(
      '[data-legend-type="concept"] svg [stroke-dasharray]',
    );
    expect(conceptSwatch).not.toBeNull();
    expect(conceptSwatch?.getAttribute('stroke-dasharray')).toBe('4 3');

    const entitySwatch = container.querySelector(
      '[data-legend-type="entity"] svg [stroke-dasharray]',
    );
    expect(entitySwatch).toBeNull();
  });

  it('renders no raw hex colour literals in the legend markup', () => {
    const { container } = render(<MemoryGraphWorkbenchPage />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z])/);
  });
});
