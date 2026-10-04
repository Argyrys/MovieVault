-- Prime admin: the single protected owner account that cannot be demoted or deleted

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_prime boolean NOT NULL DEFAULT false;

UPDATE users
SET is_prime = true
WHERE id = (
  SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1
)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_prime);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_one_prime ON users (is_prime) WHERE is_prime;
