const TAG_SRCS = [
  'https://al5sm.com/tag.min.js',
  'https://n6wxm.com/vignette.min.js',
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2053351556528753',
];

const SITE = 'https://movievault.sbs';

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      title: 'MovieVault — Stream Movies, TV Series & K-Dramas Online',
      description: 'Watch and stream movies and TV series online — Bollywood, Hollywood, K-Dramas and more. Free streaming and downloads on MovieVault.',
      canonical: SITE + '/',
      ogTitle: 'MovieVault — Stream Movies & TV Series',
      ogDescription: 'Watch movies and TV series online — Bollywood, K-Dramas, Hollywood and more.',
      ogUrl: SITE + '/',
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
      title: 'Go Premium — Ad-Free Streaming | MovieVault',
      description: 'Go premium on MovieVault: ad-free streaming, downloads and more. Monthly plan at ₹99.',
      canonical: SITE + '/premium',
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
  if (/\.[a-z0-9]{2,6}$/.test(path)) return;

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

  // Ad tags never ship in server HTML. The client injects them only for
  // proven-anon sessions (no token, no premium cookie), so premium/admin
  // sessions stay ad-free even when cookies are blocked or unreadable.
  let html = await res.text();
  for (const src of TAG_SRCS) {
    html = html.replace(new RegExp(`<script[^>]*src="${esc(src)}"[^>]*>\\s*</script>`, 'gi'), '');
  }
  try {
    const meta = await metaFor(path, url.search);
    if (meta) html = applyMeta(html, meta);
  } catch (err) {
    console.warn('[mw] meta injection failed:', err.message);
  }

  const out = new Headers(res.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  out.delete('transfer-encoding');
  out.delete('etag');
  out.set('x-mv-mw-mode', 'stripped');
  return new Response(html, { status: 200, statusText: res.statusText, headers: out });
}
