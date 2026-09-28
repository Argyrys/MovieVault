import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import './Navbar.css';

export default function Navbar() {
  const [q, setQ] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await api.search(term, 1);
        setSuggestions(data.results.slice(0, 6));
        setShowSug(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setShowSug(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const goSug = (item) => {
    setShowSug(false);
    setQ('');
    setMenuOpen(false);
    navigate(`/title/${item.type}/${item.tmdb_id}`);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''} ${menuOpen ? 'navbar--menu' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={closeMenu} aria-label="MovieVault home">
          <span className="brand-mark">MV</span>
          <span className="brand-name">
            Movie<span className="brand-accent">Vault</span>
          </span>
        </Link>

        <nav className={`nav-links ${menuOpen ? 'nav-links--open' : ''}`}>
          <NavLink to="/" end onClick={closeMenu}>
            Home
          </NavLink>
          <NavLink to="/browse" onClick={closeMenu}>
            Browse
          </NavLink>
          <NavLink to="/browse?type=movie" onClick={closeMenu}>
            Movies
          </NavLink>
          <NavLink to="/browse?type=tv" onClick={closeMenu}>
            TV Series
          </NavLink>
          <NavLink to="/browse?type=tv&lang=ko&genre=18" onClick={closeMenu}>
            K-Dramas
          </NavLink>
          <NavLink to="/admin" onClick={closeMenu}>
            Admin
          </NavLink>
        </nav>

        <div className="nav-right">
          <form className="nav-search" onSubmit={submit} role="search" ref={boxRef}>
            <input
              type="search"
              placeholder="Titles, people, genres..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => suggestions.length && setShowSug(true)}
              aria-label="Search titles"
            />
            {showSug && suggestions.length > 0 && (
              <div className="nav-sug">
                {suggestions.map((s) => (
                  <button type="button" key={`${s.type}-${s.tmdb_id}`} className="nav-sug-item" onClick={() => goSug(s)}>
                    <img src={s.poster_url} alt="" loading="lazy" />
                    <span>
                      <strong>{s.title}</strong>
                      <small>
                        {s.year} · {s.type === 'tv' ? 'Series' : 'Movie'}
                      </small>
                    </span>
                  </button>
                ))}
                <button type="submit" className="nav-sug-all">
                  See all results for “{q.trim()}”
                </button>
              </div>
            )}
          </form>

          <button
            className="nav-burger"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
