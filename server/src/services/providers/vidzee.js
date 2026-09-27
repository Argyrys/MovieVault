const REFERER = 'https://player.vidzee.wtf/';
const BASE = 'https://core.vidzee.wtf';

// v6:Hindi first so Indian titles get Hindi audio when that server has a stream
const SERVERS = [
  { id: 'v6:Hindi', timeout: 3000 },
  { id: 'dcloud', timeout: 2000 },
  { id: 'tik', timeout: 2000 },
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
          return [
            {
              type: 'direct',
              url: data.url,
              quality: 'auto',
              headers: { referer: REFERER },
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
