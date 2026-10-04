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

// VidNest's designated Hindi bridge ("delta" in their player). Movies only:
// their TV handling for this bridge is unverified, and K-dramas should keep
// their original audio anyway. Returns null when Hindi isn't available.
async function tryHindiBridge(tmdbId, timeoutMs) {
  const data = decodeCipher(await fetchJson(`${API_BASE}/allmovies/movie/${tmdbId}`, timeoutMs));
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  const hindi = streams.find(
    (s) =>
      s &&
      typeof s.language === 'string' &&
      s.language.toLowerCase() === 'hindi' &&
      typeof s.url === 'string' &&
      s.url.startsWith('https://')
  );
  return hindi || null;
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
      const [hindi, stream, subtitles] = await Promise.all([
        args.type === 'movie' ? tryHindiBridge(args.tmdbId, 2500).catch(() => null) : null,
        fetchJson(apiPath, 5500).then(decodeCipher).catch(() => null),
        getSubtitles(args),
      ]);
      const chosen = hindi || stream;
      if (!chosen?.url || typeof chosen.url !== 'string' || !chosen.url.startsWith('https://')) {
        throw new Error('vidnest: no stream url');
      }
      const headers = {};
      if (chosen.headers && typeof chosen.headers === 'object') {
        for (const [k, v] of Object.entries(chosen.headers)) {
          if (typeof v === 'string') headers[k] = v;
        }
      }
      headers['user-agent'] = headers['User-Agent'] || PAGE_UA;
      delete headers['User-Agent'];
      return [
        {
          type: 'direct',
          kind: 'direct',
          url: chosen.url,
          quality: 'auto',
          language: hindi ? 'Hindi' : null,
          subtitles,
          headers,
        },
      ];
    } catch {
      return [{ type: 'embed', kind: 'embed', url: embedUrl(args), quality: 'auto' }];
    }
  },
};
