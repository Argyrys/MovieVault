const REFERER = 'https://player.vidzee.wtf/';
const BASE = 'https://core.vidzee.wtf';

// Hindi servers first so English titles auto-play in Hindi; capped at ~7.7s
// to stay under the registry's 8s provider budget
const SERVERS = [
  { id: 'v6:Hindi', timeout: 3000 },
  { id: 'v5:Hindi', timeout: 2000 },
  { id: 'dcloud', timeout: 1500 },
  { id: 'tik', timeout: 1200 },
];

export default {
  id: 'vidzee',
  name: 'VidZee',
  kind: 'direct',
  async getStreams({ type, tmdbId, season, episode }) {
    for (const server of SERVERS) {
      const path =
        type === 'movie'
          ? `/streams/movie/${tmdbId}?s=${encodeURIComponent(server.id)}&e=0`
          : `/streams/tv/${tmdbId}/${season}/${episode}?s=${encodeURIComponent(server.id)}&e=0`;
      try {
        const res = await fetch(`${BASE}${path}`, {
          headers: { referer: REFERER, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(server.timeout),
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.url) {
          let headers;
          try {
            const host = new URL(data.url).host;
            if (host.endsWith('hakunaymatata.com')) {
              // blocks the vidzee referer (429) and browser UAs (428)
              headers = { referer: undefined, 'user-agent': 'curl/8.5.0' };
              delete headers.referer;
            } else {
              headers = { referer: REFERER };
            }
          } catch {
            headers = { referer: REFERER };
          }
          return [
            {
              type: 'direct',
              url: data.url,
              quality: 'auto',
              language: data.language || (server.id.includes('Hindi') ? 'Hindi' : null),
              headers,
            },
          ];
        }
      } catch {
        // try next server
      }
    }
    return [];
  },
};
