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

const LIST_TTL = 5 * 60;
const DETAIL_TTL = 60 * 60;

export function imageUrl(size, path) {
  if (!path) return null;
  return `/api/image/${size}${path.startsWith('/') ? path : `/${path}`}`;
}

async function tmdbFetch(path, params = {}, ttl = LIST_TTL) {
  if (!env.tmdbApiKey) {
    throw new TmdbError('TMDB_API_KEY is not configured. Add it to server/.env and restart.', 503);
  }

  const cacheKey = `tmdb:${path}:${JSON.stringify(params)}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  const url = new URL(env.tmdbBaseUrl + path);
  url.searchParams.set('api_key', env.tmdbApiKey);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  let res = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * attempt));
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    } catch (err) {
      lastErr = err;
      res = null;
      continue;
    }
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1200));
      res = null;
      lastErr = null;
      continue;
    }
    break;
  }

  if (!res) {
    const cause = lastErr?.cause?.code || lastErr?.cause?.message || '';
    const msg = lastErr
      ? `TMDB request failed: ${lastErr.message}${cause ? ` (${cause})` : ''}`
      : 'TMDB rate limited — try again shortly';
    throw new TmdbError(msg, 502);
  }

  if (res.status === 404) throw new TmdbError('Title not found on TMDB', 404);
  if (!res.ok) throw new TmdbError(`TMDB responded ${res.status}`, 502);

  const data = await res.json();
  cache.set(cacheKey, data, ttl);
  return data;
}

export function normalize(item, forcedType) {
  const type = forcedType || item.media_type || (item.first_air_date ? 'tv' : 'movie');
  if (type !== 'movie' && type !== 'tv') return null;
  const title = item.title || item.name || 'Untitled';
  const releaseDate = item.release_date || item.first_air_date || null;
  return {
    type,
    tmdb_id: item.id,
    title,
    original_title: item.original_title || item.original_name || null,
    overview: item.overview || '',
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    release_date: releaseDate,
    year: releaseDate ? releaseDate.slice(0, 4) : null,
    vote_average: Math.round((item.vote_average || 0) * 10) / 10,
    vote_count: item.vote_count || 0,
    popularity: item.popularity || 0,
    genre_ids: item.genre_ids || (item.genres || []).map((g) => g.id),
  };
}

function normalizeList(data, forcedType) {
  const results = (data.results || []).map((i) => normalize(i, forcedType)).filter(Boolean);
  return {
    page: data.page || 1,
    total_pages: Math.min(data.total_pages || 1, 500),
    total_results: data.total_results || results.length,
    results,
  };
}

export const tmdb = {
  trending(type = 'all', page = 1) {
    return tmdbFetch(`/trending/${type}/week`, { page }, LIST_TTL).then((d) => normalizeList(d));
  },
  popular(type = 'movie', page = 1) {
    return tmdbFetch(`/${type}/popular`, { page }, LIST_TTL).then((d) => normalizeList(d, type));
  },
  topRated(type = 'movie', page = 1) {
    return tmdbFetch(`/${type}/top_rated`, { page }, LIST_TTL).then((d) => normalizeList(d, type));
  },
  upcoming(page = 1) {
    return tmdbFetch('/movie/upcoming', { page }, LIST_TTL).then((d) => normalizeList(d, 'movie'));
  },
  onTheAir(page = 1) {
    return tmdbFetch('/tv/on_the_air', { page }, LIST_TTL).then((d) => normalizeList(d, 'tv'));
  },
  search(query, page = 1, type = 'multi') {
    return tmdbFetch(`/search/${type}`, { query, page, include_adult: false }, LIST_TTL).then((d) =>
      normalizeList(d)
    );
  },
  discover(type, { genre, year, sort, page = 1, voteMin } = {}) {
    const params = { page, sort_by: sort || 'popularity.desc' };
    if (genre) params.with_genres = genre;
    if (year) params[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = year;
    if (voteMin) params['vote_count.gte'] = voteMin;
    return tmdbFetch(`/discover/${type}`, params, LIST_TTL).then((d) => normalizeList(d, type));
  },
  async detail(type, id) {
    const data = await tmdbFetch(`/${type}/${id}`, { append_to_response: 'credits,videos,similar,recommendations' }, DETAIL_TTL);
    const base = normalize(data, type);
    const videos = (data.videos?.results || []).find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
    ) || (data.videos?.results || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer');
    return {
      ...base,
      tagline: data.tagline || '',
      overview: data.overview || '',
      runtime: type === 'movie' ? data.runtime || null : data.episode_run_time?.[0] || null,
      genres: (data.genres || []).map((g) => ({ id: g.id, name: g.name })),
      status: data.status || '',
      number_of_seasons: data.number_of_seasons ?? null,
      number_of_episodes: data.number_of_episodes ?? null,
      trailer_key: videos?.key || null,
      cast: (data.credits?.cast || []).slice(0, 12).map((c) => ({
        name: c.name,
        character: c.character || '',
        profile_path: c.profile_path || null,
        profile_url: imageUrl('w185', c.profile_path),
      })),
      crew: (data.credits?.crew || [])
        .filter((c) => c.job === 'Director' || c.job === 'Creator' || c.job === 'Writer')
        .slice(0, 6)
        .map((c) => ({ name: c.name, job: c.job })),
      similar: normalizeList({ results: data.similar?.results || [], page: 1, total_pages: 1 }).results.slice(0, 12),
      recommendations: normalizeList({ results: data.recommendations?.results || [], page: 1, total_pages: 1 }).results.slice(0, 12),
    };
  },
  async season(tvId, season) {
    const data = await tmdbFetch(`/tv/${tvId}/season/${season}`, {}, DETAIL_TTL);
    return {
      season: data.season_number,
      name: data.name || `Season ${season}`,
      overview: data.overview || '',
      episodes: (data.episodes || []).map((ep) => ({
        episode: ep.episode_number,
        title: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || '',
        still_path: ep.still_path || null,
        runtime: ep.runtime || null,
        air_date: ep.air_date || null,
        vote_average: Math.round((ep.vote_average || 0) * 10) / 10,
      })),
    };
  },
  genres(type = 'movie') {
    return tmdbFetch(`/genre/${type}/list`, {}, 24 * 3600).then((d) => d.genres || []);
  },
};

export function tmdbConfigured() {
  return Boolean(env.tmdbApiKey);
}

export function clearTmdbCache() {
  cache.flushAll();
}
