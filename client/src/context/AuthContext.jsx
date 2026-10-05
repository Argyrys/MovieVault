import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

const AD_TAGS = [
  { zone: '11960356', src: 'https://al5sm.com/tag.min.js' },
  { zone: '11960359', src: 'https://n6wxm.com/vignette.min.js' },
];

function hasPremiumCookie() {
  try {
    return /(?:^|;\s*)mv_role=premium(?:;|$)/.test(document.cookie);
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
  if (user) return user.role === 'premium';
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
        clearPremiumCookie();
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    if (user.role === 'premium') setPremiumCookie();
    else clearPremiumCookie();
  }, [ready, user]);

  useEffect(() => {
    if (!ready) return;
    const wantsAds = !isPremiumSession(user);
    AD_TAGS.forEach((t) => {
      const sel = `script[data-zone="${t.zone}"]`;
      if (!wantsAds) {
        document.querySelectorAll(sel).forEach((el) => el.remove());
        return;
      }
      if (document.querySelector(sel)) return;
      const s = document.createElement('script');
      s.dataset.zone = t.zone;
      s.src = t.src;
      (document.body || document.documentElement).appendChild(s);
    });
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !('serviceWorker' in navigator)) return;
    const wantsAds = !isPremiumSession(user);
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
    clearPremiumCookie();
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
