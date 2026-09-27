import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { langName } from '../lib/format.js';
import NativePlayer from '../components/NativePlayer.jsx';
import EmbedPlayer from '../components/EmbedPlayer.jsx';
import TrailerModal from '../components/TrailerModal.jsx';
import './Watch.css';

export default function Watch() {
  const { type, id } = useParams();
  const [params, setParams] = useSearchParams();
  const season = Number(params.get('s')) || 1;
  const episode = Number(params.get('e')) || 1;

  const [detail, setDetail] = useState(null);
  const [episodes, setEpisodes] = useState(null);
  const [servers, setServers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [trailer, setTrailer] = useState(false);
  const isTv = type === 'tv';

  const playerRef = useRef(null);
  const audioMenuRef = useRef(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const [audioCurrent, setAudioCurrent] = useState(null);
  const [audioOpen, setAudioOpen] = useState(false);

  const handleAudioInfo = useCallback((tracks, current) => {
    setAudioTracks(tracks || []);
    setAudioCurrent(current || null);
  }, []);

  useEffect(() => {
    setAudioTracks([]);
    setAudioCurrent(null);
    setAudioOpen(false);
  }, [selected]);

  useEffect(() => {
    if (!audioOpen) return;
    const onDown = (e) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) setAudioOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setAudioOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [audioOpen]);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    api
      .title(type, id)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [type, id]);

  useEffect(() => {
    if (!isTv) return;
    let alive = true;
    setEpisodes(null);
    api
      .season(id, season)
      .then((d) => alive && setEpisodes(d))
      .catch(() => alive && setEpisodes({ episodes: [] }));
    return () => {
      alive = false;
    };
  }, [isTv, id, season]);

  useEffect(() => {
    let alive = true;
    setServers(null);
    setSelected(null);
    api
      .stream(type, id, isTv ? { season, episode } : undefined)
      .then((d) => {
        if (!alive) return;
        setServers(d.servers);
        if (d.servers?.length) setSelected(d.servers[0]);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [type, id, isTv, season, episode]);

  const setEp = (s, e) => {
    const next = new URLSearchParams(params);
    next.set('s', String(s));
    next.set('e', String(e));
    setParams(next);
  };

  const setParamSeason = (s) => {
    const next = new URLSearchParams(params);
    next.set('s', String(s));
    next.set('e', '1');
    setParams(next);
  };

  const storageKey = useMemo(() => {
    if (selected?.kind === 'embed') return null;
    return isTv ? `${type}_${id}_${season}_${episode}` : `${type}_${id}`;
  }, [selected, isTv, type, id, season, episode]);

  const nextEp = useCallback(() => {
    if (!episodes?.episodes?.length) return;
    const idx = episodes.episodes.findIndex((e) => e.episode_number === episode);
    const next = episodes.episodes[idx + 1];
    if (next) setEp(season, next.episode_number);
  }, [episodes, episode, season, setEp]);

  const epData = episodes?.episodes?.find((e) => e.episode_number === episode);

  if (error && !detail) return <div className="page-state">Failed to load: {error}</div>;

  return (
    <div className="watch">
      <div className="watch-topbar">
        <Link to={`/title/${type}/${id}`} className="watch-back">
          ← {detail?.title || 'Back'}
        </Link>
        {detail?.trailer_key && (
          <button className="watch-trailer" onClick={() => setTrailer(true)}>
            🎞 Trailer
          </button>
        )}
      </div>

      <div className="watch-stage">
        {!servers && <div className="player-state">Loading servers…</div>}
        {servers?.length === 0 && (
          <div className="player-state">No servers available for this title right now.</div>
        )}
        {selected &&
          (selected.kind === 'embed' ? (
            <EmbedPlayer src={selected.url} />
          ) : (
            <NativePlayer
              ref={playerRef}
              src={selected.url}
              poster={detail?.backdrop_url}
              storageKey={storageKey}
              onAudioInfo={handleAudioInfo}
              isHls={selected.hls}
            />
          ))}
      </div>

      <div className="watch-panels">
        <div className="watch-info">
          <h1>{detail?.title}</h1>
          {isTv ? (
            <p className="watch-eplabel">
              Season {season} · Episode {episode}
              {epData?.title ? ` — ${epData.title}` : ''}
            </p>
          ) : (
            <p className="watch-eplabel">{detail?.year}</p>
          )}

          <div className="server-list" role="group" aria-label="Servers">
            <span className="server-label">Servers:</span>
            {servers?.map((s) => (
              <button
                key={s.id}
                className={`server-chip ${selected?.id === s.id ? 'active' : ''}`}
                onClick={() => setSelected(s)}
                title={s.quality || s.id}
              >
                {s.name}
                {s.quality ? <small>{s.quality}</small> : null}
              </button>
            ))}
            {servers?.length === 0 && <span className="server-empty">none online</span>}
            {audioTracks.length > 1 && (
              <div className="audio-menu" ref={audioMenuRef}>
                <button
                  type="button"
                  className="audio-chip"
                  aria-haspopup="menu"
                  aria-expanded={audioOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAudioOpen((o) => !o);
                  }}
                >
                  🔊 {audioCurrent?.name || 'Audio'} <span className="audio-caret">▾</span>
                </button>
                {audioOpen && (
                  <ul className="audio-list" role="menu">
                    {audioTracks.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={audioCurrent?.id === t.id}
                          className={audioCurrent?.id === t.id ? 'active' : ''}
                          onClick={() => {
                            playerRef.current?.pickAudio(t);
                            setAudioOpen(false);
                          }}
                        >
                          <span className="audio-tick">{audioCurrent?.id === t.id ? '✓' : ''}</span>
                          {t.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {isTv && (
            <div className="ep-nav">
              <div className="season-select">
                <label htmlFor="season">Season</label>
                <select
                  id="season"
                  value={season}
                  onChange={(e) => setParamSeason(Number(e.target.value))}
                >
                  {Array.from({ length: detail?.number_of_seasons || 1 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Season {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ep-grid">
                {episodes?.episodes?.map((ep) => (
                  <button
                    key={ep.episode_number}
                    className={`ep-card ${ep.episode_number === episode ? 'active' : ''}`}
                    onClick={() => setEp(season, ep.episode_number)}
                  >
                    <span className="ep-num">{ep.episode_number}</span>
                    <span className="ep-title">{ep.title || `Episode ${ep.episode_number}`}</span>
                  </button>
                ))}
                {episodes && episodes.episodes?.length === 0 && (
                  <p className="server-empty">No episodes found for this season.</p>
                )}
              </div>
            </div>
          )}

          {episodes && epData && (
            <div className="ep-controls">
              <button
                disabled={episode <= 1}
                onClick={() => setEp(season, episode - 1)}
              >
                ‹ Prev Episode
              </button>
              <button
                disabled={
                  !episodes.episodes ||
                  episode >= episodes.episodes[episodes.episodes.length - 1]?.episode_number
                }
                onClick={nextEp}
              >
                Next Episode ›
              </button>
            </div>
          )}

          {epData?.overview && <p className="ep-overview">{epData.overview}</p>}
          {!isTv && detail?.overview && <p className="ep-overview">{detail.overview}</p>}
        </div>

        <aside className="watch-side">
          <h3>Now Playing</h3>
          <p>{isTv ? `S${season}:E${episode}` : 'Movie'}</p>
          {selected && (
            <div className="watch-meta">
              <span>Server: {selected.name}</span>
              <span>Type: {selected.kind === 'embed' ? 'Embed player' : 'Direct stream'}</span>
              {selected.quality && <span>Quality: {selected.quality}</span>}
              {detail?.original_language && <span>Original audio: {langName(detail.original_language)}</span>}
            </div>
          )}
          <p className="watch-note">
            Playback is provided by third-party servers. If one fails, switch servers above.
            {selected?.kind === 'embed' &&
              ' For embed players, audio/language options (when offered) are inside the player\u2019s own menu.'}
          </p>
        </aside>
      </div>

      {trailer && detail?.trailer_key && (
        <TrailerModal videoKey={detail.trailer_key} title={detail.title} onClose={() => setTrailer(false)} />
      )}
    </div>
  );
}
