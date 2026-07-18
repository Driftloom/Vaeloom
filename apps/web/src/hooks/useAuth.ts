import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, setToken, clearToken, setRefreshToken, clearRefreshToken, ApiError } from '../lib/api';
import type { AuthResponse, MeResponse, PublicUser } from '@vaeloom/shared-types';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState((s) => ({ ...s, loading: false, isAuthenticated: false }));
      return;
    }
    api
      .me()
      .then((res: MeResponse) => {
        setState({ user: res.user, loading: false, error: null, isAuthenticated: true });
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          clearRefreshToken();
        }
        setState({ user: null, loading: false, error: 'Session expired', isAuthenticated: false });
      });
  }, []);

    const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      setState({ user: res.user, loading: false, error: null, isAuthenticated: true });
      await router.push('/dashboard');
    },
    [router],
  );

  const signup = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await api.signup({ email, password, displayName });
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      setState({ user: res.user, loading: false, error: null, isAuthenticated: true });
      await router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(() => {
    clearToken();
    clearRefreshToken();
    setState({ user: null, loading: false, error: null, isAuthenticated: false });
    void router.push('/login');
  }, [router]);

  return { ...state, login, signup, logout };
}
