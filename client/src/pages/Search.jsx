import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TitleCard from '../components/TitleCard.jsx';
import { SkeletonGrid } from '../components/Skeleton.jsx';
import useDocTitle from '../lib/useDocTitle.js';
import './Browse.css';

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  useDocTitle(q ? `Search “${q}”` : 'Search');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!q) {
      setData(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    api
      .search(q, 1)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q, reload]);

  return (
    <div className="browse">
      <div className="browse-head">
        <h1>Search</h1>
        <p>
          {q
            ? `Results for “${q}”${
                data ? ` — ${(data.total_results ?? data.results?.length ?? 0).toLocaleString()} found` : ''
              }`
            : 'Type in the search box above.'}
        </p>
      </div>

      {error && (
        <div className="browse-error" role="alert">
          <p>Search failed: {error}</p>
          <button className="btn btn-primary" onClick={() => setReload((r) => r + 1)}>
            Try again
          </button>
        </div>
      )}
      {loading && <SkeletonGrid count={12} />}
      {!loading && !error && q && data?.results?.length === 0 && (
        <div className="page-state">No titles found for “{q}”.</div>
      )}
      {!loading && data?.results?.length > 0 && (
        <div className="browse-grid">
          {data.results.map((item) => (
            <TitleCard key={`${item.type}-${item.tmdb_id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
