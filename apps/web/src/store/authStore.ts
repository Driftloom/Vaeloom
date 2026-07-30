import { create } from 'zustand';
import type { PublicUser } from '@vaeloom/shared-types';
import { authApi } from '@/lib/api-client';
import { setToken, clearToken, setRefreshToken, clearRefreshToken } from '@/lib/api';

interface AuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,

  hydrate: async () => {
    try {
      const res = await authApi.me();
      set({ user: res.user, isAuthenticated: true, loading: false, error: null });
    } catch {
      set({ user: null, isAuthenticated: false, loading: false, error: null });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      set({ user: res.user, isAuthenticated: true, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message, loading: false });
      throw err;
    }
  },

  signup: async (email: string, password: string, displayName?: string) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.signup({ email, password, displayName });
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      set({ user: res.user, isAuthenticated: true, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      set({ error: message, loading: false });
      throw err;
    }
  },

  logout: () => {
    clearToken();
    clearRefreshToken();
    set({ user: null, isAuthenticated: false, loading: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
