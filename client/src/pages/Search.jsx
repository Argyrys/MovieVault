import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TitleCard from '../components/TitleCard.jsx';
import { SkeletonGrid } from '../components/Skeleton.jsx';
import './Browse.css';

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) {
      setData(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .search(q, 1)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div className="browse">
      <div className="browse-head">
        <h1>Search</h1>
        <p>
          {q ? `Results for “${q}”${data ? ` — ${data.total_results.toLocaleString()} found` : ''}` : 'Type in the search box above.'}
        </p>
      </div>

      {error && <div className="page-state">Search failed: {error}</div>}
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
