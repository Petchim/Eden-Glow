import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api/index.js';

/* Who is signed in. The server is the authority: this only mirrors what auth.me() says,
   so hiding a screen here is a convenience, never the protection itself. */
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(undefined); // undefined = still checking

  useEffect(() => {
    let live = true;
    api.auth.me().then((me) => live && setAdmin(me), () => live && setAdmin(null));
    return () => {
      live = false;
    };
  }, []);

  const login = useCallback(async (creds) => {
    const me = await api.auth.login(creds);
    setAdmin(me);
    return me;
  }, []);
  const logout = useCallback(async () => {
    await api.auth.logout();
    setAdmin(null);
  }, []);
  const expired = useCallback(() => setAdmin(null), []);

  const value = useMemo(() => ({ admin, login, logout, expired }), [admin, login, logout, expired]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAdmin({ children }) {
  const { admin } = useAuth();
  const loc = useLocation();
  if (admin === undefined) return <div className="ad-boot" aria-busy="true" />;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: loc.pathname + loc.search }} />;
  return children;
}
