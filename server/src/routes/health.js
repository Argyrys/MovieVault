import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/errors.js';
import { tmdbConfigured } from '../services/tmdb.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  let db = 'down';
  try {
    await query('SELECT 1');
    db = 'up';
  } catch (err) {
    db = err.code === 'DB_DISABLED' ? 'disabled' : 'down';
  }
  res.json({
    status: 'ok',
    service: 'movievault-api',
    db,
    tmdb: tmdbConfigured() ? 'configured' : 'missing_key',
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
}));

export default router;
