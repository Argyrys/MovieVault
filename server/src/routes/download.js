import { Router } from 'express';
import { one } from '../db/pool.js';
import { asyncHandler } from '../middleware/errors.js';
import { TmdbError } from '../services/metadata.js';

const router = Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const type = String(req.body?.type || '');
    const tmdbId = Number(req.body?.id);
    if (type !== 'movie' && type !== 'tv') throw new TmdbError('Type must be "movie" or "tv"', 400);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new TmdbError('Invalid title id', 400);

    const provider = String(req.body?.provider || '').slice(0, 40) || null;
    const quality = String(req.body?.quality || '').slice(0, 40) || null;

    try {
      await one(
        `INSERT INTO download_stats (media_type, tmdb_id, provider, quality) VALUES ($1, $2, $3, $4)`,
        [type, tmdbId, provider, quality]
      );
    } catch (err) {
      console.warn('[download] stat log failed:', err.message);
    }

    res.json({ ok: true });
  })
);

export default router;
