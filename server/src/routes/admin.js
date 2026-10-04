import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { one, many } from '../db/pool.js';
import { asyncHandler } from '../middleware/errors.js';
import { invalidateProviderCaches } from '../services/providers/registry.js';
import { invalidateHomeCache } from './catalog.js';

const router = Router();

const TOKEN_TTL = '12h';
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many login attempts. Try again in 15 minutes.' },
});

function dbRoute(fn) {
  return asyncHandler(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (err.code === 'DB_DISABLED') {
        err.status = 503;
        err.message = 'Database not connected. Set DATABASE_URL to enable the admin panel.';
      }
      throw err;
    }
  });
}

function signToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, name: admin.display_name },
    env.jwtSecret,
    { expiresIn: TOKEN_TTL }
  );
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Login required.' });
  }
  try {
    req.admin = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session expired. Please log in again.' });
  }
}

function badRequest(res, message) {
  return res.status(400).json({ error: 'BAD_REQUEST', message });
}

router.post('/login', loginLimiter, dbRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return badRequest(res, 'Email and password are required.');

  const admin = await one(`SELECT id, email, password_hash, display_name FROM admins WHERE lower(email) = $1`, [email]);
  const ok = admin ? await bcrypt.compare(password, admin.password_hash) : false;
  if (!ok || !admin) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
  }

  one(`UPDATE admins SET last_login_at = now() WHERE id = $1`, [admin.id]).catch(() => {});

  res.json({
    token: signToken(admin),
    expiresInSeconds: TOKEN_TTL_SECONDS,
    admin: { id: admin.id, email: admin.email, displayName: admin.display_name },
  });
}));

router.get('/me', requireAdmin, dbRoute(async (req, res) => {
  const admin = await one(
    `SELECT id, email, display_name, last_login_at FROM admins WHERE id = $1`,
    [req.admin.sub]
  );
  if (!admin) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Account no longer exists.' });
  res.json({
    id: admin.id,
    email: admin.email,
    displayName: admin.display_name,
    lastLoginAt: admin.last_login_at,
  });
}));

router.get('/dashboard', requireAdmin, dbRoute(async (req, res) => {
  const [stats, rows24h, published] = await Promise.all([
    one(`
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM providers WHERE enabled) AS providers_enabled,
        (SELECT count(*) FROM home_rows) AS rows,
        (SELECT count(*) FROM home_rows WHERE enabled) AS rows_enabled,
        (SELECT count(*) FROM admins) AS admins,
        (SELECT count(*) FROM titles) AS titles
    `),
    one(`SELECT count(*) FROM download_stats WHERE created_at > now() - interval '24 hours'`),
    one(`SELECT count(*) FROM titles WHERE status = 'published'`),
  ]);
  res.json({
    db: 'up',
    providers: Number(stats.providers),
    providersEnabled: Number(stats.providers_enabled),
    rows: Number(stats.rows),
    rowsEnabled: Number(stats.rows_enabled),
    admins: Number(stats.admins),
    titles: Number(stats.titles),
    titlesPublished: Number(published.count),
    downloads24h: Number(rows24h.count),
  });
}));

router.get('/providers', requireAdmin, dbRoute(async (req, res) => {
  const rows = await many(
    `SELECT id, name, type, enabled, priority FROM providers ORDER BY priority ASC, id ASC`
  );
  res.json({
    providers: rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      enabled: r.enabled,
      priority: r.priority,
    })),
  });
}));

router.patch('/providers/:id', requireAdmin, dbRoute(async (req, res) => {
  const id = String(req.params.id || '');
  const { enabled, priority } = req.body || {};

  const sets = [];
  const params = [];
  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') return badRequest(res, 'enabled must be a boolean.');
    params.push(enabled);
    sets.push(`enabled = $${params.length}`);
  }
  if (priority !== undefined) {
    const p = Number(priority);
    if (!Number.isInteger(p) || p < 1 || p > 1000) return badRequest(res, 'priority must be 1-1000.');
    params.push(p);
    sets.push(`priority = $${params.length}`);
  }
  if (sets.length === 0) return badRequest(res, 'Nothing to update.');

  params.push(id);
  const row = await one(
    `UPDATE providers SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${params.length}
     RETURNING id, name, type, enabled, priority`,
    params
  );
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Provider not found.' });

  invalidateProviderCaches();
  res.json({ provider: row });
}));

router.get('/home-rows', requireAdmin, dbRoute(async (req, res) => {
  const rows = await many(
    `SELECT id, key, label, source, media_type, sort_order, enabled
     FROM home_rows ORDER BY sort_order ASC, id ASC`
  );
  res.json({
    rows: rows.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      source: r.source,
      mediaType: r.media_type,
      sortOrder: r.sort_order,
      enabled: r.enabled,
    })),
  });
}));

router.patch('/home-rows/:id', requireAdmin, dbRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid row id.');
  const { enabled, label, sortOrder } = req.body || {};

  const sets = [];
  const params = [];
  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') return badRequest(res, 'enabled must be a boolean.');
    params.push(enabled);
    sets.push(`enabled = $${params.length}`);
  }
  if (label !== undefined) {
    const l = String(label).trim();
    if (!l || l.length > 60) return badRequest(res, 'label must be 1-60 characters.');
    params.push(l);
    sets.push(`label = $${params.length}`);
  }
  if (sortOrder !== undefined) {
    const s = Number(sortOrder);
    if (!Number.isInteger(s) || s < 0 || s > 10000) return badRequest(res, 'sortOrder must be 0-10000.');
    params.push(s);
    sets.push(`sort_order = $${params.length}`);
  }
  if (sets.length === 0) return badRequest(res, 'Nothing to update.');

  params.push(id);
  const row = await one(
    `UPDATE home_rows SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, key, label, source, media_type, sort_order, enabled`,
    params
  );
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Home row not found.' });

  invalidateHomeCache();
  res.json({
    row: {
      id: row.id,
      key: row.key,
      label: row.label,
      source: row.source,
      mediaType: row.media_type,
      sortOrder: row.sort_order,
      enabled: row.enabled,
    },
  });
}));

router.post('/change-password', requireAdmin, dbRoute(async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (!current || !next) return badRequest(res, 'Current and new password are required.');
  if (next.length < 8) return badRequest(res, 'New password must be at least 8 characters.');

  const admin = await one(`SELECT id, password_hash FROM admins WHERE id = $1`, [req.admin.sub]);
  if (!admin) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Account no longer exists.' });

  const ok = await bcrypt.compare(current, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' });

  const hash = await bcrypt.hash(next, 10);
  await one(`UPDATE admins SET password_hash = $1 WHERE id = $2`, [hash, admin.id]);
  res.json({ ok: true });
}));

export default router;
