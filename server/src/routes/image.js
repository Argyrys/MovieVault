import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Vercel serverless: root FS is read-only, /tmp is writable
const CACHE_DIR = process.env.VERCEL
  ? path.join('/tmp', 'movievault-images')
  : path.resolve(__dirname, '../../media-cache/images');

const ALLOWED_SIZES = new Set([
  'w92', 'w154', 'w185', 'w342', 'w500', 'w784',
  'w300', 'w780', 'w1280',
  'h632',
  'original',
]);

const FILE_RE = /^\/[A-Za-z0-9_-]+\.jpg$/;

const router = Router();

router.get(
  '/:size/:file',
  asyncHandler(async (req, res) => {
    const size = req.params.size;
    let file = req.params.file;
    try {
      file = decodeURIComponent(file);
    } catch {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid image path' });
    }
    if (!file.startsWith('/')) file = `/${file}`;

    if (!ALLOWED_SIZES.has(size) || !FILE_RE.test(file)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid image size or path' });
    }

    const cachePath = path.join(CACHE_DIR, `${size}${file}`);
    const imageHeaders = () => {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      res.setHeader('Content-Type', 'image/jpeg');
    };

    if (fs.existsSync(cachePath)) {
      imageHeaders();
      return fs.createReadStream(cachePath).pipe(res);
    }

    const upstream = `${env.tmdbImageBaseUrl}/${size}${file}`;
    let upstreamRes;
    try {
      upstreamRes = await fetch(upstream, { signal: AbortSignal.timeout(12_000) });
    } catch (err) {
      return res.status(502).json({ error: 'UPSTREAM_ERROR', message: `Image fetch failed: ${err.message}` });
    }

    if (upstreamRes.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Image not found' });
    }
    if (!upstreamRes.ok || !upstreamRes.body) {
      return res.status(502).json({ error: 'UPSTREAM_ERROR', message: `Image upstream ${upstreamRes.status}` });
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    try {
      await fsp.mkdir(path.dirname(cachePath), { recursive: true });
      await fsp.writeFile(cachePath, buf);
    } catch {
      // disk unavailable (e.g. serverless read-only FS) — serve without caching
    }

    imageHeaders();
    res.setHeader('Content-Length', buf.length);
    return res.end(buf);
  })
);

export default router;
