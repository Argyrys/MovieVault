-- Monthly premium subscription: expiry timestamp on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;
