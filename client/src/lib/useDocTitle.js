import { useEffect } from 'react';

export default function useDocTitle(title, type = 'page', suffix = '') {
  useEffect(() => {
    let base = 'MovieVault';
    if (type === 'movie' && title) {
      base = `${title} — MovieVault`;
    } else if (type === 'tv' && title) {
      base = `${title} — MovieVault`;
    } else if (type === 'browse' && title) {
      base = `${title} — MovieVault`;
    } else if (title) {
      base = `${title} — MovieVault`;
    }
    if (suffix) {
      base = `${base} | ${suffix}`;
    }
    document.title = base;
  }, [title, type, suffix]);
}
