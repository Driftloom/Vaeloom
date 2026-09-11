'use client';

/**
 * Central auth session (Phase 02A / F-16).
 *
 * Phase-01 found `useAuth()` was a plain hook whose consumers each ran their
 * own /auth/me fetch (workspace layout + TopNav in parallel, plus settings
 * and the landing page with separate cache keys) — 2-4 identical requests per
 * screen load. The same state machine now lives in one provider mounted at
 * the app root; `useAuth()` keeps its exact previous signature so consumers
 * are unchanged.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  getToken,
  setToken,
  clearToken,
  setRefreshToken,
  clearRefreshToken,
  ApiError,
} from '../lib/api';
import type { MeResponse, PublicUser } from '@vaeloom/shared-types';

interface AuthState {
  user: PublicUser | null;
  /** Full /auth/me payload — includes workspace memberships. */
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  user: null,
  me: null,
  loading: true,
  error: null,
  isAuthenticated: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  /** Guards against StrictMode double-invocation of the hydration effect. */
  const check = useCallback((attempt = 1) => {
    const token = getToken();
    if (!token) {
      setState({ user: null, me: null, loading: false, error: null, isAuthenticated: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    api
      .me()
      .then((res: MeResponse) => {
        setState({
          user: res.user,
          me: res,
          loading: false,
          error: null,
          isAuthenticated: true,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          clearRefreshToken();
          setState({
            user: null,
            me: null,
            loading: false,
            error: 'Session expired',
            isAuthenticated: false,
          });
          return;
        }
        if (attempt < 3) {
          setTimeout(() => check(attempt + 1), 1000 * attempt);
        } else {
          setState({
            user: null,
            me: null,
            loading: false,
            error: 'Session expired',
            isAuthenticated: false,
          });
        }
      });
  }, []);

  useEffect(() => {
    check(1);
    const onAuthSet = () => check(1);
    window.addEventListener('vaeloom.auth_token_set', onAuthSet);
    return () => window.removeEventListener('vaeloom.auth_token_set', onAuthSet);
  }, [check]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setToken(res.accessToken);
    if (res.refreshToken) setRefreshToken(res.refreshToken);
    setState({ user: res.user, me: null, loading: false, error: null, isAuthenticated: true });
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    const res = await api.signup({ email, password, displayName });
    setToken(res.accessToken);
    if (res.refreshToken) setRefreshToken(res.refreshToken);
    setState({ user: res.user, me: null, loading: false, error: null, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    clearRefreshToken();
    setState({ user: null, me: null, loading: false, error: null, isAuthenticated: false });
    void router.push('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, signup, logout }),
    [state, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
