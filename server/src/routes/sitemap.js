import { Router } from 'express';
import NodeCache from 'node-cache';
import { tmdb } from '../services/metadata.js';

const router = Router();
const cache = new NodeCache({ stdTTL: 6 * 60 * 60, useClones: false });

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

async function handler(req, res) {
  let xml = cache.get('xml');
  if (!xml) {
    xml = await buildXml();
    cache.set('xml', xml);
  }
  res.type('application/xml').send(xml);
}

router.get('/sitemap', handler);
router.get('/sitemap.xml', handler);
router.get('/api/sitemap', handler);
router.get('/api/sitemap.xml', handler);

export default router;
