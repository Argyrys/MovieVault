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
