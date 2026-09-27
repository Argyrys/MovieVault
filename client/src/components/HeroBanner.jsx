import { useNavigate } from 'react-router-dom';
import { formatRuntime, scoreBadge, clamp } from '../lib/format.js';
import './HeroBanner.css';

export default function HeroBanner({ hero, onTrailer }) {
  const navigate = useNavigate();
  if (!hero) return null;

  const meta = [
    hero.year,
    `${scoreBadge(hero.vote_average)} ★`,
    hero.runtime ? formatRuntime(hero.runtime) : null,
    hero.number_of_seasons ? `${hero.number_of_seasons} Season${hero.number_of_seasons > 1 ? 's' : ''}` : null,
  ].filter(Boolean);

  return (
    <section className="hero">
      <div
        className="hero-bg"
        style={{ backgroundImage: `url(${hero.backdrop_url || hero.poster_url})` }}
      />
      <div className="hero-fade" />

      <div className="hero-content">
        <span className="hero-kind">{hero.type === 'tv' ? 'SERIES' : 'MOVIE'}</span>
        <h1 className="hero-title">{hero.title}</h1>
        {hero.tagline && <p className="hero-tagline">{hero.tagline}</p>}
        <div className="hero-meta">
          {meta.map((m, i) => (
            <span key={i} className={String(m).includes('★') ? 'hero-score' : ''}>
              {m}
            </span>
          ))}
          {hero.genres?.slice(0, 3).map((g) => (
            <span key={g.id} className="hero-genre">
              {g.name}
            </span>
          ))}
        </div>
        <p className="hero-overview">{clamp(hero.overview, 260)}</p>

        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/watch/${hero.type}/${hero.tmdb_id}`)}>
            ▶ Play
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(`/title/${hero.type}/${hero.tmdb_id}`)}>
            ⓘ More Info
          </button>
          {hero.trailer_key && (
            <button className="btn btn-ghost btn-trailer" onClick={() => onTrailer(hero.trailer_key)}>
              🎞 Trailer
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
