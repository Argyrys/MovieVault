import { imageUrl } from './metadata.js';

const dateStr = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d || null);

export function toItem(t) {
  if (!t) return null;
  const release = dateStr(t.release_date);
  return {
    type: t.type,
    tmdb_id: t.tmdb_id,
    title: t.title,
    overview: t.overview || '',
    poster_path: t.poster_path || null,
    backdrop_path: t.backdrop_path || null,
    poster_url: imageUrl('w342', t.poster_path),
    backdrop_url: imageUrl('w780', t.backdrop_path),
    release_date: release,
    year: release ? release.slice(0, 4) : null,
    vote_average: Number(t.vote_average) || 0,
    vote_count: t.vote_count || 0,
    genre_ids: t.genre_ids || [],
    popularity: Number(t.popularity) || 0,
  };
}

export function toList(items) {
  return (items || []).map(toItem).filter(Boolean);
}

export function toHero(t) {
  const item = toItem(t);
  if (!item) return null;
  return {
    ...item,
    backdrop_url: imageUrl('w1280', t.backdrop_path) || item.backdrop_url,
    tagline: t.tagline || '',
    trailer_key: t.trailer_key || null,
    runtime: t.runtime || null,
    genres: t.genres || [],
    number_of_seasons: t.number_of_seasons ?? null,
    number_of_episodes: t.number_of_episodes ?? null,
    cast: (t.cast || []).slice(0, 6),
  };
}

export function dbRowToNormalized(row) {
  return {
    type: row.media_type,
    tmdb_id: row.tmdb_id,
    title: row.title,
    overview: row.overview || '',
    poster_path: row.poster_path,
    backdrop_path: row.backdrop_path,
    release_date: row.release_date,
    vote_average: Number(row.vote_average) || 0,
    vote_count: row.vote_count || 0,
    popularity: Number(row.popularity) || 0,
    genre_ids: [],
  };
}
