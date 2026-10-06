INSERT INTO home_rows (key, label, source, media_type, sort_order, enabled)
VALUES (
  'latest',
  'Latest Releases',
  'tmdb:latest',
  NULL,
  GREATEST(COALESCE((SELECT sort_order FROM home_rows WHERE key = 'trending'), 10) - 1, 1),
  TRUE
)
ON CONFLICT (key) DO NOTHING;
