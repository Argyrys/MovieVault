import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

function hasPremiumCookie() {
  try {
    return /(?:^|;\s*)mv_role=(?:premium|admin)(?:;|$)/.test(document.cookie);
  } catch {
    return false;
  }
}

function setPremiumCookie() {
  document.cookie = 'mv_role=premium; path=/; max-age=604800; SameSite=Lax';
}

function clearPremiumCookie() {
  document.cookie = 'mv_role=; path=/; max-age=0; SameSite=Lax';
}

function isPremiumSession(user) {
  if (user) return user.role === 'premium' || user.role === 'admin';
  return hasPremiumCookie();
}

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
      .catch(() => {
        setToken(null);
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    if (isPremiumSession(user)) {
      setPremiumCookie();
    } else {
      clearPremiumCookie();
    }
  }, [ready, user]);

  // Ads are gone entirely. Unregister the old ad-network service worker for
  // every visitor so it can't keep injecting anything from a stale scope.
  useEffect(() => {
    if (!ready || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs
          .filter((r) => {
            try {
              return new URL(r.scope).origin === location.origin;
            } catch {
              return false;
            }
          })
          .forEach((r) => r.unregister().catch(() => {}));
      })
      .catch(() => {});
  }, [ready]);

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

  const applySession = useCallback((res) => {
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearPremiumCookie();
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, applySession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
