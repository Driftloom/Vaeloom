import { create } from 'zustand';
import type { Workspace } from '@vaeloom/shared-types';
import { workspaceApi } from '@/lib/api-client';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name?: string) => Promise<Workspace>;
  setCurrentWorkspace: (ws: Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const workspaces = await workspaceApi.list();
      set({ workspaces, loading: false });
      if (!get().currentWorkspace && workspaces.length > 0) {
        set({ currentWorkspace: workspaces[0] });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load workspaces', loading: false });
    }
  },

  switchWorkspace: (id: string) => {
    const ws = get().workspaces.find((w) => w.id === id) ?? null;
    set({ currentWorkspace: ws });
  },

  createWorkspace: async (name?: string) => {
    const ws = await workspaceApi.create({ name });
    set((s) => ({ workspaces: [...s.workspaces, ws], currentWorkspace: ws }));
    return ws;
  },

  setCurrentWorkspace: (ws: Workspace) => set({ currentWorkspace: ws }),
}));
