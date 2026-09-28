import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { env } from '../config/env.js';

const MOVIE_GENRES = [
  [28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'],
  [80, 'Crime'], [99, 'Documentary'], [18, 'Drama'], [10751, 'Family'],
  [14, 'Fantasy'], [36, 'History'], [27, 'Horror'], [10402, 'Music'],
  [9648, 'Mystery'], [10749, 'Romance'], [878, 'Science Fiction'],
  [53, 'Thriller'], [10752, 'War'], [37, 'Western'],
];

const TV_GENRES = [
  [10759, 'Action & Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'],
  [99, 'Documentary'], [18, 'Drama'], [10751, 'Family'], [10762, 'Kids'],
  [9648, 'Mystery'], [10763, 'News'], [10764, 'Reality'], [878, 'Science Fiction'],
  [10765, 'Soap'], [10766, 'Talk'], [10767, 'TV Movie'], [10752, 'War & Politics'],
  [37, 'Western'],
];

const HOME_ROWS = [
  { key: 'trending', label: 'Trending Now', source: 'tmdb:trending', media_type: null, sort_order: 10 },
  { key: 'popular', label: 'Popular', source: 'tmdb:popular', media_type: null, sort_order: 20 },
  { key: 'top_rated', label: 'Top Rated', source: 'tmdb:top_rated', media_type: null, sort_order: 30 },
  { key: 'popular_movies', label: 'Popular Movies', source: 'tmdb:popular', media_type: 'movie', sort_order: 40 },
  { key: 'popular_tv', label: 'Popular TV Series', source: 'tmdb:popular', media_type: 'tv', sort_order: 50 },
  { key: 'upcoming', label: 'Coming Soon', source: 'tmdb:upcoming', media_type: 'movie', sort_order: 60 },
  { key: 'hindi', label: 'Hindi Movies', source: 'tmdb:hindi', media_type: 'movie', sort_order: 65 },
  { key: 'kdrama', label: 'K-Dramas', source: 'tmdb:kdrama', media_type: 'tv', sort_order: 70 },
  { key: 'featured', label: 'Featured in the Vault', source: 'curated', media_type: null, sort_order: 5 },
];

const PROVIDERS = [
  { id: 'vidsrc', name: 'VidSrc', type: 'embed', priority: 10 },
  { id: 'vidlink', name: 'VidLink', type: 'embed', priority: 20 },
  { id: 'vidfast', name: 'VidFast', type: 'embed', priority: 30 },
  { id: 'autoembed', name: 'AutoEmbed', type: 'embed', priority: 40 },
  { id: 'vidnest', name: 'VidNest', type: 'embed', priority: 15 },
  { id: 'vidzee', name: 'Hindi', type: 'direct', priority: 17 },
  { id: 'nontongo', name: 'K-Drama', type: 'embed', priority: 18 },
  { id: 'vixsrc', name: 'VixSrc (direct)', type: 'direct', priority: 50 },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [id, name] of MOVIE_GENRES) {
      await client.query(
        `INSERT INTO genres (id, media_type, name) VALUES ($1, 'movie', $2)
         ON CONFLICT (id, media_type) DO UPDATE SET name = EXCLUDED.name`,
        [id, name]
      );
    }
    for (const [id, name] of TV_GENRES) {
      await client.query(
        `INSERT INTO genres (id, media_type, name) VALUES ($1, 'tv', $2)
         ON CONFLICT (id, media_type) DO UPDATE SET name = EXCLUDED.name`,
        [id, name]
      );
    }

    for (const row of HOME_ROWS) {
      await client.query(
        `INSERT INTO home_rows (key, label, source, media_type, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, source = EXCLUDED.source,
           media_type = EXCLUDED.media_type, sort_order = EXCLUDED.sort_order`,
        [row.key, row.label, row.source, row.media_type, row.sort_order]
      );
    }

    for (const p of PROVIDERS) {
      await client.query(
        `INSERT INTO providers (id, name, type, priority)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type,
           priority = EXCLUDED.priority`,
        [p.id, p.name, p.type, p.priority]
      );
    }

    const existing = await client.query('SELECT id FROM admins WHERE email = $1', [env.adminEmail]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(env.adminPassword, 10);
      await client.query(
        `INSERT INTO admins (email, password_hash, display_name) VALUES ($1, $2, $3)`,
        [env.adminEmail, hash, 'Vault Keeper']
      );
      console.log(`[seed] Admin created: ${env.adminEmail}`);
    } else {
      console.log(`[seed] Admin already exists: ${env.adminEmail}`);
    }

    await client.query('COMMIT');

    const counts = await client.query(`
      SELECT
        (SELECT count(*) FROM genres) AS genres,
        (SELECT count(*) FROM home_rows) AS rows,
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM admins) AS admins
    `);
    console.log('[seed] Done:', counts.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] Fatal:', err.message);
  process.exit(1);
});
