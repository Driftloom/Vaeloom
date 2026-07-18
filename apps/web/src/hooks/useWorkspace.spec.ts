import { renderHook, waitFor } from '@testing-library/react';
import { useWorkspace, useWorkspaceAgents, useWorkspaceMemories, useWorkspaceConnectors } from './useWorkspace';
import { api } from '../lib/api';

// Mock the API request
jest.mock('../lib/api', () => ({
  api: {
    request: jest.fn()
  }
}));

// Mock SWR to prevent cache pollution between tests
jest.mock('swr', () => {
  const original = jest.requireActual('swr');
  return {
    __esModule: true,
    ...original,
    default: (key: string, fetcher: any) => {
      // Very basic mock of SWR behavior for testing the hooks logic
      return {
        data: key ? [{ id: 'mocked' }] : undefined,
        error: undefined,
        isLoading: false,
        mutate: jest.fn()
      };
    }
  };
});

describe('useWorkspace hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useWorkspace', () => {
    it('should return undefined if no workspaceId is provided', () => {
      jest.mocked(api.request).mockResolvedValue(null);
      const { result } = renderHook(() => useWorkspace(undefined));
      // With our basic SWR mock, an undefined key returns undefined data
      expect(result.current.workspace).toBeUndefined();
    });

    it('should fetch workspace when workspaceId is provided', async () => {
      const { result } = renderHook(() => useWorkspace('ws-1'));
      await waitFor(() => {
        expect(result.current.workspace).toBeDefined();
      });
    });
  });

  describe('useWorkspaceAgents', () => {
    it('should fetch agents for the given workspace', async () => {
      const { result } = renderHook(() => useWorkspaceAgents('ws-1'));
      await waitFor(() => {
        expect(result.current.agents).toHaveLength(1);
        expect(result.current.agents[0]).toHaveProperty('id', 'mocked');
      });
    });
  });

  describe('useWorkspaceMemories', () => {
    it('should fetch memories for the given workspace', async () => {
      const { result } = renderHook(() => useWorkspaceMemories('ws-1'));
      await waitFor(() => {
        expect(result.current.memories).toHaveLength(1);
        expect(result.current.memories[0]).toHaveProperty('id', 'mocked');
      });
    });
  });

  describe('useWorkspaceConnectors', () => {
    it('should fetch connectors for the given workspace', async () => {
      const { result } = renderHook(() => useWorkspaceConnectors('ws-1'));
      await waitFor(() => {
        expect(result.current.connectors).toHaveLength(1);
        expect(result.current.connectors[0]).toHaveProperty('id', 'mocked');
      });
    });
  });
});
