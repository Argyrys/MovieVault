import { useNavigate } from 'react-router-dom';
import { scoreBadge } from '../lib/format.js';
import './TitleCard.css';

export default function TitleCard({ item, rank }) {
  const navigate = useNavigate();
  if (!item) return null;

  return (
    <button
      className={`card ${rank != null ? 'card--ranked' : ''}`}
      onClick={() => navigate(`/title/${item.type}/${item.tmdb_id}`)}
      title={item.title}
    >
      {rank != null && <span className="sr-only">Rank {rank}</span>}
      <div className="card-poster">
        {rank != null && <span className="card-rank" aria-hidden="true">{rank}</span>}
        {item.poster_url ? (
          <img src={item.poster_url} alt={item.title} loading="lazy" />
        ) : (
          <div className="card-noimg">{item.title}</div>
        )}
        <div className="card-play">▶</div>
        <div className="card-badge">{item.type === 'tv' ? 'SERIES' : 'MOVIE'}</div>
      </div>
      <div className="card-info">
        <div className="card-title">{item.title}</div>
        <div className="card-meta">
          <span>{item.year || '—'}</span>
          <span className="card-score">{scoreBadge(item.vote_average)} ★</span>
        </div>
      </div>
    </button>
  );
}
