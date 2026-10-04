import { Router } from 'express';
import NodeCache from 'node-cache';
import { one, many } from '../db/pool.js';
import { tmdb, TmdbError, imageUrl } from '../services/metadata.js';
import { toItem, toList, toHero, dbRowToNormalized } from '../services/serialize.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

const homeCache = new NodeCache({ stdTTL: 60, useClones: false });
let homeLastGood = null;

export function invalidateHomeCache() {
  homeCache.del('home');
}

const DEFAULT_HOME_ROWS = [
  { key: 'trending', label: 'Trending Now', source: 'tmdb:trending', media_type: null },
  { key: 'popular', label: 'Popular', source: 'tmdb:popular', media_type: null },
  { key: 'top_rated', label: 'Top Rated', source: 'tmdb:top_rated', media_type: null },
  { key: 'popular_movies', label: 'Popular Movies', source: 'tmdb:popular', media_type: 'movie' },
  { key: 'popular_tv', label: 'Popular TV Series', source: 'tmdb:popular', media_type: 'tv' },
  { key: 'upcoming', label: 'Coming Soon', source: 'tmdb:upcoming', media_type: 'movie' },
  { key: 'hindi', label: 'Hindi Movies', source: 'tmdb:hindi', media_type: 'movie' },
  { key: 'kdrama', label: 'K-Dramas', source: 'tmdb:kdrama', media_type: 'tv' },
  { key: 'kdrama_new', label: 'New K-Dramas', source: 'tmdb:kdrama_new', media_type: 'tv' },
  { key: 'kdrama_top', label: 'Top-Rated K-Dramas', source: 'tmdb:kdrama_top', media_type: 'tv' },
];

const SORTS = {
  popular: { movie: 'popularity.desc', tv: 'popularity.desc' },
  rating: { movie: 'vote_average.desc', tv: 'vote_average.desc' },
  recent: { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' },
  oldest: { movie: 'primary_release_date.asc', tv: 'first_air_date.asc' },
  title: { movie: 'title.asc', tv: 'name.asc' },
};

function validateType(type) {
  if (type !== 'movie' && type !== 'tv') {
    throw new TmdbError('Type must be "movie" or "tv"', 400);
  }
}

function validateId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new TmdbError('Invalid title id', 400);
  return n;
}

function mergeByPopularity(a, b) {
  return [...a, ...b].sort((x, y) => y.popularity - x.popularity).slice(0, 20);
}

async function curatedRow(row) {
  const rows = await many(
    `SELECT t.media_type, t.tmdb_id, t.title, t.overview, t.poster_path, t.backdrop_path,
            to_char(t.release_date, 'YYYY-MM-DD') AS release_date,
            t.vote_average, t.vote_count, t.popularity
     FROM row_items ri
     JOIN titles t ON t.id = ri.title_id
     WHERE ri.row_id = $1 AND t.status = 'published'
     ORDER BY ri.sort_order ASC`,
    [row.id]
  );
  return rows.map(dbRowToNormalized);
}

async function fetchRowItems(row) {
  switch (row.source) {
    case 'tmdb:trending':
      return (await tmdb.trending(row.media_type || 'all')).results;
    case 'tmdb:popular': {
      if (row.media_type) return (await tmdb.popular(row.media_type)).results;
      const [m, t] = await Promise.all([tmdb.popular('movie'), tmdb.popular('tv')]);
      return mergeByPopularity(m.results, t.results);
    }
    case 'tmdb:top_rated': {
      if (row.media_type) return (await tmdb.topRated(row.media_type)).results;
      const [m, t] = await Promise.all([tmdb.topRated('movie'), tmdb.topRated('tv')]);
      return mergeByPopularity(m.results, t.results);
    }
    case 'tmdb:upcoming':
      return (await tmdb.upcoming()).results;
    case 'tmdb:on_the_air':
      return (await tmdb.onTheAir()).results;
    case 'tmdb:hindi':
      return (await tmdb.discover('movie', { lang: 'hi', sort: 'popularity.desc' })).results;
    case 'tmdb:kdrama': {
      const [a, b] = await Promise.all([
        tmdb.discover('tv', { lang: 'ko', genre: '18', sort: 'popularity.desc', page: 1 }),
        tmdb.discover('tv', { lang: 'ko', genre: '18', sort: 'popularity.desc', page: 2 }),
      ]);
      return [...a.results, ...b.results].slice(0, 40);
    }
    case 'tmdb:kdrama_new':
      return (await tmdb.discover('tv', { lang: 'ko', genre: '18', sort: 'first_air_date.desc' })).results;
    case 'tmdb:kdrama_top':
      return (
        await tmdb.discover('tv', { lang: 'ko', genre: '18', sort: 'vote_average.desc', voteMin: 100 })
      ).results;
    case 'curated':
      return curatedRow(row);
    default:
      return curatedRow(row);
  }
}

async function pickHero() {
  let featured = null;
  try {
    featured = await one(
      `SELECT media_type, tmdb_id, title FROM titles
       WHERE featured = TRUE AND status = 'published'
       ORDER BY updated_at DESC LIMIT 1`
    );
  } catch (err) {
    console.warn(`[home] featured lookup unavailable: ${err.message}`);
  }
  const source = featured
    ? { type: featured.media_type, id: featured.tmdb_id }
    : await (async () => {
        const trending = await tmdb.trending('all');
        const withBackdrop = trending.results.find((r) => r.backdrop_path) || trending.results[0];
        return withBackdrop ? { type: withBackdrop.type, id: withBackdrop.tmdb_id } : null;
      })();

  if (!source) return null;
  const detail = await tmdb.detail(source.type, source.id);
  return toHero({ ...detail, genres: detail.genres });
}

router.get(
  '/home',
  asyncHandler(async (req, res) => {
    const cached = homeCache.get('home');
    if (cached) return res.json(cached);

    try {
      let rows;
      try {
        rows = await many(
          `SELECT id, key, label, source, media_type, genre_id FROM home_rows WHERE enabled = TRUE ORDER BY sort_order ASC`
        );
      } catch (err) {
        console.warn(`[home] home_rows unavailable, using defaults: ${err.message}`);
        rows = DEFAULT_HOME_ROWS;
      }

      const hero = await pickHero().catch((err) => {
        console.warn(`[home] hero failed: ${err.message}`);
        return null;
      });

      const rowPayloads = await Promise.all(
        rows.map(async (row) => {
          try {
            return {
              key: row.key,
              label: row.label,
              media_type: row.media_type,
              items: toList(await fetchRowItems(row)),
            };
          } catch (err) {
            console.warn(`[home] row "${row.key}" failed: ${err.message}`);
            return { key: row.key, label: row.label, media_type: row.media_type, items: [] };
          }
        })
      );

      const payload = { hero, rows: rowPayloads.filter((r) => r.items.length > 0) };

      // Degraded build (TMDB partly down): keep serving the last healthy payload
      if (!payload.hero && payload.rows.length === 0) {
        if (homeLastGood) return res.json(homeLastGood);
        homeCache.set('home', payload, 30);
        return res.json(payload);
      }

      homeCache.set('home', payload);
      if (payload.hero) homeLastGood = payload;
      return res.json(payload);
    } catch (err) {
      if (homeLastGood) {
        console.warn(`[home] serving last good payload after error: ${err.message}`);
        return res.json(homeLastGood);
      }
      throw err;
    }
  })
);

router.get(
  '/browse',
  asyncHandler(async (req, res) => {
    const type = req.query.type === 'tv' ? 'tv' : req.query.type === 'movie' ? 'movie' : 'movie';
    const page = Math.max(1, Math.min(Number(req.query.page) || 1, 500));
    const sortKey = SORTS[req.query.sort] ? req.query.sort : 'popular';
    const sort = SORTS[sortKey][type];

    const opts = { page, sort };
    if (req.query.genre) opts.genre = String(req.query.genre);
    if (req.query.year && /^\d{4}$/.test(req.query.year)) opts.year = req.query.year;
    if (req.query.voteMin && !Number.isNaN(Number(req.query.voteMin))) opts.voteMin = req.query.voteMin;
    if (req.query.lang && /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(String(req.query.lang))) {
      opts.lang = String(req.query.lang).toLowerCase();
    }
    if (sortKey === 'rating' && !opts.voteMin) opts.voteMin = 150;

    const data = await tmdb.discover(type, opts);
    res.json({ ...data, results: toList(data.results) });
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ page: 1, total_pages: 0, total_results: 0, results: [] });
    const page = Math.max(1, Math.min(Number(req.query.page) || 1, 500));
    const type = ['movie', 'tv'].includes(req.query.type) ? req.query.type : 'multi';
    const data = await tmdb.search(q, page, type);
    return res.json({ ...data, results: toList(data.results) });
  })
);

router.get(
  '/genres',
  asyncHandler(async (req, res) => {
    const type = req.query.type === 'tv' ? 'tv' : req.query.type === 'movie' ? 'movie' : null;
    let rows;
    try {
      rows = type
        ? await many(`SELECT id, name FROM genres WHERE media_type = $1 ORDER BY name`, [type])
        : await many(`SELECT id, media_type, name FROM genres ORDER BY media_type, name`);
    } catch (err) {
      console.warn(`[genres] DB unavailable, using TMDB: ${err.message}`);
      const types = type ? [type] : ['movie', 'tv'];
      const lists = await Promise.all(types.map((t) => tmdb.genres(t)));
      rows = types.flatMap((t, i) => lists[i].map((g) => ({ id: g.id, media_type: t, name: g.name })));
      if (type) rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    res.json({ genres: rows });
  })
);

router.get(
  '/title/:type/:id',
  asyncHandler(async (req, res) => {
    validateType(req.params.type);
    const tmdbId = validateId(req.params.id);

    let dbRow = null;
    try {
      dbRow = await one(
        `SELECT status, featured, title, overview, poster_path, backdrop_path,
                to_char(release_date, 'YYYY-MM-DD') AS release_date, runtime,
                vote_average, trailer_key, original_title
         FROM titles WHERE media_type = $1 AND tmdb_id = $2`,
        [req.params.type, tmdbId]
      );
    } catch (err) {
      console.warn(`[title] DB overrides unavailable: ${err.message}`);
    }

    if (dbRow && (dbRow.status === 'hidden' || dbRow.status === 'draft')) {
      throw new TmdbError('Title not found', 404);
    }

    const detail = await tmdb.detail(req.params.type, tmdbId);

    const overrides = {};
    if (dbRow) {
      const map = {
        title: 'title', overview: 'overview', poster_path: 'poster_path',
        backdrop_path: 'backdrop_path', release_date: 'release_date', runtime: 'runtime',
        vote_average: 'vote_average', trailer_key: 'trailer_key', original_title: 'original_title',
      };
      for (const [key, col] of Object.entries(map)) {
        if (dbRow[col] !== null && dbRow[col] !== undefined) overrides[key] = dbRow[col];
      }
    }

    const merged = { ...detail, ...overrides, featured: dbRow?.featured || false, overridden: Object.keys(overrides).length > 0 };

    const item = toItem(merged);
    res.json({
      ...item,
      backdrop_url: imageUrl('w1280', merged.backdrop_path) || item.backdrop_url,
      tagline: merged.tagline || '',
      overview: merged.overview || '',
      original_language: merged.original_language || null,
      runtime: merged.runtime || null,
      status: merged.status || '',
      genres: merged.genres || [],
      trailer_key: merged.trailer_key || null,
      number_of_seasons: merged.number_of_seasons ?? null,
      number_of_episodes: merged.number_of_episodes ?? null,
      cast: merged.cast || [],
      crew: merged.crew || [],
      similar: toList(merged.similar || []),
      recommendations: toList(merged.recommendations || []),
      featured: merged.featured,
      overridden: merged.overridden,
    });
  })
);

router.get(
  '/title/:type/:id/season/:season',
  asyncHandler(async (req, res) => {
    validateType(req.params.type);
    if (req.params.type !== 'tv') throw new TmdbError('Seasons only apply to TV titles', 400);
    const tmdbId = validateId(req.params.id);
    const season = Number(req.params.season);
    if (!Number.isInteger(season) || season < 1 || season > 200) {
      throw new TmdbError('Invalid season number', 400);
    }

    const data = await tmdb.season(tmdbId, season);
    res.json({
      ...data,
      episodes: data.episodes.map((ep) => ({
        ...ep,
        still_url: imageUrl('w300', ep.still_path),
      })),
    });
  })
);

export default router;
