import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TitleRow from '../components/TitleRow.jsx';
import TrailerModal from '../components/TrailerModal.jsx';
import { SkeletonDetail } from '../components/Skeleton.jsx';
import { formatRuntime, scoreBadge, clamp } from '../lib/format.js';
import { onImgError } from '../lib/img.js';
import useDocTitle from '../lib/useDocTitle.js';
import './TitleDetail.css';

export default function TitleDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [trailer, setTrailer] = useState(null);
  
  // Generate SEO-friendly title
  const seoTitle = data?.title ? `${data.title} ${data.year ? `(${data.year})` : ''} — MovieVault` : 'MovieVault';
  // Generate unique description from overview + genre + unique value
  const uniqueDescription = data?.overview 
    ? `${data.title} (${data.year}): ${data.overview.substring(0, 200)}${data.overview.length > 200 ? '...' : ''}. ${data.genres?.slice(0, 3).map(g => g.name).join(', ')}. Watch ${data.title.toLowerCase()} online for free.`
    : `${data?.title || ''} ${data?.year || ''} — Watch free movies and TV shows at MovieVault`;
  
  useDocTitle(data?.title ? `${data.title}${data.year ? ` (${data.year})` : ''}` : null, type, 'movie');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api
      .title(type, id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [type, id, reload]);

  if (error)
    return (
      <div className="page-state" role="alert">
        <p>Failed to load title: {error}</p>
        <button className="btn btn-primary" onClick={() => setReload((r) => r + 1)}>
          Try again
        </button>
      </div>
    );
  if (!data) return <SkeletonDetail />;

  const director = data.crew?.find((c) => c.job === 'Director');
  const creators = data.crew?.filter((c) => c.job === 'Creator' || c.job === 'Novel');
  const meta = [
    data.year,
    data.runtime ? formatRuntime(data.runtime) : null,
    data.number_of_episodes ? `${data.number_of_episodes} episodes` : null,
    data.status ? `Status: ${data.status}` : null,
  ].filter(Boolean);

  // Generate JSON-LD Schema Markup
  const schemaMarkup = data && {
    "@context": "https://schema.org",
    "@type": type === 'tv' ? "TVSeries" : "Movie",
    "name": data.title,
    "description": data.overview || `Watch ${data.title} online free at MovieVault`,
    "url": `https://movievault.sbs/title/${type}/${id}`,
    "image": data.poster_url || data.backdrop_url,
    "duration": data.runtime ? `${formatRuntime(data.runtime)}` : null,
    "datePublished": data.release_date || data.first_air_date,
    "genre": data.genres?.map(g => g.name) || [],
    "actor": data.cast?.slice(0, 8).map(c => ({
      "@type": "Person",
      "name": c.name,
      "character": c.character
    })) || [],
    "director": director ? [{ "@type": "Person", "name": director.name }] : [],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": data.vote_average || 0,
      "ratingCount": data.vote_count || 0
    }
  };

  return (
    <div className="detail">
      {/* JSON-LD Schema Markup */}
      <script type="application/ld+json">
        {JSON.stringify(schemaMarkup, null, 2)}
      </script>

      <div
        className="detail-bg"
        style={{ backgroundImage: `url(${data.backdrop_url || data.poster_url})` }}
      />
      <div className="detail-fade" />

      <div className="detail-head">
        {data.poster_url ? (
          <img
            className="detail-poster"
            src={data.poster_url}
            alt={data.title}
            onError={onImgError}
          />
        ) : (
          <div className="detail-poster detail-poster--ph" aria-hidden="true">
            MV
          </div>
        )}
        <div className="detail-info">
          <span className="hero-kind">{data.type === 'tv' ? 'SERIES' : 'MOVIE'}</span>
          <h1>{data.title}</h1>
          {data.tagline && <p className="detail-tagline">{data.tagline}</p>}

          <div className="hero-meta">
            <span className="hero-score">{scoreBadge(data.vote_average)} ★</span>
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
            {data.genres?.map((g) => (
              <span key={g.id} className="hero-genre">
                {g.name}
              </span>
            ))}
          </div>

          <p className="detail-overview">{clamp(data.overview, 640)}</p>

          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigate(`/watch/${data.type}/${data.tmdb_id}`)}>
              ▶ Watch Now
            </button>
            {data.trailer_key && (
              <button className="btn btn-ghost btn-trailer" onClick={() => setTrailer(data.trailer_key)}>
                🎞 Trailer
              </button>
            )}
          </div>

          {(director || creators?.length > 0) && (
            <p className="detail-crew">
              {director && (
                <>
                  <strong>Director:</strong> {director.name}{' '}
                </>
              )}
              {creators?.length > 0 && (
                <>
                  <strong>Created by:</strong> {creators.map((c) => c.name).join(', ')}
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Unique Value Section - Why Watch This Movie? */}
      <div className="movie-unique-value">
        <h2>🎬 Why Watch This Movie?</h2>
        <p><strong>Plot:</strong> {data.overview || 'Plot summary available on MovieVault'}</p>
        <p><strong>Highlights:</strong> {data.genres?.slice(0, 3).map(g => `${g.name} elements`).join(', ') || 'Quality entertainment'}.</p>
        <p><strong>Best for:</strong> {data.type === 'movie' ? 'Movie night with friends, solo viewing' : 'Current season, binge-watching fans'}</p>
        <p><strong>Similar movies:</strong> {data.similar?.slice(0, 3).map(s => s.title).join(', ') || 'Check these out'}.</p>
      </div>

      {/* Trivia Section */}
      <div className="movie-trivia">
        <h3>🎥 Trivia</h3>
        <ul>
          {data.genres?.length && <li><strong>Genre:</strong> {data.genres.map(g => g.name).join(', ')}</li>}
          {data.release_date && <li><strong>Released:</strong> {new Date(data.release_date).getFullYear()}</li>}
          {data.runtime && <li><strong>Runtime:</strong> {formatRuntime(data.runtime)}</li>}
        </ul>
      </div>

      {data.cast?.length > 0 && (
        <section className="detail-section">
          <h2>Top Cast</h2>
          <div className="cast-track">
            {data.cast.slice(0, 14).map((c) => (
              <div className="cast-card" key={`${c.id}-${c.character}`}>
                {c.profile_url ? (
                  <img src={c.profile_url} alt={c.name} loading="lazy" onError={onImgError} />
                ) : (
                  <div className="cast-noimg">{c.name.slice(0, 1)}</div>
                )}
                <strong>{c.name}</strong>
                <span>{c.character}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="detail-more">
        {data.similar?.length > 0 && <TitleRow label="More Like This" items={data.similar} />}
        {data.recommendations?.length > 0 && <TitleRow label="Recommended" items={data.recommendations} />}
      </div>

      <div className="detail-breadcrumb">
        <Link to="/browse">← Back to Browse</Link>
      </div>

      {trailer && <TrailerModal videoKey={trailer} title={data.title} onClose={() => setTrailer(null)} />}
    </div>
  );
}
