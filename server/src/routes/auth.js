import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { one } from '../db/pool.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many sign-up attempts. Try again later.' },
});

function dbRoute(fn) {
  return asyncHandler(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (err.code === 'DB_DISABLED') {
        err.status = 503;
        err.message = 'Database not connected. Set DATABASE_URL to enable accounts.';
      }
      throw err;
    }
  });
}

export function signToken(user) {
  const role = user.role === 'admin' || user.role === 'premium' ? user.role : 'user';
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.display_name, role },
    env.jwtSecret,
    { expiresIn: role === 'admin' ? '12h' : '7d' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sign in required.' });
  }
  try {
    req.auth = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session expired. Please sign in again.' });
  }
}

function publicUser(row) {
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, isPrime: row.is_prime === true };
}

router.post('/register', registerLimiter, dbRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim() || email.split('@')[0];

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Password must be at least 8 characters.' });
  if (displayName.length > 40) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Display name must be 40 characters or fewer.' });

  const clash = await one(`SELECT 1 FROM users WHERE lower(email) = $1`, [email]);
  if (clash) {
    return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'An account with this email already exists.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await one(
    `INSERT INTO users (email, password_hash, display_name, role, is_prime)
     VALUES ($1, $2, $3, 'user', false)
     RETURNING id, email, display_name, role, is_prime`,
    [email, hash, displayName]
  );

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post('/login', loginLimiter, dbRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email and password are required.' });

  const user = await one(`SELECT id, email, password_hash, display_name, role, is_prime FROM users WHERE lower(email) = $1`, [email]);
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!ok || !user) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
  }

  one(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]).catch(() => {});

  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, dbRoute(async (req, res) => {
  const user = await one(`SELECT id, email, display_name, role, is_prime FROM users WHERE id = $1`, [req.auth.sub]);
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Account no longer exists.' });
  res.json(publicUser(user));
}));

router.post('/change-password', requireAuth, dbRoute(async (req, res) => {
  const gate = await one(`SELECT is_prime FROM users WHERE id = $1`, [req.auth.sub]);
  if (!gate || !gate.is_prime) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the prime admin can change passwords.' });
  }

  const current = String(req.body?.currentPassword || '');
  const nextPw = String(req.body?.newPassword || '');
  if (!current || !nextPw) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Current and new password are required.' });
  if (nextPw.length < 8) return res.status(400).json({ error: 'BAD_REQUEST', message: 'New password must be at least 8 characters.' });

  const user = await one(`SELECT id, password_hash FROM users WHERE id = $1`, [req.auth.sub]);
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Account no longer exists.' });

  const ok = await bcrypt.compare(current, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' });

  const hash = await bcrypt.hash(nextPw, 10);
  await one(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, user.id]);
  res.json({ ok: true });
}));

export default router;
