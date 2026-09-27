import { useRef } from 'react';
import TitleCard from './TitleCard.jsx';
import './TitleRow.css';

export default function TitleRow({ label, items, ranked = false }) {
  const ref = useRef(null);
  if (!items?.length) return null;

  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <section className="row">
      <div className="row-head">
        <h2 className="row-label">{label}</h2>
        <div className="row-nav">
          <button onClick={() => scroll(-1)} aria-label="Scroll left">
            ‹
          </button>
          <button onClick={() => scroll(1)} aria-label="Scroll right">
            ›
          </button>
        </div>
      </div>
      <div className="row-track" ref={ref}>
        {items.map((item, i) => (
          <TitleCard key={`${item.type}-${item.tmdb_id}`} item={item} rank={ranked ? i + 1 : null} />
        ))}
      </div>
    </section>
  );
}
