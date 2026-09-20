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
  login: (
    email: string,
    password: string,
  ) => Promise<{ mfaRequired?: boolean; mfaToken?: string } | void>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName?: string,
    termsAccepted?: boolean,
  ) => Promise<void>;
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
            error: null,
            isAuthenticated: false,
          });
          return;
        }
        if (attempt < 3) {
          setTimeout(() => check(attempt + 1), 1000 * attempt);
        } else {
          clearToken();
          clearRefreshToken();
          setState({
            user: null,
            me: null,
            loading: false,
            error: null,
            isAuthenticated: false,
          });
        }
      });
  }, []);

  useEffect(() => {
    check(1);
    const onAuthSet = () => check(1);
    const onAuthCleared = () => {
      setState({ user: null, me: null, loading: false, error: null, isAuthenticated: false });
    };
    window.addEventListener('vaeloom.auth_token_set', onAuthSet);
    window.addEventListener('vaeloom.auth_token_cleared', onAuthCleared);
    return () => {
      window.removeEventListener('vaeloom.auth_token_set', onAuthSet);
      window.removeEventListener('vaeloom.auth_token_cleared', onAuthCleared);
    };
  }, [check]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    if ((res as any).mfaRequired && (res as any).mfaToken) {
      return { mfaRequired: true, mfaToken: (res as any).mfaToken };
    }
    setToken(res.accessToken);
    if (res.refreshToken) setRefreshToken(res.refreshToken);
    setState({ user: res.user, me: null, loading: false, error: null, isAuthenticated: true });
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    const res = await api.mfa.verify(mfaToken, code);
    setToken(res.accessToken);
    if (res.refreshToken) setRefreshToken(res.refreshToken);
    setState({ user: res.user, me: null, loading: false, error: null, isAuthenticated: true });
  }, []);

  const signup = useCallback(
    async (email: string, password: string, displayName?: string, termsAccepted?: boolean) => {
      const res = await api.signup({
        email,
        password,
        displayName,
        termsAccepted: termsAccepted ?? true,
      });
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      setState({ user: res.user, me: null, loading: false, error: null, isAuthenticated: true });
    },
    [],
  );

  const logout = useCallback(async () => {
    if (process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    clearToken();
    clearRefreshToken();
    setState({ user: null, me: null, loading: false, error: null, isAuthenticated: false });
    void router.push('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, verifyMfa, signup, logout }),
    [state, login, verifyMfa, signup, logout],
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
