-- Users table: public accounts with roles

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'User',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

INSERT INTO users (email, password_hash, display_name, role)
SELECT a.email, a.password_hash, a.display_name, 'admin'
FROM admins a
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE lower(u.email) = lower(a.email)
);
