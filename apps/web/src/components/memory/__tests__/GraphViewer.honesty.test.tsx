import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { GraphViewer } from '@/components/memory/GraphViewer';
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@vaeloom/shared-types';

// `jest` is intentionally the ambient global, NOT imported from '@jest/globals'
// (importing it opts out of babel-plugin-jest-hoist and the factory below never
// registers — see VaultSyncPanel.honesty.test.tsx).

const mockListNodes = jest.fn();
const mockListAllEdges = jest.fn();

jest.mock('@/lib/api-client', () => ({
  knowledgeGraphApi: {
    listNodes: (...args: unknown[]) => mockListNodes(...args),
    listAllEdges: (...args: unknown[]) => mockListAllEdges(...args),
  },
}));

function makeNode(i: number): KnowledgeGraphNode {
  return {
    id: `node-${i}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
    tenantId: 'tenant-1',
    label: `Node ${i}`,
    type: i % 2 === 0 ? 'entity' : 'concept',
    properties: {},
    importance: 0.5,
  };
}

function makeEdge(i: number): KnowledgeGraphEdge {
  return {
    id: `edge-${i}`,
    sourceId: 'node-0',
    targetId: `node-${(i % 18) + 1}`,
    relationship: 'relates_to',
    weight: 1,
    properties: {},
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const EMPTY_EDGES = { items: [], total: 0, page: 1, page_size: 100 };

beforeEach(() => {
  mockListNodes.mockReset();
  mockListAllEdges.mockReset();
});

/**
 * Honesty tests for the Knowledge Graph view.
 *
 * The previous implementation asked the API for a page and then presented the
 * page size as if it were the whole graph. These tests pin the honest badge
 * behaviour: truncation is stated in full ("Showing 20 of 21 Nodes"), the page
 * request is explicit so the number is well-defined, and the error/empty
 * states are rendered rather than skipped.
 */
describe('GraphViewer truncation honesty', () => {
  it('states the true return size when the first page truncates the graph', async () => {
    mockListNodes.mockResolvedValue({
      items: Array.from({ length: 20 }, (_, i) => makeNode(i)),
      total: 21,
      page: 1,
      page_size: 100,
    });
    mockListAllEdges.mockResolvedValue(EMPTY_EDGES);

    render(<GraphViewer workspaceId="ws-1" />);

    expect(await screen.findByText('Showing 20 of 21 Nodes')).toBeInTheDocument();
    expect(screen.queryByText('20 Nodes · 21 Edges')).not.toBeInTheDocument();

    expect(mockListNodes).toHaveBeenCalledWith({ page: 1, page_size: 100 });
    expect(mockListAllEdges).toHaveBeenCalledWith({ page: 1, page_size: 100 });
  });

  it('shows plain counts when the fetched page covers the whole graph', async () => {
    mockListNodes.mockResolvedValue({
      items: Array.from({ length: 19 }, (_, i) => makeNode(i)),
      total: 19,
      page: 1,
      page_size: 100,
    });
    mockListAllEdges.mockResolvedValue({
      items: [makeEdge(0), makeEdge(1)],
      total: 5,
      page: 1,
      page_size: 100,
    });

    render(<GraphViewer workspaceId="ws-1" />);

    expect(await screen.findByText('19 Nodes · 5 Edges')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing /)).not.toBeInTheDocument();
  });
});

describe('GraphViewer empty and error states', () => {
  it('renders an honest empty state when the graph has no nodes', async () => {
    mockListNodes.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    mockListAllEdges.mockResolvedValue(EMPTY_EDGES);

    render(<GraphViewer workspaceId="ws-1" />);

    expect(await screen.findByText('No memories in Knowledge Graph yet')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing /)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nodes ·/)).not.toBeInTheDocument();
  });

  it('surfaces a failed fetch as an alert with a working retry, never as an empty graph', async () => {
    mockListNodes.mockRejectedValueOnce(new Error('network down'));
    mockListAllEdges.mockResolvedValue(EMPTY_EDGES);

    render(<GraphViewer workspaceId="ws-1" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to load graph');
    expect(alert).toHaveTextContent('network down');
    expect(screen.queryByText('No memories in Knowledge Graph yet')).not.toBeInTheDocument();

    mockListNodes.mockResolvedValueOnce({
      items: Array.from({ length: 3 }, (_, i) => makeNode(i)),
      total: 3,
      page: 1,
      page_size: 100,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('3 Nodes · 0 Edges')).toBeInTheDocument();
    expect(mockListNodes).toHaveBeenCalledTimes(2);
  });
});

describe('GraphViewer palette markup', () => {
  it('renders nodes without any raw hex colour literals', async () => {
    mockListNodes.mockResolvedValue({
      items: [
        { ...makeNode(0), type: 'entity' },
        { ...makeNode(1), type: 'concept' },
        { ...makeNode(2), type: 'document' },
        { ...makeNode(3), type: 'organization' },
      ],
      total: 4,
      page: 1,
      page_size: 100,
    });
    mockListAllEdges.mockResolvedValue({
      items: [makeEdge(0)],
      total: 1,
      page: 1,
      page_size: 100,
    });

    const { container } = render(<GraphViewer workspaceId="ws-1" />);
    await screen.findByText('4 Nodes · 1 Edges');

    await waitFor(() => {
      expect(
        container.querySelectorAll('svg circle, svg rect, svg polygon').length,
      ).toBeGreaterThan(0);
    });

    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z])/);
  });
});
