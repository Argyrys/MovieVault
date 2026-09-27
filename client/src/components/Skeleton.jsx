import './Skeleton.css';

export function SkeletonHero() {
  return (
    <div className="sk-hero">
      <div className="sk-line sk-w60 sk-h-title" />
      <div className="sk-line sk-w40" />
      <div className="sk-line sk-w80" />
      <div className="sk-line sk-w50" />
      <div className="sk-btns">
        <div className="sk-chip" />
        <div className="sk-chip" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="row">
      <div className="row-head">
        <div className="sk-line sk-w20 sk-h-label" />
      </div>
      <div className="row-track">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="sk-card" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 12 }) {
  return (
    <div className="sk-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sk-card" />
      ))}
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="sk-detail">
      <div className="sk-line sk-w50 sk-h-title" />
      <div className="sk-line sk-w30" />
      <div className="sk-line sk-w90" />
      <div className="sk-line sk-w80" />
      <div className="sk-line sk-w60" />
    </div>
  );
}
