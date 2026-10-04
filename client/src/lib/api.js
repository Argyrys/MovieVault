const BASE = '/api';

async function get(path, params) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      /* ignore */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  home: () => get('/home'),
  browse: (params) => get('/browse', params),
  search: (q, page = 1) => get('/search', { q, page }),
  genres: (type) => get('/genres', { type }),
  title: (type, id) => get(`/title/${type}/${id}`),
  season: (tvId, season) => get(`/title/tv/${tvId}/season/${season}`),
  stream: (type, id, params) => get(`/stream/${type}/${id}`, params),
  health: () => get('/health'),
};

const TOKEN_KEY = 'mv_admin_token';

export function getAdminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function adminFetch(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    if (res.status === 401) setAdminToken(null);
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const adminApi = {
  login: (email, password) => adminFetch('/admin/login', { method: 'POST', body: { email, password } }),
  me: () => adminFetch('/admin/me'),
  dashboard: () => adminFetch('/admin/dashboard'),
  providers: () => adminFetch('/admin/providers'),
  updateProvider: (id, patch) => adminFetch(`/admin/providers/${id}`, { method: 'PATCH', body: patch }),
  homeRows: () => adminFetch('/admin/home-rows'),
  updateHomeRow: (id, patch) => adminFetch(`/admin/home-rows/${id}`, { method: 'PATCH', body: patch }),
  changePassword: (currentPassword, newPassword) =>
    adminFetch('/admin/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
};
