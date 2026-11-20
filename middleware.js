const SITE = 'https://movievault.sbs';

function attr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const metaCache = new Map();

async function fetchTitleMeta(type, id) {
  const key = `${type}:${id}`;
  const hit = metaCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  try {
    const res = await fetch(`${SITE}/api/title/${type}/${id}`, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.title) return null;
    const out = { title: data.title, year: data.year, overview: data.overview || '', poster: data.poster_url, type: data.type, date: data.release_date, rating: data.vote_average, votes: data.vote_count };
    metaCache.set(key, { data: out, expires: Date.now() + 10 * 60 * 1000 });
    if (metaCache.size > 400) metaCache.delete(metaCache.keys().next().value);
    return out;
  } catch {
    return null;
  }
}

function injectCrawlableContent(html, meta, type, id) {
  if (!meta || !meta.title || !type || !id) return html;
  const desc = meta.description || '';
  const cleanTitle = attr((meta.title || '').replace(/ - Watch .*$/, '').replace(/ — Watch .*$/, ''));
  const year = meta.year ? ' (' + meta.year + ')' : '';
  const kind = type === 'tv' ? 'TV Series' : 'Movie';
  const content = '\n    <noscript><main style="max-width:800px;margin:40px auto;padding:20px;font-family:Arial,sans-serif;color:#fff;background:#0a0a0b"><h1>' + cleanTitle + year + '</h1><p><strong>Type:</strong> ' + kind + '</p>' + (desc ? '<p>' + attr(desc) + '</p>' : '') + (meta.poster ? '<img src="' + attr(meta.poster) + '" alt="' + cleanTitle + '" style="max-width:200px">' : '') + '<p><a href="https://movievault.sbs/watch/' + type + '/' + id + '">Watch ' + kind.toLowerCase() + ' online</a></p><p><a href="https://movievault.sbs/browse">Browse Movies and TV Shows</a></p></main></noscript>\n    <div id="mv-seo-content" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0" aria-hidden="true"><article><h1>' + cleanTitle + year + '</h1><p>' + attr(desc) + '</p></article></div>';
  if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', '<div id="root"></div>' + content);
  } else if (html.includes('</body>')) {
    html = html.replace('</body>', content + '</body>');
  }
  return html;
}

function applyMeta(html, meta) {
  if (meta.title) html = html.replace(/<title>[^<]*<\/title>/, `<title>${attr(meta.title)}</title>`);
  if (meta.description) html = html.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${attr(meta.description)}" />`);
  if (meta.canonical) html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${attr(meta.canonical)}" />`);
  if (meta.ogTitle) html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${attr(meta.ogTitle)}" />`);
  if (meta.ogDescription) html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${attr(meta.ogDescription)}" />`);
  if (meta.ogUrl) html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${attr(meta.ogUrl)}" />`);
  if (meta.ogImage) html = html.replace(/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${attr(meta.ogImage)}" />`);
  if (meta.ogType) html = html.replace(/<meta property="og:type" content="[^"]*"\s*\/>/, `<meta property="og:type" content="${attr(meta.ogType)}" />`);
  if (meta.ogTitle) html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${attr(meta.ogTitle)}" />`);
  if (meta.ogDescription) html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${attr(meta.ogDescription)}" />`);
  if (meta.ogImage) html = html.replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${attr(meta.ogImage)}" />`);
  if (meta.noindex) html = html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, follow" />');
  if (meta.jsonLd) html = html.replace('</head>', `<script type="application/ld+json">${meta.jsonLd}</script>\n  </head>`);
  return html;
}

async function metaFor(path, search) {
  if (path === '/') {
    return {
      title: 'MovieVault - Watch Free Movies, TV Shows & K-Dramas Online',
      description: 'Watch free movies, TV shows and K-Dramas online. Stream Bollywood, Hollywood, Korean dramas, anime and more in HD quality on MovieVault. No sign up required.',
      canonical: SITE + '/',
      ogTitle: 'MovieVault - Watch Free Movies, TV Shows & K-Dramas Online',
      ogDescription: 'Watch free movies, TV series and K-Dramas online. Stream Bollywood, Hollywood, Korean dramas and more in HD. No sign up required.',
      ogUrl: SITE + '/',
      ogImage: SITE + '/og.png',
      ogType: 'website',
      jsonLd: JSON.stringify([
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'MovieVault',
          url: SITE,
          description: 'Watch free movies, TV shows and K-Dramas online in HD',
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: SITE + '/search?q={search_term_string}' },
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'MovieVault',
          url: SITE,
          logo: SITE + '/favicon.svg',
        },
      ]).replace(/</g, '\\u003c'),
    };
  }
  if (path === '/browse') {
    return {
      title: 'Browse Movies & TV Series — Genre, Year & Language Filters | MovieVault',
      description: 'Browse movies and TV series — popular, top-rated and upcoming titles. Filter by genre, year and language on MovieVault.',
      canonical: SITE + '/browse',
      ogUrl: SITE + '/browse',
    };
  }
  const titleMatch = path.match(/^\/title\/(movie|tv)\/(\d+)$/);
  if (titleMatch) {
    const [, type, id] = titleMatch;
    const canonical = `${SITE}/title/${type}/${id}`;
    const t = await fetchTitleMeta(type, id);
    if (!t) return { canonical, ogUrl: canonical };
    const kind = type === 'tv' ? 'TV Series' : 'Movie';
    const title = `${t.title}${t.year ? ` (${t.year})` : ''} — Watch ${kind} Online | MovieVault`;
    const description = `${t.title}${t.year ? ` (${t.year})` : ''}: ${t.overview}`.replace(/\s+/g, ' ').slice(0, 160);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': type === 'tv' ? 'TVSeries' : 'Movie',
      name: t.title,
      description: t.overview.slice(0, 300),
      url: canonical,
      ...(t.poster ? { image: t.poster } : {}),
      ...(t.date ? { datePublished: t.date } : {}),
      ...(t.votes > 0 && t.rating
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: String(t.rating),
              ratingCount: String(t.votes),
            },
          }
        : {}),
    };
    return {
      title,
      description,
      canonical,
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonical,
      ogImage: t.poster || undefined,
      ogType: type === 'tv' ? 'video.tv_show' : 'video.movie',
      jsonLd: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
    };
  }
  const watchMatch = path.match(/^\/watch\/(movie|tv)\/(\d+)/);
  if (watchMatch) {
    const canonical = `${SITE}/title/${watchMatch[1]}/${watchMatch[2]}`;
    return { noindex: true, canonical, ogUrl: canonical };
  }
  if (path === '/search') {
    return { title: 'Search — MovieVault', noindex: true, canonical: SITE + '/search' };
  }
  if (path === '/login') return { title: 'Sign In — MovieVault', noindex: true };
  if (path === '/register') return { title: 'Create Account — MovieVault', noindex: true };
  if (path.startsWith('/admin')) return { title: 'Admin — MovieVault', noindex: true };
  if (path === '/premium') {
    return {
      title: 'Go Premium - Ad-Free Streaming & Downloads | MovieVault',
      description: 'Go premium on MovieVault: ad-free streaming, unlimited downloads and more. Monthly plan at ₹99.',
      canonical: SITE + '/premium',
      ogTitle: 'Go Premium | MovieVault',
      ogDescription: 'Ad-free streaming, downloads and premium features for just ₹99/month.',
      ogUrl: SITE + '/premium',
      ogImage: SITE + '/og.png',
    };
  }
  if (path === '/privacy') return { title: 'Privacy Policy — MovieVault', canonical: SITE + '/privacy' };
  return null;
}

export default async function middleware(req) {
  if (req.headers.get('x-mv-mw')) return;
  const url = new URL(req.url);
  const path = url.pathname;
  if (path.startsWith('/api/')) return;
  if (path === '/index.html') return Response.redirect(SITE + '/' + url.search, 308);
  if (/\.[a-z0-9]{2,6}$/.test(path)) return;

  // Collapse duplicate URL shapes into one canonical form so crawlers don't
  // index variants: trailing slashes, mixed-case route prefixes, /index.html.
  if (path !== '/') {
    let norm = path.replace(/\/+$/, '');
    if (!norm) norm = '/';
    const KNOWN = ['/title', '/watch', '/browse', '/search', '/login', '/register', '/premium', '/privacy', '/admin'];
    const lowerFirst = norm.replace(/^(\/[A-Za-z0-9_-]+)/, (s) => s.toLowerCase());
    if (KNOWN.some((k) => lowerFirst.startsWith(k))) norm = lowerFirst;
    if (norm === '/index.html') norm = '/';
    if (norm !== path) return Response.redirect(new URL(norm + url.search, SITE), 308);
  }

  const headers = new Headers(req.headers);
  headers.set('x-mv-mw', '1');
  headers.delete('if-none-match');
  headers.delete('if-modified-since');
  const res = await fetch(req.url, { headers });
  const type = res.headers.get('content-type') || '';
  if (res.status !== 200 || !type.includes('text/html')) {
    const passthru = new Headers(res.headers);
    passthru.delete('content-encoding');
    passthru.delete('content-length');
    passthru.delete('transfer-encoding');
    passthru.set('x-mv-mw-mode', 'nonhtml');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: passthru });
  }

  // Per-route SEO meta injection (titles, canonicals, OG, JSON-LD).
  let html = await res.text();
  try {
    const meta = await metaFor(path, url.search);
    if (meta) {
      html = applyMeta(html, meta);
      if (meta.type && meta.id && path.match(/^\/title\/(movie|tv)\/\d+$/)) {
        html = injectCrawlableContent(html, meta, meta.type, meta.id);
      }
    }
  } catch (err) {
    console.warn('[mw] meta injection failed:', err.message);
  }

  const out = new Headers(res.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  out.delete('transfer-encoding');
  out.delete('etag');
  out.set('x-mv-mw-mode', 'meta');
  return new Response(html, { status: 200, statusText: res.statusText, headers: out });
}
