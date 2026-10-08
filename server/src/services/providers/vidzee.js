const REFERER = 'https://player.vidzee.wtf/';
const BASE = 'https://core.vidzee.wtf';

// Only v4 is verified as genuine Hindi audio (correlated against the English
// baselines: v4 corr ~0.57 vs 0.986 for same-language pairs). v5 and v6 return
// language "Hindi" but their audio correlates 0.985 with English (lag 0) -
// they are mislabelled and were the English playback users reported. dcloud/tik
// are honest English fallbacks ("Auto"). Capped at ~7.4s to stay under the
// registry's 8s provider budget.
// All three are returned as separate servers: some upstreams (e.g. v4's host)
// reject cloud egress, so clients must be able to fall back to the next one
// for both playback and download.
const SERVERS = [
  { id: 'v4:Hindi', key: 'v4', name: 'Hindi', timeout: 4000 },
  { id: 'dcloud', key: 'dcloud', name: 'English', timeout: 1600 },
  { id: 'tik', key: 'tik', name: 'English 2', timeout: 1200 },
];

async function fetchStream(server, { type, tmdbId, season, episode }, deadline) {
  const path =
    type === 'movie'
      ? `/streams/movie/${tmdbId}?s=${encodeURIComponent(server.id)}&e=0`
      : `/streams/tv/${tmdbId}/${season}/${episode}?s=${encodeURIComponent(server.id)}&e=0`;
  // upstreams flap with instant 502s - retry once while budget remains
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { referer: REFERER, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(Math.min(server.timeout, remaining)),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.url) return null;
      let headers = {};
      try {
        const host = new URL(data.url).host;
        if (host.endsWith('hakunaymatata.com')) {
          // blocks the vidzee referer (429) and browser UAs (428)
          headers = { 'user-agent': 'curl/8.5.0' };
        } else {
          // upstream-specific headers from the API (e.g. v4 needs its own referer)
          if (data.headers && typeof data.headers === 'object') {
            for (const [k, v] of Object.entries(data.headers)) {
              if (typeof v === 'string' && v) headers[k] = v;
            }
          }
          if (!headers.Referer && !headers.referer) headers.referer = REFERER;
        }
      } catch {
        headers = { referer: REFERER };
      }
      return {
        id: `vidzee-${server.key}`,
        name: server.name,
        type: 'direct',
        url: data.url,
        quality: 'auto',
        language: data.language || (server.id.includes('Hindi') ? 'Hindi' : null),
        headers,
      };
    } catch {
      // transient failure (fast 502 / timeout) - retry this server
    }
  }
  return null;
}

export default {
  id: 'vidzee',
  name: 'VidZee',
  kind: 'direct',
  async getStreams(params) {
    const deadline = Date.now() + 7400;
    const results = await Promise.all(SERVERS.map((server) => fetchStream(server, params, deadline)));
    return results.filter(Boolean);
  },
};
