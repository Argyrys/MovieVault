const API_BASE = 'https://new.vidnest.fun';
const SUB_BASE = 'https://sub.vdrk.site/v2';
const EMBED_BASE = 'https://vidnest.fun';
const PAGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const ALPHABET = 'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=';

function embedUrl({ type, tmdbId, season, episode }) {
  return type === 'movie'
    ? `${EMBED_BASE}/movie/${tmdbId}?autoplay=true`
    : `${EMBED_BASE}/tv/${tmdbId}/${season}/${episode}?autoplay=true`;
}

function decodeCipher(json) {
  if (!json || !json.encrypted) return json;
  if (typeof json.data !== 'string') throw new Error('vidnest: missing cipher data');
  const map = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]] = i;
  const bytes = [];
  for (let i = 0; i < json.data.length; i += 4) {
    let grp = json.data.slice(i, i + 4);
    while (grp.length < 4) grp += '=';
    const l = [...grp].map((c) => (map[c] === undefined ? 64 : map[c]));
    bytes.push((l[0] << 2) | (l[1] >> 4));
    if (l[2] !== 64) bytes.push(((l[1] & 15) << 4) | (l[2] >> 2));
    if (l[3] !== 64) bytes.push(((l[2] & 3) << 6) | l[3]);
  }
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
}

async function fetchJson(url, timeoutMs) {
  const res = await fetch(url, {
    headers: { 'user-agent': PAGE_UA, referer: `${EMBED_BASE}/`, accept: 'application/json' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`vidnest fetch ${res.status}`);
  return res.json();
}

async function getSubtitles({ type, tmdbId, season, episode }) {
  try {
    const url =
      type === 'tv'
        ? `${SUB_BASE}/tv/${tmdbId}/${season}/${episode}`
        : `${SUB_BASE}/movie/${tmdbId}`;
    const list = await fetchJson(url, 5000);
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    const preferred = list.filter((i) => i && /english/i.test(String(i.label || '')));
    const rest = list.filter((i) => i && !/english/i.test(String(i.label || '')));
    for (const item of [...preferred, ...rest]) {
      if (!item || typeof item.file !== 'string' || !item.file.startsWith('https://')) continue;
      const label = String(item.label || 'Subtitle').slice(0, 60);
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ url: item.file, label, lang: null });
      if (out.length >= 16) break;
    }
    return out;
  } catch {
    return [];
  }
}

export default {
  id: 'vidnest',
  name: 'VidNest',
  kind: 'embed',
  async getStreams(args) {
    try {
      const apiPath =
        args.type === 'movie'
          ? `${API_BASE}/nextgencloudfabric/movie/${args.tmdbId}`
          : `${API_BASE}/nextgencloudfabric/tv/${args.tmdbId}/${args.season}/${args.episode}`;
      const [stream, subtitles] = await Promise.all([
        fetchJson(apiPath, 6000).then(decodeCipher),
        getSubtitles(args),
      ]);
      if (!stream?.url || typeof stream.url !== 'string' || !stream.url.startsWith('https://')) {
        throw new Error('vidnest: no stream url');
      }
      const headers = {};
      if (stream.headers && typeof stream.headers === 'object') {
        for (const [k, v] of Object.entries(stream.headers)) {
          if (typeof v === 'string') headers[k] = v;
        }
      }
      headers['user-agent'] = headers['User-Agent'] || PAGE_UA;
      delete headers['User-Agent'];
      return [
        {
          type: 'direct',
          kind: 'direct',
          url: stream.url,
          quality: 'auto',
          subtitles,
          headers,
        },
      ];
    } catch {
      return [{ type: 'embed', kind: 'embed', url: embedUrl(args), quality: 'auto' }];
    }
  },
};
