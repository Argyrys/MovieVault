import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import TitleRow from '../components/TitleRow.jsx';
import TrailerModal from '../components/TrailerModal.jsx';
import { SkeletonHero, SkeletonRow } from '../components/Skeleton.jsx';
import useDocTitle from '../lib/useDocTitle.js';
import './Home.css';

export default function Home() {
  useDocTitle('MovieVault', 'browse', 'Watch Free Movies & TV Shows');

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

  // Generate unique description based on available data
  const uniqueDescription = data.hero
    ? `${data.hero.title} is ${data.hero.type === 'movie' ? 'a film' : 'a TV series'} ${data.hero.year ? `released in ${data.hero.year}` : ''}. ${data.hero.genres?.slice(0, 3).map(g => g.name).join(', ') || 'Entertainment'}. Watch trailers and discover similar content.`
    : 'Watch the latest movies and TV shows online for free. MovieVault offers a wide selection of entertainment including new releases, popular titles, and trending K-dramas. No registration required.';

  return (
    <div className="home">
      {/* JSON-LD Organization Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "MovieVault",
          "description": "Watch free movies and TV shows online",
          "url": "https://movievault.sbs",
          "sameAs": [
            "https://github.com/Argyrys/MovieVault"
          ]
        }, null, 2)}
      </script>

      <HeroBanner hero={data.hero} onTrailer={(key) => setTrailer({ key })} />

      <div className="home-unique-value">
        <h2>🆕 New This Week</h2>
        <p>{data.hero?.overview || 'New movies and episodes added regularly'}</p>
      </div>

      <div className="home-unique-value">
        <h2>⭐ Top Rated This Month</h2>
        <p>Based on viewer ratings and reviews</p>
      </div>

      <div className="home-unique-value">
        <h2>🌟 Trending K-Dramas</h2>
        <p>Latest Korean drama episodes and recommendations</p>
      </div>

      <div className="home-rows">
        {data.rows.map((row) => (
          <TitleRow key={row.key} label={row.label} items={row.items} ranked={row.key === 'trending'} />
        ))}
      </div>
      {trailer && <TrailerModal videoKey={trailer.key} title={data.hero?.title} onClose={() => setTrailer(null)} />}
    </div>
  );
}
