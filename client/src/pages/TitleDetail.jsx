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
  useDocTitle(data?.title ? `${data.title}${data.year ? ` (${data.year})` : ''}` : null);

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

  return (
    <div className="detail">
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
