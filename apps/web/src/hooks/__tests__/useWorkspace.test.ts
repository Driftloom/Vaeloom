import { renderHook, waitFor } from '@testing-library/react';
import { useWorkspace, useWorkspaceAgents, useWorkspaceMemories, useWorkspaceConnectors } from '../useWorkspace';
import * as api from '../../lib/api';

jest.mock('../../lib/api', () => ({
  request: jest.fn(),
}));

describe('useWorkspace hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useWorkspace', () => {
    it('returns null data when workspaceId is undefined', () => {
      const { result } = renderHook(() => useWorkspace(undefined));
      expect(result.current.workspace).toBeUndefined();
      expect(api.request).not.toHaveBeenCalled();
    });

    it('fetches workspace data when workspaceId is provided', async () => {
      const mockData = { id: 'ws1', name: 'Test' };
      (api.request as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() => useWorkspace('ws1'));

      await waitFor(() => {
        expect(result.current.workspace).toEqual(mockData);
      });
      expect(api.request).toHaveBeenCalledWith('/workspaces/ws1');
    });
  });

  describe('useWorkspaceAgents', () => {
    it('returns empty array when workspaceId is undefined', () => {
      const { result } = renderHook(() => useWorkspaceAgents(undefined));
      expect(result.current.agents).toEqual([]);
    });

    it('fetches agents when workspaceId is provided', async () => {
      const mockData = [{ id: 'a1', name: 'Agent 1' }];
      (api.request as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() => useWorkspaceAgents('ws1'));

      await waitFor(() => {
        expect(result.current.agents).toEqual(mockData);
      });
    });
  });

  describe('useWorkspaceMemories', () => {
    it('returns empty array when workspaceId is undefined', () => {
      const { result } = renderHook(() => useWorkspaceMemories(undefined));
      expect(result.current.memories).toEqual([]);
    });

    it('fetches memories when workspaceId is provided', async () => {
      const mockData = [{ id: 'm1', content: 'Memory 1' }];
      (api.request as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() => useWorkspaceMemories('ws1'));

      await waitFor(() => {
        expect(result.current.memories).toEqual(mockData);
      });
    });
  });

  describe('useWorkspaceConnectors', () => {
    it('returns empty array when workspaceId is undefined', () => {
      const { result } = renderHook(() => useWorkspaceConnectors(undefined));
      expect(result.current.connectors).toEqual([]);
    });

    it('fetches connectors when workspaceId is provided', async () => {
      const mockData = [{ id: 'c1', name: 'Connector 1' }];
      (api.request as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() => useWorkspaceConnectors('ws1'));

      await waitFor(() => {
        expect(result.current.connectors).toEqual(mockData);
      });
    });
  });
});
