import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { downloadSource, sanitizeBase } from '../lib/download.js';
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
  const [detailReady, setDetailReady] = useState(false);
  const [episodes, setEpisodes] = useState(null);
  const [servers, setServers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [userPicked, setUserPicked] = useState(false);
  const [error, setError] = useState(null);
  const [streamError, setStreamError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const [trailer, setTrailer] = useState(false);
  const isTv = type === 'tv';

  const playerRef = useRef(null);
  const audioMenuRef = useRef(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const [audioCurrent, setAudioCurrent] = useState(null);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioSide, setAudioSide] = useState('right');

  const qualityMenuRef = useRef(null);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [qualityCurrentId, setQualityCurrentId] = useState(-1);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [qualitySide, setQualitySide] = useState('right');

  const dlAbortRef = useRef(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlState, setDlState] = useState(null);

  const handleAudioInfo = useCallback((tracks, current) => {
    setAudioTracks(tracks || []);
    setAudioCurrent(current || null);
  }, []);

  const handleQualityInfo = useCallback((levels, currentId) => {
    setQualityLevels(levels || []);
    setQualityCurrentId(typeof currentId === 'number' ? currentId : -1);
  }, []);

  useEffect(() => {
    setAudioTracks([]);
    setAudioCurrent(null);
    setAudioOpen(false);
    setQualityLevels([]);
    setQualityCurrentId(-1);
    setQualityOpen(false);
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
    if (!qualityOpen) return;
    const onDown = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) setQualityOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setQualityOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [qualityOpen]);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setDetailReady(false);
    setError(null);
    api
      .title(type, id)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setDetailReady(true));
    return () => {
      alive = false;
    };
  }, [type, id, retryTick]);

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
    setUserPicked(false);
    setStreamError(null);
    api
      .stream(type, id, isTv ? { season, episode } : undefined)
      .then((d) => {
        if (!alive) return;
        setServers(d.servers);
      })
      .catch((e) => alive && setStreamError(e.message));
    return () => {
      alive = false;
    };
  }, [type, id, isTv, season, episode, retryTick]);

  useEffect(() => {
    if (userPicked || !servers?.length || !detailReady) return;
    const preferHindi = detail?.original_language === 'en';
    const preferred = preferHindi ? servers.find((s) => s.language === 'Hindi') : null;
    setSelected(preferred || servers[0]);
  }, [servers, detail, detailReady, userPicked]);

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

  const sortedQualities = useMemo(
    () => [...qualityLevels].sort((a, b) => (b.height || 0) - (a.height || 0)),
    [qualityLevels]
  );
  const qualityName =
    qualityCurrentId === -1
      ? 'Auto'
      : qualityLevels.find((l) => l.id === qualityCurrentId)?.name || 'Auto';

  const dlMeta = useMemo(() => {
    if (!detail) return null;
    const directs = (servers || []).filter((s) => s.kind !== 'embed');
    if (!directs.length) return null;
    const base = isTv
      ? `${detail.title || 'Episode'} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
      : `${detail.title || 'Movie'}${detail.year ? ` (${detail.year})` : ''}`;
    const directSelected = Boolean(selected && selected.kind !== 'embed');
    const level = qualityLevels.find((l) => l.id === qualityCurrentId);
    const heights = [...qualityLevels]
      .filter((l) => l.height)
      .sort((a, b) => a.height - b.height);
    const chosen = level || heights[0] || null;
    const qualityLabel =
      chosen?.name ||
      (directSelected && selected.quality && selected.quality !== 'auto' ? selected.quality : null);
    return { base, directs, directSelected, qualityHeight: chosen?.height || null, qualityLabel };
  }, [servers, selected, detail, isTv, season, episode, qualityLevels, qualityCurrentId]);

  const startDownload = async () => {
    if (dlBusy) {
      dlAbortRef.current?.abort();
      return;
    }
    if (!dlMeta) return;

    let fileHandle = null;
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const guessExt = dlMeta.directs.some((s) => s.hls) ? '.ts' : '.mp4';
        fileHandle = await window.showSaveFilePicker({
          suggestedName: `${sanitizeBase(dlMeta.base)}${guessExt}`,
        });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        fileHandle = null;
      }
    }

    setDlBusy(true);
    setDlState({ pct: 0 });
    const controller = new AbortController();
    dlAbortRef.current = controller;

    try {
      const ordered =
        dlMeta.directSelected && selected
          ? [selected, ...dlMeta.directs.filter((s) => s.id !== selected.id)]
          : dlMeta.directs;

      let source = null;
      for (const cand of ordered) {
        try {
          const probe = await fetch(cand.url, { signal: controller.signal });
          if (probe.ok) {
            source = cand;
            break;
          }
          if (probe.body) probe.body.cancel().catch(() => {});
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
        }
      }
      if (!source) throw new Error('No downloadable server available right now');

      fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, provider: source.id, quality: dlMeta.qualityLabel }),
      }).catch(() => {});

      await downloadSource({
        sourceUrl: source.url,
        isHls: Boolean(source.hls),
        filenameBase: dlMeta.base,
        qualityHeight: dlMeta.qualityHeight,
        onProgress: (p) => setDlState({ pct: p.pct }),
        signal: controller.signal,
        fileHandle,
      });
      setDlState(null);
    } catch (err) {
      if (err?.name === 'AbortError') setDlState(null);
      else setDlState({ error: err?.message || 'Download failed' });
    } finally {
      setDlBusy(false);
      dlAbortRef.current = null;
    }
  };

  const retryAll = () => {
    setError(null);
    setStreamError(null);
    setRetryTick((t) => t + 1);
  };

  if (error && !detail) {
    return (
      <div className="page-state">
        <div>Failed to load: {error}</div>
        <button type="button" className="btn btn-ghost" onClick={retryAll}>
          Try again
        </button>
      </div>
    );
  }

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
        {!detailReady && (
          <div className="player-state" role="status">
            <span className="player-spinner" aria-hidden="true" />
            <span>Loading…</span>
          </div>
        )}
        {detailReady && !servers && !streamError && (
          <div className="player-state" role="status">
            <span className="player-spinner" aria-hidden="true" />
            <span>Loading servers…</span>
          </div>
        )}
        {detailReady && !servers && streamError && (
          <div className="player-state" role="alert">
            <span>⚠ Couldn’t load servers — {streamError}</span>
            <button type="button" className="player-retry" onClick={retryAll}>
              Try again
            </button>
          </div>
        )}
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
              onQualityInfo={handleQualityInfo}
              isHls={selected.hls}
              subtitles={selected.subtitles}
            />
          ))}
      </div>

      <div className="watch-panels">
        <div className="watch-info">
          <h1>
            {detail?.title || (
              <span className="watch-title-skel" aria-hidden="true">
                <span className="sk-line sk-w50 sk-h-title" />
              </span>
            )}
          </h1>
          {isTv ? (
            <p className="watch-eplabel">
              Season {season} · Episode {episode}
              {epData?.title ? ` — ${epData.title}` : ''}
            </p>
          ) : (
            detail?.year && <p className="watch-eplabel">{detail.year}</p>
          )}

          <div className="server-list" role="group" aria-label="Servers">
            <span className="server-label">Servers:</span>
            {servers?.map((s) => (
              <button
                key={s.id}
                className={`server-chip ${selected?.id === s.id ? 'active' : ''}`}
                onClick={() => {
                  setUserPicked(true);
                  setSelected(s);
                }}
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
                    if (!audioOpen) {
                      const r = e.currentTarget.getBoundingClientRect();
                      setAudioSide(r.left - 24 >= 195 ? 'right' : 'left');
                    }
                    setAudioOpen((o) => !o);
                  }}
                >
                  🔊 {audioCurrent?.name || 'Audio'} <span className="audio-caret">▾</span>
                </button>
                {audioOpen && (
                  <ul
                    className="audio-list"
                    role="menu"
                    style={audioSide === 'left' ? { left: 0, right: 'auto' } : undefined}
                  >
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
            {qualityLevels.length > 1 && (
              <div className="quality-menu" ref={qualityMenuRef}>
                <button
                  type="button"
                  className="quality-chip"
                  aria-haspopup="menu"
                  aria-expanded={qualityOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!qualityOpen) {
                      const r = e.currentTarget.getBoundingClientRect();
                      setQualitySide(r.left - 24 >= 195 ? 'right' : 'left');
                    }
                    setQualityOpen((o) => !o);
                  }}
                >
                  ⛶ {qualityName} <span className="audio-caret">▾</span>
                </button>
                {qualityOpen && (
                  <ul
                    className="quality-list"
                    role="menu"
                    style={qualitySide === 'left' ? { left: 0, right: 'auto' } : undefined}
                  >
                    <li key="auto">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={qualityCurrentId === -1}
                        className={qualityCurrentId === -1 ? 'active' : ''}
                        onClick={() => {
                          playerRef.current?.pickQuality(-1);
                          setQualityOpen(false);
                        }}
                      >
                        <span className="audio-tick">{qualityCurrentId === -1 ? '✓' : ''}</span>
                        Auto
                      </button>
                    </li>
                    {sortedQualities.map((q) => (
                      <li key={q.id}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={qualityCurrentId === q.id}
                          className={qualityCurrentId === q.id ? 'active' : ''}
                          onClick={() => {
                            playerRef.current?.pickQuality(q.id);
                            setQualityOpen(false);
                          }}
                        >
                          <span className="audio-tick">{qualityCurrentId === q.id ? '✓' : ''}</span>
                          {q.name}
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
              <span>
                Quality:{' '}
                {qualityLevels.length > 1
                  ? qualityName
                  : selected.quality || 'auto'}
              </span>
              {detail?.original_language && <span>Original audio: {langName(detail.original_language)}</span>}
            </div>
          )}
          {(dlMeta || dlBusy) && (
            <div className="watch-dl-wrap">
              <button
                type="button"
                className={`watch-dl ${dlBusy ? 'busy' : ''}`}
                onClick={startDownload}
                title={dlBusy ? 'Click to cancel' : undefined}
              >
                {dlBusy
                  ? `Downloading… ${dlState?.pct ?? 0}%`
                  : `⬇ Download${dlMeta.qualityLabel ? ` · ${dlMeta.qualityLabel}` : ''}`}
              </button>
              {dlState?.error && <p className="watch-dl-error">{dlState.error}</p>}
            </div>
          )}
          <p className="watch-note">
            Playback is provided by third-party servers. If one fails, switch servers above.
            {selected?.kind === 'embed' &&
              ' For embed players, audio/language and quality options (when offered) are inside the player\u2019s own menu.'}
          </p>
        </aside>
      </div>

      {trailer && detail?.trailer_key && (
        <TrailerModal videoKey={detail.trailer_key} title={detail.title} onClose={() => setTrailer(false)} />
      )}
    </div>
  );
}
