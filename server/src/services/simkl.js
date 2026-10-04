import NodeCache from 'node-cache';
import { env } from '../config/env.js';

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120, useClones: false });

export class TmdbError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
    this.code = status === 404 ? 'TMDB_NOT_FOUND' : status === 503 ? 'TMDB_NOT_CONFIGURED' : 'TMDB_ERROR';
  }
}

const EDGE_TTL = 60 * 60;
const LIST_TTL = 6 * 60 * 60;
const SEARCH_TTL = 60 * 60;
const DETAIL_TTL = 60 * 60;
const IDMAP_TTL = 7 * 24 * 3600;

const API = 'https://api.simkl.com';
const CDN = 'https://data.simkl.in';
const UA = 'MovieVault/1.0';

const MOVIE_GENRES = [
  { id: 28, name: 'Action', slug: 'action' },
  { id: 12, name: 'Adventure', slug: 'adventure' },
  { id: 16, name: 'Animation', slug: 'animation' },
  { id: 35, name: 'Comedy', slug: 'comedy' },
  { id: 80, name: 'Crime', slug: 'crime' },
  { id: 99, name: 'Documentary', slug: 'documentary' },
  { id: 18, name: 'Drama', slug: 'drama' },
  { id: 10751, name: 'Family', slug: 'family' },
  { id: 14, name: 'Fantasy', slug: 'fantasy' },
  { id: 36, name: 'History', slug: 'history' },
  { id: 27, name: 'Horror', slug: 'horror' },
  { id: 10402, name: 'Music', slug: 'music' },
  { id: 9648, name: 'Mystery', slug: 'mystery' },
  { id: 10749, name: 'Romance', slug: 'romance' },
  { id: 878, name: 'Science Fiction', slug: 'science-fiction' },
  { id: 10770, name: 'TV Movie', slug: 'tv-movie' },
  { id: 53, name: 'Thriller', slug: 'thriller' },
  { id: 10752, name: 'War', slug: 'war' },
  { id: 37, name: 'Western', slug: 'western' },
];

const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure', slug: 'action' },
  { id: 16, name: 'Animation', slug: 'animation' },
  { id: 35, name: 'Comedy', slug: 'comedy' },
  { id: 80, name: 'Crime', slug: 'crime' },
  { id: 99, name: 'Documentary', slug: 'documentary' },
  { id: 18, name: 'Drama', slug: 'drama' },
  { id: 10751, name: 'Family', slug: 'family' },
  { id: 10762, name: 'Kids', slug: 'children' },
  { id: 9648, name: 'Mystery', slug: 'mystery' },
  { id: 10763, name: 'News', slug: 'news' },
  { id: 10764, name: 'Reality', slug: 'reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy', slug: 'science-fiction' },
  { id: 10766, name: 'Soap', slug: 'soap' },
  { id: 10767, name: 'Talk Show', slug: 'talk-show' },
  { id: 10768, name: 'War & Politics', slug: 'war' },
];

const MOVIE_SLUG = new Map(MOVIE_GENRES.map((g) => [g.id, g.slug]));
const TV_SLUG = new Map(TV_GENRES.map((g) => [g.id, g.slug]));
const MOVIE_NAME_ID = new Map(MOVIE_GENRES.map((g) => [g.name.toLowerCase(), g.id]));
const TV_NAME_ID = new Map(TV_GENRES.map((g) => [g.name.toLowerCase(), g.id]));
for (const [name, id] of [
  ['action', 10759], ['adventure', 10759], ['fantasy', 10765],
  ['science fiction', 10765], ['thriller', null], ['kids', 10762],
  ['children', 10762], ['reality', 10764], ['soap', 10766],
  ['talk show', 10767], ['talk-show', 10767], ['war', 10768],
  ['war & politics', 10768], ['korean drama', null],
]) {
  if (id != null) TV_NAME_ID.set(name, id);
}

const LANG_COUNTRY = {
  hi: 'in', ta: 'in', te: 'in', ml: 'in', kn: 'in', bn: 'in', mr: 'in',
  pa: 'in', ur: 'pk', ko: 'kr', ja: 'jp', zh: 'cn', en: 'us', es: 'es',
  fr: 'fr', de: 'de', it: 'it', pt: 'pt', ru: 'ru', ar: 'sa', tr: 'tr',
  th: 'th', vi: 'vn', id: 'id', ms: 'my', nl: 'nl', pl: 'pl', sv: 'sv',
};

const SORT_MAP = {
  'popularity.desc': 'popular-this-week',
  'popularity.asc': 'popular-this-week',
  'vote_average.desc': 'rank',
  'vote_average.asc': 'rank',
  'primary_release_date.desc': 'release-date',
  'first_air_date.desc': 'release-date',
  'primary_release_date.asc': 'release-date',
  'first_air_date.asc': 'release-date',
  'title.asc': 'popular-all-time',
  'name.asc': 'popular-all-time',
};

function baseParams() {
  return `client_id=${encodeURIComponent(env.simklClientId || '')}&app-name=MovieVault&app-version=1.0`;
}

let tokenValue = env.simklAccessToken || '';
let tokenFetchedAt = Date.now();

async function ensureToken() {
  if (tokenValue && Date.now() - tokenFetchedAt < 6 * 24 * 3600 * 1000) return tokenValue;
  if (!env.simklRefreshToken) return tokenValue;
  let res = null;
  try {
    res = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.simklClientId,
        client_secret: env.simklClientSecret,
        refresh_token: env.simklRefreshToken,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return tokenValue;
  }
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.access_token) {
      tokenValue = data.access_token;
      tokenFetchedAt = Date.now();
    }
  } else {
    tokenFetchedAt = Date.now();
  }
  return tokenValue;
}

let originChain = Promise.resolve();
function originTask(fn) {
  const run = originChain.then(fn, fn);
  originChain = run.then(() => undefined, () => undefined);
  return run;
}

async function apiGet(path, { ttl = EDGE_TTL, params = '', manualRedirect = false, counted = false, withMeta = false } = {}) {
  const exec = async () => {
    const cacheKey = `simkl:${manualRedirect ? 'r:' : ''}${path}:${params}`;
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return hit;

    const sep = path.includes('?') ? '&' : '?';
    const url = `${API}${path}${sep}${baseParams()}${params ? `&${params}` : ''}`;

    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
      const headers = { 'User-Agent': UA };
      if (!manualRedirect) {
        const t = await ensureToken();
        if (t) headers.Authorization = `Bearer ${t}`;
      }
      let res = null;
      try {
        res = await fetch(url, { headers, redirect: manualRedirect ? 'manual' : 'follow', signal: AbortSignal.timeout(12_000) });
      } catch (err) {
        lastErr = err;
        continue;
      }

      if (res.status === 401) {
        tokenFetchedAt = 0;
        lastErr = null;
        continue;
      }
      if (res.status === 429) {
        const body = await res.text().catch(() => '');
        if (body.includes('user_limit_exceeded')) {
          throw new TmdbError('Simkl daily quota reached — resets at midnight US Eastern', 503);
        }
        await new Promise((r) => setTimeout(r, 1300));
        lastErr = null;
        continue;
      }
      if (res.status === 404) throw new TmdbError('Title not found on Simkl', 404);
      if (manualRedirect && res.status >= 300 && res.status < 400) {
        const out = { location: res.headers.get('location') || '' };
        cache.set(cacheKey, out, ttl);
        return out;
      }
      if (!res.ok) {
        lastErr = new Error(`Simkl responded ${res.status}`);
        continue;
      }

      let out;
      if (manualRedirect) {
        out = { location: res.headers.get('location') || '' };
      } else {
        const data = await res.json();
        out = withMeta
          ? {
              data,
              pageCount: Number(res.headers.get('x-pagination-page-count')) || null,
              itemCount: Number(res.headers.get('x-pagination-item-count')) || null,
            }
          : data;
      }
      if (ttl > 0) cache.set(cacheKey, out, ttl);
      return out;
    }
    const cause = lastErr?.cause?.code || lastErr?.cause?.message || '';
    const msg = lastErr
      ? `Simkl request failed: ${lastErr.message}${cause ? ` (${cause})` : ''}`
      : 'Simkl request failed';
    throw new TmdbError(msg, 502);
  };

  return counted ? originTask(exec) : exec();
}

async function cdnGet(file) {
  const key = `simkl:cdn:${file}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const url = `${CDN}/${file}?${baseParams()}`;
  let res = null;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12_000) });
  } catch (err) {
    const cause = err?.cause?.code || '';
    throw new TmdbError(`Simkl CDN request failed: ${err.message}${cause ? ` (${cause})` : ''}`, 502);
  }
  if (res.status === 404) throw new TmdbError('Simkl data file not found', 404);
  if (!res.ok) throw new TmdbError(`Simkl CDN responded ${res.status}`, 502);
  const data = await res.json();
  cache.set(key, data, EDGE_TTL);
  return data;
}

function toIsoDate(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  return null;
}

function readRatings(item) {
  const r = item?.ratings || {};
  const rating = r.simkl?.rating ?? r.imdb?.rating ?? 0;
  const votes = r.simkl?.votes ?? r.imdb?.votes ?? 0;
  return { rating: Math.round(rating * 10) / 10, votes: votes || 0 };
}

function genreIdsOf(item, type) {
  const names = Array.isArray(item.genres) ? item.genres : [];
  const map = type === 'tv' ? TV_NAME_ID : MOVIE_NAME_ID;
  const ids = [];
  for (const n of names) {
    const id = map.get(String(n).toLowerCase());
    if (id != null) ids.push(id);
  }
  return ids;
}

function normalize(item, forcedType) {
  const raw = item.type || forcedType;
  const type = raw === 'show' || raw === 'tv' ? 'tv' : raw === 'movie' || raw === 'movies' ? 'movie' : forcedType;
  if (type !== 'movie' && type !== 'tv') return null;
  const tmdbNum = Number(item.ids?.tmdb);
  const { rating, votes } = readRatings(item);
  const release = toIsoDate(item.date || item.release_date || item.first_aired || item.released) ||
    (item.year ? `${item.year}-01-01` : null);
  return {
    type,
    tmdb_id: Number.isFinite(tmdbNum) && tmdbNum > 0 ? tmdbNum : null,
    title: item.title || 'Untitled',
    original_title: null,
    overview: item.overview || '',
    poster_path: item.poster || null,
    backdrop_path: item.fanart || null,
    release_date: release,
    year: release ? release.slice(0, 4) : item.year ? String(item.year) : null,
    vote_average: rating,
    vote_count: votes,
    popularity: Number(item.watched) || votes,
    genre_ids: genreIdsOf(item, type),
  };
}

function listOf(results) {
  return { page: 1, total_pages: 1, total_results: results.length, results };
}

function normalizeList(items, forcedType, page = 1, totalPages = 1) {
  const results = (items || []).map((i) => normalize(i, forcedType)).filter((x) => x && x.tmdb_id);
  return {
    page,
    total_pages: Math.max(1, Math.min(totalPages || 1, 20)),
    total_results: results.length * Math.max(1, totalPages || 1),
    results,
  };
}

async function resolveSimkl(type, tmdbId) {
  const key = `simkl:map:${type}:${tmdbId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = await apiGet('/redirect', {
    params: `to=simkl&type=${type}&tmdb=${tmdbId}`,
    manualRedirect: true,
    ttl: 0,
  });
  const m = (out.location || '').match(/\/(movies|tv)\/(\d+)/);
  if (!m) throw new TmdbError('Title not found on Simkl', 404);
  const mapped = { kind: m[1], id: Number(m[2]) };
  cache.set(key, mapped, IDMAP_TTL);
  return mapped;
}

async function resolveMissingTmdb(items, kind) {
  const missing = (items || []).filter((i) => !i.ids?.tmdb && i.ids?.simkl_id != null);
  if (!missing.length) return items || [];
  const CONCURRENCY = 8;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    await Promise.all(
      missing.slice(i, i + CONCURRENCY).map(async (item) => {
        try {
          const d = await apiGet(`/${kind}/${item.ids.simkl_id}`, { ttl: IDMAP_TTL });
          if (d?.ids?.tmdb) item.ids.tmdb = d.ids.tmdb;
        } catch {
          // leave unresolved; caller filters it out
        }
      })
    );
  }
  return items;
}

function pickMovieRelease(data) {
  const us = (data.release_dates || []).find((r) => r.iso_3166_1 === 'US');
  const dates = (us?.results || [])
    .map((r) => r.release_date)
    .filter(Boolean)
    .sort();
  if (dates.length) return toIsoDate(dates[0]);
  if (data.released) return toIsoDate(data.released);
  return data.year ? `${data.year}-01-01` : null;
}

function statusLabel(status, release, type) {
  const map = {
    ended: 'Ended',
    current: 'Returning Series',
    returning: 'Returning Series',
    running: 'Returning Series',
    upcoming: 'Upcoming',
    tba: 'In Development',
    pilot: 'Pilot',
  };
  if (status && map[String(status).toLowerCase()]) return map[String(status).toLowerCase()];
  if (type === 'movie' && release) return release > new Date().toISOString().slice(0, 10) ? 'Upcoming' : 'Released';
  return status ? String(status) : '';
}

async function trendingFile(kind) {
  return cdnGet(`discover/trending/${kind}/today_100.json`);
}

async function weekFile(kind) {
  return cdnGet(`discover/trending/${kind}/week_500.json`);
}

async function monthFile(kind) {
  return cdnGet(`discover/trending/${kind}/month_500.json`);
}

async function calendarItems(file, filterFn, pathKind, type, limit = 40) {
  const data = await cdnGet(file);
  const cal = Array.isArray(data?.calendar) ? data.calendar : [];
  const now = Date.now();
  const picked = cal
    .filter((e) => {
      const t = new Date(e.date).getTime();
      return Number.isFinite(t) && filterFn(t, now) && e.simkl_id;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, limit);

  const out = [];
  const CONCURRENCY = 12;
  for (let i = 0; i < picked.length; i += CONCURRENCY) {
    const chunk = await Promise.all(
      picked.slice(i, i + CONCURRENCY).map(async (e) => {
        try {
          const d = await apiGet(`/${pathKind}/${e.simkl_id}`, { ttl: DETAIL_TTL });
          const n = normalize(d, type);
          if (!n || !n.tmdb_id) return null;
          n.release_date = toIsoDate(e.date) || n.release_date;
          n.year = n.release_date ? n.release_date.slice(0, 4) : n.year;
          return n;
        } catch {
          return null;
        }
      })
    );
    out.push(...chunk.filter(Boolean));
  }
  return out;
}

async function searchOne(query, page, kind) {
  return apiGet(`/search/${kind === 'tv' ? 'tv' : 'movie'}`, {
    params: `q=${encodeURIComponent(query)}&page=${page}&limit=50`,
    ttl: SEARCH_TTL,
    counted: true,
    withMeta: true,
  });
}

const HINDI_MOVIE_IDS = [
  77388, 524600, 426634, 857814, 509900, 1728632, 83610, 1513316, 137736, 76518,
  2229295, 300514, 76468, 855352, 60958, 221984, 278016, 1715002, 933980, 66376,
  64604, 71758, 57926, 2003243, 60828, 2141401, 550206, 1051642, 393120, 752656,
  167228, 173002, 1024548, 744992, 541132, 647202, 684450, 1080730, 286190, 344630,
  1088042, 1231956, 529168, 526826, 57920, 195234, 906940, 71956, 399296, 744986,
  195936, 2272827, 483940, 661156, 493904, 111104, 392172, 578206, 1085170, 361186,
  1520148, 755834, 2271663, 546308, 79764, 2032159, 1118356, 1118514, 753008, 1051166,
  1069162, 1920631, 752666, 2267743, 2054605, 1237628, 994732, 613628, 2203273, 222784,
  2110387, 848366, 1753304, 2315383,
];

async function hindiRow() {
  const key = 'simkl:hindi:row';
  const hit = cache.get(key);
  if (hit) return hit;
  const out = [];
  for (let i = 0; i < HINDI_MOVIE_IDS.length; i += 8) {
    const chunk = await Promise.all(
      HINDI_MOVIE_IDS.slice(i, i + 8).map(async (id) => {
        try {
          const d = await apiGet(`/movies/${id}`, { ttl: IDMAP_TTL });
          return d?.ids?.tmdb ? normalize(d, 'movie') : null;
        } catch {
          return null;
        }
      })
    );
    out.push(...chunk.filter(Boolean));
  }
  const res = listOf(out.slice(0, 60));
  cache.set(key, res, LIST_TTL);
  return res;
}

function mergeByDateDesc(a, b) {
  const data = [...(a.data || []), ...(b.data || [])];
  const seen = new Set();
  const merged = [];
  for (const item of data) {
    const k = item.ids?.simkl_id || `${item.title}:${item.year}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(item);
  }
  merged.sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
  return {
    data: merged.slice(0, 60),
    pageCount: Math.max(a.pageCount || 1, b.pageCount || 1),
    itemCount: merged.length,
  };
}

async function releaseDateList(type, slug, country, page) {
  const cy = new Date().getFullYear();
  const params = `page=${page}&limit=60`;
  const path = (y) =>
    type === 'movie'
      ? `/movies/genres/${slug}/movies/${country}/${y}/release-date`
      : `/tv/genres/${slug}/all/${country}/all/${y}/release-date`;
  const [a, b] = await Promise.all([
    apiGet(path(cy), { params, ttl: LIST_TTL, counted: true, withMeta: true }),
    apiGet(path(cy - 1), { params, ttl: LIST_TTL, counted: true, withMeta: true }),
  ]);
  return mergeByDateDesc(a, b);
}

export const metadata = {
  async trending(type = 'all') {
    if (type === 'movie') {
      const items = (await trendingFile('movies')).slice(0, 30);
      return listOf(items.map((i) => normalize(i, 'movie')).filter((x) => x && x.tmdb_id));
    }
    if (type === 'tv') {
      const items = (await trendingFile('tv')).slice(0, 30);
      return listOf(items.map((i) => normalize(i, 'tv')).filter((x) => x && x.tmdb_id));
    }
    const [movies, tv] = await Promise.all([trendingFile('movies'), trendingFile('tv')]);
    const merged = [];
    for (let i = 0; i < Math.max(movies.length, tv.length); i++) {
      if (movies[i]) merged.push(normalize(movies[i], 'movie'));
      if (tv[i]) merged.push(normalize(tv[i], 'tv'));
    }
    return listOf(merged.filter((x) => x && x.tmdb_id).slice(0, 30));
  },

  async popular(type = 'movie') {
    const kind = type === 'tv' ? 'tv' : 'movies';
    const items = (await weekFile(kind)).slice(0, 40);
    return listOf(items.map((i) => normalize(i, type)).filter((x) => x && x.tmdb_id));
  },

  async topRated(type = 'movie') {
    const kind = type === 'tv' ? 'tv' : 'movies';
    const items = await monthFile(kind);
    const rated = items
      .map((i) => ({ i, r: readRatings(i) }))
      .filter((x) => x.r.votes >= 150);
    const pool = rated.length >= 20 ? rated : items.map((i) => ({ i, r: readRatings(i) }));
    pool.sort((a, b) => b.r.rating - a.r.rating);
    const results = pool.slice(0, 40).map((x) => normalize(x.i, type)).filter((x) => x && x.tmdb_id);
    return listOf(results);
  },

  async upcoming() {
    const results = await calendarItems(
      'calendar/v2/movie_release.json',
      (t, now) => t >= now,
      'movies',
      'movie',
      40
    );
    return listOf(results);
  },

  async onTheAir() {
    const results = await calendarItems(
      'calendar/v2/tv.json',
      (t, now) => t >= now - 2 * 86400_000 && t <= now + 7 * 86400_000,
      'tv',
      'tv',
      40
    );
    return listOf(results);
  },

  async search(query, page = 1, type = 'multi') {
    if (type === 'movie' || type === 'tv') {
      const res = await searchOne(query, page, type);
      return normalizeList(res.data, type, page, res.pageCount || 1);
    }
    const m = await searchOne(query, page, 'movie');
    const t = await searchOne(query, page, 'tv');
    const merged = [];
    const mi = m.data || [];
    const ti = t.data || [];
    for (let i = 0; i < Math.max(mi.length, ti.length); i++) {
      if (mi[i]) merged.push({ item: mi[i], type: 'movie' });
      if (ti[i]) merged.push({ item: ti[i], type: 'tv' });
    }
    const results = merged
      .map((x) => normalize(x.item, x.type))
      .filter((x) => x && x.tmdb_id)
      .slice(0, 50);
    return {
      page,
      total_pages: Math.max(1, Math.min(Math.max(m.pageCount || 1, t.pageCount || 1), 20)),
      total_results: results.length,
      results,
    };
  },

  async discover(type, { genre, year, sort, page = 1, lang } = {}) {
    if (type === 'movie' && String(lang || '').toLowerCase() === 'hi' && !genre && !year) {
      return hindiRow();
    }
    const slugMap = type === 'tv' ? TV_SLUG : MOVIE_SLUG;
    let slug = 'all';
    if (genre !== undefined && genre !== null && genre !== '') {
      const asNum = Number(genre);
      if (Number.isInteger(asNum) && slugMap.has(asNum)) slug = slugMap.get(asNum);
      else if (typeof genre === 'string' && /^[a-z][a-z-]*$/.test(genre)) slug = genre;
    }
    const country = LANG_COUNTRY[String(lang || '').toLowerCase()] || 'all';
    const y = year ? String(year) : 'all';
    const s = SORT_MAP[sort] || 'popular-this-week';

    let res;
    if (s === 'release-date' && y === 'all') {
      res = await releaseDateList(type, slug, country, page);
    } else if (type === 'movie') {
      res = await apiGet(`/movies/genres/${slug}/movies/${country}/${y}/${s}`, {
        params: `page=${page}&limit=60`,
        ttl: LIST_TTL,
        counted: true,
        withMeta: true,
      });
    } else {
      res = await apiGet(`/tv/genres/${slug}/all/${country}/all/${y}/${s}`, {
        params: `page=${page}&limit=60`,
        ttl: LIST_TTL,
        counted: true,
        withMeta: true,
      });
    }

    let items = Array.isArray(res.data) ? res.data : [];
    if (type === 'tv' && items.length) items = await resolveMissingTmdb(items, 'tv');
    const results = items.map((i) => normalize(i, type)).filter((x) => x && x.tmdb_id);
    const totalPages = Math.max(1, Math.min(res.pageCount || 1, 20));
    return {
      page,
      total_pages: totalPages,
      total_results: (res.itemCount || results.length) * totalPages,
      results,
    };
  },

  async detail(type, id) {
    const { kind, id: simklId } = await resolveSimkl(type, id);
    const data = await apiGet(`/${kind}/${simklId}`, { ttl: DETAIL_TTL });
    const base = normalize(data, type);
    if (type === 'movie') {
      const release = pickMovieRelease(data) || base.release_date;
      base.release_date = release;
      base.year = release ? release.slice(0, 4) : base.year;
    }

    const trailers = Array.isArray(data.trailers) ? data.trailers : [];
    const pick =
      trailers.find((t) => /^official trailer$/i.test(t.name || '')) ||
      trailers.find((t) => /trailer/i.test(t.name || '')) ||
      trailers[0];

    let number_of_seasons = null;
    let number_of_episodes = data.total_episodes ?? null;
    if (type === 'tv') {
      try {
        const eps = await apiGet(`/tv/episodes/${simklId}`, { ttl: EDGE_TTL });
        if (Array.isArray(eps)) {
          const seasons = new Set(eps.map((e) => e.season).filter((s) => Number.isInteger(s)));
          number_of_seasons = seasons.size || null;
          if (number_of_episodes == null) number_of_episodes = eps.length;
        }
      } catch {
        // episode counts are optional
      }
    }

    const nameMap = type === 'tv' ? TV_NAME_ID : MOVIE_NAME_ID;
    const release = base.release_date;
    return {
      ...base,
      tagline: '',
      overview: data.overview || '',
      original_language: data.language ? String(data.language).toLowerCase() : null,
      runtime: data.runtime ?? null,
      genres: (Array.isArray(data.genres) ? data.genres : []).map((n) => ({
        id: nameMap.get(String(n).toLowerCase()) ?? null,
        name: n,
      })),
      status: statusLabel(data.status, release, type),
      number_of_seasons,
      number_of_episodes,
      trailer_key: pick?.youtube || null,
      cast: [],
      crew: data.director ? [{ name: data.director, job: 'Director' }] : [],
      similar: (Array.isArray(data.similar) ? data.similar : [])
        .map((i) => normalize(i, type))
        .filter((x) => x && x.tmdb_id)
        .slice(0, 12),
      recommendations: (Array.isArray(data.users_recommendations) ? data.users_recommendations : [])
        .map((i) => normalize(i, type))
        .filter((x) => x && x.tmdb_id)
        .slice(0, 12),
    };
  },

  async season(tvId, season) {
    const { id: simklId } = await resolveSimkl('tv', tvId);
    const eps = await apiGet(`/tv/episodes/${simklId}`, { ttl: EDGE_TTL });
    const list = (Array.isArray(eps) ? eps : []).filter((e) => Number(e.season) === Number(season));
    return {
      season: Number(season),
      name: `Season ${season}`,
      overview: '',
      episodes: list.map((ep, idx) => ({
        episode: ep.episode ?? idx + 1,
        title: ep.title || `Episode ${ep.episode ?? idx + 1}`,
        overview: ep.description || '',
        still_path: ep.img || null,
        runtime: ep.runtime ?? null,
        air_date: toIsoDate(ep.date),
        vote_average: 0,
      })),
    };
  },

  genres(type = 'movie') {
    const list = type === 'tv' ? TV_GENRES : MOVIE_GENRES;
    return Promise.resolve(list.map((g) => ({ id: g.id, name: g.name })));
  },

  async sitemapEntries() {
    const key = 'simkl:sitemap:entries';
    const hit = cache.get(key);
    if (hit) return hit;
    const [mv, tv, hindi] = await Promise.all([
      weekFile('movies'),
      weekFile('tv'),
      hindiRow(),
    ]);
    const seen = new Set();
    const out = [];
    const push = (item, type) => {
      const n = normalize(item, type);
      if (!n || !n.tmdb_id) return;
      const k = `${type}:${n.tmdb_id}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ type, tmdb_id: n.tmdb_id, release_date: n.release_date });
    };
    for (const i of mv) push(i, 'movie');
    for (const i of tv) push(i, 'tv');
    for (const i of hindi.results || []) {
      const k = `movie:${i.tmdb_id}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ type: 'movie', tmdb_id: i.tmdb_id, release_date: i.release_date });
      }
    }
    const res = out.slice(0, 1200);
    cache.set(key, res, LIST_TTL);
    return res;
  },
};

export function imageUrl(size, path) {
  if (!path) return null;
  if (path.includes('.jpg')) {
    return `/api/image/${size}${path.startsWith('/') ? path : `/${path}`}`;
  }
  const frag = path.replace(/^\//, '');
  if (size === 'w780' || size === 'w1280') {
    const suffix = size === 'w1280' ? '_medium' : '_mobile';
    return `https://simkl.in/fanart/${frag}${suffix}.webp`;
  }
  if (size === 'w300') return `https://simkl.in/episodes/${frag}_m.webp`;
  if (size === 'original') return `https://simkl.net/posters/${frag}_0.jpg`;
  const posterSizes = { w92: '_cm', w154: '_c', w185: '_c', w342: '_m', w500: '_m', w784: '_m', h632: '_m' };
  return `https://simkl.in/posters/${frag}${posterSizes[size] || '_m'}.webp`;
}

export function tmdbConfigured() {
  return Boolean(env.simklClientId && (env.simklAccessToken || env.simklRefreshToken));
}

export function clearTmdbCache() {
  cache.flushAll();
}
