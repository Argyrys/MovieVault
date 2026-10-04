import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark">MV</span>
          <span>
            Movie<span className="brand-accent">Vault</span>
          </span>
        </div>
        <nav className="footer-links">
          <Link to="/">Home</Link>
          <Link to="/browse">Browse</Link>
          <Link to="/browse?type=movie">Movies</Link>
          <Link to="/browse?type=tv">TV Series</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <p className="footer-tmdb">
          Movie data provided by <a href="https://simkl.com" target="_blank" rel="noreferrer">Simkl</a>.
          This product uses the Simkl API but is not endorsed or certified by Simkl.
        </p>
        <p className="footer-tmdb">
          This product uses the TMDB API but is not endorsed or certified by TMDB. Stream availability
          depends on third-party providers.
        </p>
        <p className="footer-copy">© {new Date().getFullYear()} MovieVault</p>
      </div>
    </footer>
  );
}
