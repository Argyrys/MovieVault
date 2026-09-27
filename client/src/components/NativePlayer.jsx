import { useEffect, useRef, useState } from 'react';
import { langName } from '../lib/format.js';
import './Player.css';

export default function NativePlayer({ src, poster, storageKey }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const menuRef = useRef(null);
  const tracksRef = useRef([]);
  const [error, setError] = useState(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const [audioCurrent, setAudioCurrent] = useState(null);
  const [audioOpen, setAudioOpen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls = null;
    let cancelled = false;
    setError(null);
    setAudioTracks([]);
    setAudioCurrent(null);
    setAudioOpen(false);
    tracksRef.current = [];

    const resumeKey = storageKey ? `mv_pos_${storageKey}` : null;
    const saved = resumeKey ? Number(localStorage.getItem(resumeKey)) || 0 : 0;
    if (saved > 5) {
      const onMeta = () => {
        if (video.duration && saved < video.duration - 10) video.currentTime = saved;
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
    }

    const display = (t, i) => t.name || (t.lang ? langName(t.lang) : `Audio ${i + 1}`);

    const syncHlsTracks = () => {
      if (!hls) return;
      const list = hls.audioTracks.map((t, i) => ({
        id: t.id,
        name: display(t, i),
        lang: t.lang || null,
      }));
      tracksRef.current = list;
      setAudioTracks(list);
      setAudioCurrent(list.find((t) => t.id === hls.audioTrack) || list[0] || null);
    };

    const syncNativeTracks = () => {
      const list = video.audioTracks;
      if (!list || list.length < 2) {
        setAudioTracks([]);
        setAudioCurrent(null);
        return;
      }
      const mapped = Array.from(list).map((t, i) => ({
        id: t.id,
        name: t.label || (t.language ? langName(t.language) : `Audio ${i + 1}`),
        lang: t.language || null,
      }));
      setAudioTracks(mapped);
      const active = Array.from(list).find((t) => t.enabled);
      setAudioCurrent(mapped.find((t) => t.id === active?.id) || mapped[0] || null);
    };

    const onNativeChange = () => syncNativeTracks();
    if (video.audioTracks) {
      video.audioTracks.addEventListener('change', onNativeChange);
      video.audioTracks.addEventListener('addtrack', onNativeChange);
      video.audioTracks.addEventListener('removetrack', onNativeChange);
    }

    const isHls = src.includes('.m3u8');
    if (isHls) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (Hls.isSupported()) {
            hls = new Hls({ maxBufferLength: 30 });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncHlsTracks);
            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, data) => {
              const list = tracksRef.current;
              setAudioCurrent(list.find((t) => t.id === data.id) || list[0] || null);
            });
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (data.fatal) setError('Stream failed to load. Try another server.');
            });
          } else {
            video.src = src;
            video.addEventListener('error', () => setError('Stream failed to load. Try another server.'));
          }
        })
        .catch(() => {
          if (!cancelled) setError('Stream player failed to load. Try another server.');
        });
    } else {
      video.src = src;
      video.addEventListener('error', () => setError('Stream failed to load. Try another server.'));
    }

    let last = 0;
    const onTime = () => {
      if (!resumeKey) return;
      const now = Date.now();
      if (now - last > 5000 && video.currentTime > 10) {
        last = now;
        localStorage.setItem(resumeKey, String(Math.floor(video.currentTime)));
      }
    };
    video.addEventListener('timeupdate', onTime);

    // audio must never start muted; if the browser blocks audible autoplay,
    // the first click anywhere starts it with sound
    video.muted = false;
    video.volume = 1;
    const onFirstGesture = () => {
      if (video.paused) {
        video.muted = false;
        video.volume = 1;
        video.play().catch(() => {});
      }
      document.removeEventListener('pointerdown', onFirstGesture);
    };
    document.addEventListener('pointerdown', onFirstGesture);

    return () => {
      cancelled = true;
      video.removeEventListener('timeupdate', onTime);
      document.removeEventListener('pointerdown', onFirstGesture);
      if (video.audioTracks) {
        video.audioTracks.removeEventListener('change', onNativeChange);
        video.audioTracks.removeEventListener('addtrack', onNativeChange);
        video.audioTracks.removeEventListener('removetrack', onNativeChange);
      }
      if (hls) hls.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [src, storageKey]);

  useEffect(() => {
    if (!audioOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setAudioOpen(false);
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

  const pickAudio = (track) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.audioTrack = track.id;
    } else {
      const list = videoRef.current?.audioTracks;
      if (list) {
        for (let i = 0; i < list.length; i++) list[i].enabled = list[i].id === track.id;
      }
    }
    setAudioCurrent(track);
    setAudioOpen(false);
  };

  if (error) return <div className="player-state">⚠ {error}</div>;

  return (
    <div className="player-shell">
      <video
        ref={videoRef}
        className="native-player"
        controls
        autoPlay
        poster={poster}
        playsInline
      />
      {audioTracks.length > 1 && (
        <div className="audio-menu" ref={menuRef}>
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
                    onClick={() => pickAudio(t)}
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
  );
}
