import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

const AD_TAGS = [
  { zone: '11960356', src: 'https://al5sm.com/tag.min.js' },
  { zone: '11960359', src: 'https://n6wxm.com/vignette.min.js' },
];
const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2053351556528753';

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

// Ads are injected client-side only for proven-anon sessions: no user object,
// no stored token (a pending /me must not trigger injection), no premium
// cookie. Everything else waits for a positive anon verdict.
function computeWantsAds(user) {
  if (user) return !isPremiumSession(user);
  if (getToken()) return false;
  return !hasPremiumCookie();
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

  useEffect(() => {
    if (!ready) return;
    const wantsAds = computeWantsAds(user);
    if (wantsAds) {
      AD_TAGS.forEach((t) => {
        const sel = `script[data-zone="${t.zone}"]`;
        if (document.querySelector(sel)) return;
        const s = document.createElement('script');
        s.dataset.zone = t.zone;
        s.src = t.src;
        (document.body || document.documentElement).appendChild(s);
      });
      if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
        const s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = ADSENSE_SRC;
        document.head.appendChild(s);
      }
      return undefined;
    }
    // Ad-free or unknown session: strip anything that slips in (late loaders,
    // auto-ads) every few seconds.
    const stripAds = () => {
      document.querySelectorAll('script[data-zone]').forEach((el) => el.remove());
      document
        .querySelectorAll(
          'script[src*="adsbygoogle.js"], ins.adsbygoogle, iframe[src*="googlesyndication"], iframe[src*="googleads.g.doubleclick.net"]'
        )
        .forEach((el) => el.remove());
    };
    stripAds();
    const iv = setInterval(stripAds, 5000);
    return () => clearInterval(iv);
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !('serviceWorker' in navigator)) return;
    const wantsAds = computeWantsAds(user);
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
