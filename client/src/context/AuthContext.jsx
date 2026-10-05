import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setReady(true);
      return;
    }
    authApi
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => setToken(null))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !('serviceWorker' in navigator)) return;
    const wantsAds = user?.role !== 'premium';
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        const ours = regs.filter((r) => {
          try {
            return new URL(r.scope).origin === location.origin;
          } catch {
            return false;
          }
        });
        if (wantsAds) {
          if (!ours.length) navigator.serviceWorker.register('/sw.js').catch(() => {});
        } else {
          ours.forEach((r) => r.unregister().catch(() => {}));
        }
      })
      .catch(() => {});
  }, [ready, user]);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const res = await authApi.register(email, password, displayName);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
