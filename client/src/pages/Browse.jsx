import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TitleCard from '../components/TitleCard.jsx';
import { SkeletonGrid } from '../components/Skeleton.jsx';
import './Browse.css';

const SORTS = [
  { v: 'popularity.desc', l: 'Most Popular' },
  { v: 'vote_average.desc', l: 'Top Rated' },
  { v: 'primary_release_date.desc', l: 'Newest' },
  { v: 'primary_release_date.asc', l: 'Oldest' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i);

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [genres, setGenres] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const type = params.get('type') || '';
  const genre = params.get('genre') || '';
  const year = params.get('year') || '';
  const lang = params.get('lang') || '';
  const sort = params.get('sort') || 'popularity.desc';
  const page = Number(params.get('page')) || 1;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .browse({ type, genre, year, lang, sort, page })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [type, genre, year, lang, sort, page]);

  useEffect(() => {
    let alive = true;
    api
      .genres(type || undefined)
      .then((d) => alive && setGenres(d.genres))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [type]);

  const totalPages = Math.min(data?.total_pages || 1, 500);

  const goPage = (n) => {
    const next = new URLSearchParams(params);
    next.set('page', String(n));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="browse">
      <div className="browse-head">
        <h1>Browse</h1>
        <p>
          {data ? `${data.total_results.toLocaleString()} titles` : 'Loading catalog…'}
        </p>
      </div>

      <div className="browse-layout">
        <aside className="filters">
          <div className="filter-group">
            <label>Type</label>
            <div className="seg">
              {[
                { v: '', l: 'All' },
                { v: 'movie', l: 'Movies' },
                { v: 'tv', l: 'TV' },
              ].map((o) => (
                <button
                  key={o.v}
                  className={type === o.v ? 'active' : ''}
                  onClick={() => setParam('type', o.v)}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label htmlFor="f-genre">Genre</label>
            <select id="f-genre" value={genre} onChange={(e) => setParam('genre', e.target.value)}>
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="f-year">Year</label>
            <select id="f-year" value={year} onChange={(e) => setParam('year', e.target.value)}>
              <option value="">Any year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="f-lang">Language</label>
            <select id="f-lang" value={lang} onChange={(e) => setParam('lang', e.target.value)}>
              <option value="">Any language</option>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="ko">Korean</option>
              <option value="ja">Japanese</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="f-sort">Sort by</label>
            <select id="f-sort" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <div className="browse-main">
          {error && <div className="page-state">Failed to load: {error}</div>}
          {loading && <SkeletonGrid count={15} />}
          {!loading && !error && data?.results?.length === 0 && (
            <div className="page-state">No titles match these filters.</div>
          )}
          {!loading && data?.results?.length > 0 && (
            <div className="browse-grid">
              {data.results.map((item) => (
                <TitleCard key={`${item.type}-${item.tmdb_id}`} item={item} />
              ))}
            </div>
          )}

          {!loading && data && totalPages > 1 && (
            <div className="pager">
              <button disabled={page <= 1} onClick={() => goPage(page - 1)}>
                ‹ Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
                Next ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
