import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import TitleRow from '../components/TitleRow.jsx';
import TrailerModal from '../components/TrailerModal.jsx';
import { SkeletonHero, SkeletonRow } from '../components/Skeleton.jsx';
import useDocTitle from '../lib/useDocTitle.js';
import './Home.css';

export default function Home() {
  useDocTitle(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .home()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error)
    return (
      <div className="page-state" role="alert">
        <p>Failed to load home: {error}</p>
        <button className="btn btn-primary" onClick={() => setReload((r) => r + 1)}>
          Try again
        </button>
      </div>
    );
  if (!data) {
    return (
      <div>
        <SkeletonHero />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  return (
    <div className="home">
      <HeroBanner hero={data.hero} onTrailer={(key) => setTrailer({ key })} />
      <div className="home-rows">
        {data.rows.map((row) => (
          <TitleRow key={row.key} label={row.label} items={row.items} ranked={row.key === 'trending'} />
        ))}
      </div>
      {trailer && <TrailerModal videoKey={trailer.key} title={data.hero?.title} onClose={() => setTrailer(null)} />}
    </div>
  );
}
