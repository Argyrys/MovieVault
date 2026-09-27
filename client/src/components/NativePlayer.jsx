import { useEffect, useRef, useState } from 'react';
import './Player.css';

export default function NativePlayer({ src, poster, storageKey }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls = null;
    let cancelled = false;
    setError(null);

    const resumeKey = storageKey ? `mv_pos_${storageKey}` : null;
    const saved = resumeKey ? Number(localStorage.getItem(resumeKey)) || 0 : 0;
    if (saved > 5) {
      const onMeta = () => {
        if (video.duration && saved < video.duration - 10) video.currentTime = saved;
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
    }

    const isHls = src.includes('.m3u8');
    if (isHls) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (Hls.isSupported()) {
            hls = new Hls({ maxBufferLength: 30 });
            hls.loadSource(src);
            hls.attachMedia(video);
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

    return () => {
      cancelled = true;
      video.removeEventListener('timeupdate', onTime);
      if (hls) hls.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, storageKey]);

  if (error) return <div className="player-state">⚠ {error}</div>;

  return (
    <video
      ref={videoRef}
      className="native-player"
      controls
      autoPlay
      poster={poster}
      playsInline
    />
  );
}
