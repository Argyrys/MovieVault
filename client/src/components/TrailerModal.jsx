import { useEffect } from 'react';
import './TrailerModal.css';

export default function TrailerModal({ videoKey, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('intro-lock');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('intro-lock');
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title ? `Trailer — ${title}` : 'Trailer'}</h3>
          <button onClick={onClose} aria-label="Close trailer">
            ✕
          </button>
        </div>
        <div className="modal-frame">
          <iframe
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
            title="Trailer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
