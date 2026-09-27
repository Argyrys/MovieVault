import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import { getServers } from '../services/providers/registry.js';
import { decodeProxy, isSafeUpstream, proxiedUrl } from '../services/proxyutil.js';
import { TmdbError } from '../services/tmdb.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function validateParams(req) {
  const type = req.params.type;
  if (type !== 'movie' && type !== 'tv') throw new TmdbError('Type must be "movie" or "tv"', 400);
  const tmdbId = Number(req.params.id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new TmdbError('Invalid title id', 400);

  let season;
  let episode;
  if (type === 'tv') {
    season = Number(req.query.season);
    episode = Number(req.query.episode);
    if (!Number.isInteger(season) || season < 1 || season > 300) {
      throw new TmdbError('A valid "season" query param is required for TV', 400);
    }
    if (!Number.isInteger(episode) || episode < 1 || episode > 1000) {
      throw new TmdbError('A valid "episode" query param is required for TV', 400);
    }
  }
  return { type, tmdbId, season, episode };
}

router.get(
  '/:type/:id',
  asyncHandler(async (req, res) => {
    const { type, tmdbId, season, episode } = validateParams(req);
    const { servers, generated_at, cached } = await getServers({ type, tmdbId, season, episode });

    const payload = servers.map((s) => {
      if (s.type === 'embed') return s;
      return {
        ...s,
        url: proxiedUrl(s.url, s.headers || {}),
        hls: s.url.includes('.m3u8'),
        upstream_headers: undefined,
        headers: undefined,
      };
    });

    res.json({
      type,
      tmdb_id: tmdbId,
      season: season ?? null,
      episode: episode ?? null,
      servers: payload,
      generated_at,
      cached: Boolean(cached),
    });
  })
);

const MANIFEST_CONTENT_TYPES = /mpegurl|x-mpegurl|vnd\.apple\.mpegurl/i;

function rewriteManifest(body, baseUrl, headers) {
  const lines = body.split(/\r?\n/);
  const out = lines.map((line) => {
    if (!line.trim()) return line;
    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          const abs = new URL(uri, baseUrl).toString();
          return `URI="${proxiedUrl(abs, headers)}"`;
        } catch {
          return match;
        }
      });
    }
    try {
      const abs = new URL(line.trim(), baseUrl).toString();
      return proxiedUrl(abs, headers);
    } catch {
      return line;
    }
  });
  return out.join('\n');
}

router.get(
  '/proxy',
  asyncHandler(async (req, res) => {
    const decoded = decodeProxy(req.query.s);
    if (!decoded) throw new TmdbError('Invalid proxy payload', 400);

    const check = isSafeUpstream(decoded.url);
    if (!check.ok) throw new TmdbError(`Upstream rejected: ${check.reason}`, 400);

    const headers = {
      'user-agent': UA,
      ...decoded.headers,
    };
    const range = req.headers.range;
    if (range) headers.range = range;

    let upstream;
    try {
      upstream = await fetch(check.url, { headers, signal: AbortSignal.timeout(25_000), redirect: 'follow' });
    } catch (err) {
      throw new TmdbError(`Upstream fetch failed: ${err.message}`, 502);
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isManifest =
      MANIFEST_CONTENT_TYPES.test(contentType) ||
      (upstream.status === 200 && check.url.split('?')[0].endsWith('.m3u8'));

    if (isManifest && upstream.status === 200) {
      const text = await upstream.text();
      const rewritten = rewriteManifest(text, check.url, decoded.headers);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(rewritten);
    }

    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader('Cache-Control', 'no-store');
    if (!upstream.body) return res.end();

    return await pipeline(Readable.fromWeb(upstream.body), res);
  })
);

export default router;
