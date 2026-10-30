import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, type LoginInput } from './api/index.ts';
import type { AdminProfile } from '../types/models.ts';

interface AuthValue {
  /** undefined while checking, null when signed out. */
  admin: AdminProfile | null | undefined;
  login(creds: LoginInput): Promise<AdminProfile>;
  logout(): Promise<void>;
  /** Called when the API says the session has ended (401). */
  expired(): void;
}

/* Who is signed in. The server is the authority: this only mirrors what auth.me() says,
   so hiding a screen here is a convenience, never the protection itself. */
const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null | undefined>(undefined); // undefined = still checking

  useEffect(() => {
    let live = true;
    api.auth.me().then((me) => live && setAdmin(me), () => live && setAdmin(null));
    return () => {
      live = false;
    };
  }, []);

  const login = useCallback(async (creds: LoginInput) => {
    const me = await api.auth.login(creds);
    setAdmin(me);
    return me;
  }, []);
  const logout = useCallback(async () => {
    await api.auth.logout();
    setAdmin(null);
  }, []);
  const expired = useCallback(() => setAdmin(null), []);

  const value = useMemo<AuthValue>(() => ({ admin, login, logout, expired }), [admin, login, logout, expired]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = (): AuthValue => {
  const value = useContext(AuthCtx);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
};

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  const loc = useLocation();
  if (admin === undefined) return <div className="ad-boot" aria-busy="true" />;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: loc.pathname + loc.search }} />;
  return children;
}
