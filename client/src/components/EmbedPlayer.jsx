import { useEffect, useState } from 'react';
import './Player.css';

export default function EmbedPlayer({ src }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(false);
  }, [src]);

  if (blocked) {
    return (
      <div className="player-state">
        <p>This server blocked in-frame playback in your browser.</p>
        <p>
          <a href={src} target="_blank" rel="noreferrer">
            Open the player in a new tab ↗
          </a>
        </p>
      </div>
    );
  }

  return (
    <iframe
      className="embed-player"
      src={src}
      title="Stream player"
      allowFullScreen
      referrerPolicy="origin"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    />
  );
}
