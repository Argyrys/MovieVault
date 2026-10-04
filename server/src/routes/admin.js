import { Router } from 'express';
import { one, many } from '../db/pool.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAuth } from './auth.js';
import { invalidateProviderCaches } from '../services/providers/registry.js';
import { invalidateHomeCache } from './catalog.js';

const router = Router();

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

async function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    (async () => {
      const user = await one(`SELECT id, role FROM users WHERE id = $1`, [req.auth.sub]);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
      }
      req.admin = req.auth;
      next();
    })().catch((e) => {
      if (e.code === 'DB_DISABLED') {
        e.status = 503;
        e.message = 'Database not connected. Set DATABASE_URL to enable the admin panel.';
      }
      next(e);
    });
  });
}

function badRequest(res, message) {
  return res.status(400).json({ error: 'BAD_REQUEST', message });
}

router.get('/dashboard', requireAdmin, dbRoute(async (req, res) => {
  const [stats, rows24h, published] = await Promise.all([
    one(`
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM providers WHERE enabled) AS providers_enabled,
        (SELECT count(*) FROM home_rows) AS rows,
        (SELECT count(*) FROM home_rows WHERE enabled) AS rows_enabled,
        (SELECT count(*) FROM admins) AS admins,
        (SELECT count(*) FROM titles) AS titles,
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM users WHERE role = 'admin') AS users_admin
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
    admins: Number(stats.users_admin),
    users: Number(stats.users),
    titles: Number(stats.titles),
    titlesPublished: Number(published.count),
    downloads24h: Number(rows24h.count),
  });
}));

router.get('/users', requireAdmin, dbRoute(async (req, res) => {
  const rows = await many(
    `SELECT id, email, display_name, role, created_at, last_login_at
     FROM users ORDER BY created_at ASC`
  );
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    })),
  });
}));

router.patch('/users/:id', requireAdmin, dbRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid user id.');
  if (id === req.admin.sub) return badRequest(res, 'You cannot change your own role.');

  const role = String(req.body?.role || '');
  if (role !== 'admin' && role !== 'user') return badRequest(res, 'role must be "admin" or "user".');

  const row = await one(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, display_name, role`,
    [role, id]
  );
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });

  res.json({
    user: { id: row.id, email: row.email, displayName: row.display_name, role: row.role },
  });
}));

router.delete('/users/:id', requireAdmin, dbRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid user id.');
  if (id === req.admin.sub) return badRequest(res, 'You cannot delete your own account.');

  const target = await one(`SELECT id, role FROM users WHERE id = $1`, [id]);
  if (!target) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });

  if (target.role === 'admin') {
    const admins = await one(`SELECT count(*) AS c FROM users WHERE role = 'admin'`);
    if (Number(admins.c) <= 1) return badRequest(res, 'Cannot delete the last admin account.');
  }

  const row = await one(`DELETE FROM users WHERE id = $1 RETURNING id`, [id]);
  res.json({ ok: true, deleted: row.id });
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

export default router;
