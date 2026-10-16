import { createHash } from 'node:crypto';
import { Router } from 'express';
import NodeCache from 'node-cache';
import { tmdb } from '../services/metadata.js';

const router = Router();
const cache = new NodeCache({ stdTTL: 60 * 60, useClones: false });

const SITE = 'https://movievault.sbs';

const STATIC_URLS = [
  { loc: '/', priority: '1.0', freq: 'daily' },
  { loc: '/browse', priority: '0.8', freq: 'daily' },
  { loc: '/browse?type=movie', priority: '0.8', freq: 'daily' },
  { loc: '/browse?type=tv', priority: '0.8', freq: 'daily' },
  { loc: '/privacy', priority: '0.3', freq: 'yearly' },
];

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function buildXml() {
  const today = new Date().toISOString().slice(0, 10);
  let titles = [];
  try {
    if (typeof tmdb.sitemapEntries === 'function') titles = await tmdb.sitemapEntries();
  } catch (err) {
    console.warn('[sitemap] title entries unavailable:', err.message);
  }
  const urls = [
    ...STATIC_URLS.map((s) => ({ ...s, loc: SITE + s.loc, lastmod: today })),
    ...titles.map((t) => ({
      loc: `${SITE}/title/${t.type}/${t.tmdb_id}`,
      priority: '0.6',
      freq: 'weekly',
      lastmod: t.release_date || null,
    })),
  ];
  const rows = urls
    .map((u) => {
      const parts = [`<loc>${xmlEscape(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`<lastmod>${u.lastmod}</lastmod>`);
      parts.push(`<changefreq>${u.freq}</changefreq>`, `<priority>${u.priority}</priority>`);
      return `  <url>${parts.join('')}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>`;
}

async function getDoc() {
  const hit = cache.get('doc');
  if (hit) return hit;
  const xml = await buildXml();
  const etag = `W/"${createHash('sha1').update(xml).digest('base64url').slice(0, 27)}"`;
  const doc = { xml, etag };
  cache.set('doc', doc);
  return doc;
}

async function handler(req, res) {
  const doc = await getDoc();
  res.set({
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    ETag: doc.etag,
  });
  if (req.headers['if-none-match'] === doc.etag) {
    res.status(304).end();
    return;
  }
  res.type('application/xml').send(doc.xml);
}

router.get('/sitemap', handler);
router.get('/sitemap.xml', handler);
router.get('/api/sitemap', handler);
router.get('/api/sitemap.xml', handler);

// IndexNow: submit every sitemap URL to Bing/Yandex/Yep (and Google-adjacent
// crawlers). Hit daily by the Vercel cron; throttled against abuse.
const INDEXNOW_KEY = 'c47ebd3b91ef135fcdbc8f064561f1ad';
const pingThrottle = new NodeCache({ stdTTL: 12 * 60 * 60, useClones: false });

router.get('/api/ping-search', async (req, res) => {
  const sent = pingThrottle.get('sent');
  if (sent) {
    res.json({ ok: true, throttled: true, ...sent });
    return;
  }
  let titles = [];
  try {
    if (typeof tmdb.sitemapEntries === 'function') titles = await tmdb.sitemapEntries();
  } catch (err) {
    console.warn('[ping] entries unavailable:', err.message);
  }
  const urls = [
    ...STATIC_URLS.map((s) => SITE + s.loc),
    ...titles.map((t) => `${SITE}/title/${t.type}/${t.tmdb_id}`),
  ];
  const body = {
    host: 'movievault.sbs',
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, 10000),
  };
  let out = { ok: false, urls: urls.length, status: 0 };
  try {
    // Bing's alternate IndexNow host; api.indexnow.org rejects some
    // datacenter egress IPs with 403 during key validation.
    const r = await fetch('https://www.bing.com/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    out = { ok: r.ok, urls: urls.length, status: r.status };
  } catch (err) {
    out.error = err.message;
  }
  // Only remember successful submissions; never throttle on failures.
  if (out.ok || out.status === 200 || out.status === 202) pingThrottle.set('sent', out);
  // Keep the sitemap doc cache warm so Google's sitemap fetcher (and any
  // crawler) always gets an instant 200, never a cold rebuild.
  try {
    await getDoc();
  } catch { /* warmup only */ }
  res.json(out);
});

export default router;
