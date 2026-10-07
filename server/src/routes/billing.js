import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { one } from '../db/pool.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAuth, signToken, publicUser, normalizePremium } from './auth.js';

const router = Router();

export const PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Monthly',
    price: 99,
    currency: 'INR',
    symbol: '₹',
    days: 30,
  },
};

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' },
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

router.get('/plans', (req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

router.post('/checkout', checkoutLimiter, requireAuth, dbRoute(async (req, res) => {
  const planId = String(req.body?.planId || '');
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Unknown plan.' });

  const user = await one(
    `SELECT id, email, display_name, role, is_prime, premium_expires_at FROM users WHERE id = $1`,
    [req.auth.sub]
  );
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Account no longer exists.' });
  normalizePremium(user);
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'FORBIDDEN', message: 'Admin accounts already include Premium.' });
  }

  const now = Date.now();
  const current =
    user.role === 'premium' && user.premium_expires_at ? new Date(user.premium_expires_at).getTime() : 0;
  const base = Math.max(now, current);
  const expiresAt = new Date(base + plan.days * 24 * 60 * 60 * 1000);

  const updated = await one(
    `UPDATE users SET role = 'premium', premium_expires_at = $1
     WHERE id = $2 AND role <> 'admin'
     RETURNING id, email, display_name, role, is_prime, premium_expires_at`,
    [expiresAt.toISOString(), user.id]
  );

  res.json({ token: signToken(updated), user: publicUser(updated), plan: plan.id });
}));

export default router;
