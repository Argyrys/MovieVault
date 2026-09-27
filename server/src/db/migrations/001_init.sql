-- MovieVault initial schema

CREATE TABLE IF NOT EXISTS genres (
  id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  name TEXT NOT NULL,
  PRIMARY KEY (id, media_type)
);

CREATE TABLE IF NOT EXISTS titles (
  id SERIAL PRIMARY KEY,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  release_date DATE,
  runtime INTEGER,
  vote_average NUMERIC(4, 1) NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  popularity NUMERIC(12, 4) NOT NULL DEFAULT 0,
  trailer_key TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'hidden')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_type, tmdb_id)
);

CREATE INDEX IF NOT EXISTS idx_titles_media_type ON titles (media_type);
CREATE INDEX IF NOT EXISTS idx_titles_popularity ON titles (popularity DESC);
CREATE INDEX IF NOT EXISTS idx_titles_vote_average ON titles (vote_average DESC);
CREATE INDEX IF NOT EXISTS idx_titles_release_date ON titles (release_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_titles_featured ON titles (featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_titles_title_search ON titles USING gin (to_tsvector('simple', title));

CREATE TABLE IF NOT EXISTS title_genres (
  title_id INTEGER NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  PRIMARY KEY (title_id, genre_id)
);

CREATE TABLE IF NOT EXISTS home_rows (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'tmdb:popular',
  media_type TEXT CHECK (media_type IN ('movie', 'tv')),
  genre_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS row_items (
  row_id INTEGER NOT NULL REFERENCES home_rows (id) ON DELETE CASCADE,
  title_id INTEGER NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  PRIMARY KEY (row_id, title_id)
);

CREATE INDEX IF NOT EXISTS idx_row_items_order ON row_items (row_id, sort_order);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('embed', 'direct')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS download_stats (
  id BIGSERIAL PRIMARY KEY,
  media_type TEXT CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER,
  provider TEXT,
  quality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_stats_created ON download_stats (created_at DESC);
