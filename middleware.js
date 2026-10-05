const TAG_SRCS = ['https://al5sm.com/tag.min.js', 'https://n6wxm.com/vignette.min.js'];

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default async function middleware(req) {
  if (req.headers.get('x-mv-mw')) return;
  const path = new URL(req.url).pathname;
  if (path.startsWith('/api/')) return;
  if (/\.[a-z0-9]{2,6}$/.test(path)) return;

  const cookies = req.headers.get('cookie') || '';
  const premium = /(?:^|;\s*)mv_role=premium(?:;|$)/.test(cookies);

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

  let html = await res.text();
  if (premium) {
    for (const src of TAG_SRCS) {
      html = html.replace(new RegExp(`<script[^>]*src="${esc(src)}"[^>]*>\\s*</script>`, 'gi'), '');
    }
  }
  const out = new Headers(res.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  out.delete('transfer-encoding');
  out.delete('etag');
  out.set('x-mv-mw-mode', premium ? 'stripped' : 'full');
  return new Response(html, { status: 200, statusText: res.statusText, headers: out });
}
