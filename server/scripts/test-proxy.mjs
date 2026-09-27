const BASE = 'http://localhost:5000/api/stream';

const encode = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');

async function main() {
  // 1. HLS manifest rewrite
  const manifestUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  const res1 = await fetch(`${BASE}/proxy?s=${encode({ url: manifestUrl, headers: {} })}`);
  const text = await res1.text();
  const lines = text.split('\n').filter(Boolean);
  const uriLines = lines.filter((l) => !l.startsWith('#'));
  console.log('1. manifest:', res1.status, res1.headers.get('content-type'));
  console.log('   total lines:', lines.length, 'uri lines:', uriLines.length);
  console.log('   first uri:', uriLines[0]);

  // 2. Drill into variant playlist to find a real media segment
  if (uriLines[0]) {
    const resVar = await fetch(new URL(uriLines[0], 'http://localhost:5000'));
    const variant = await resVar.text();
    const media = variant.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    console.log('2a. variant:', resVar.status, 'media uris:', media.length, media[0]?.slice(0, 80));
    if (media[0]) {
      const res2 = await fetch(new URL(media[0], 'http://localhost:5000'));
      const buf = Buffer.from(await res2.arrayBuffer());
      console.log('2b. segment:', res2.status, res2.headers.get('content-type'), 'bytes:', buf.length, 'magic:', buf.subarray(0, 4).toString('hex'));
    }
  }

  // 3. MP4 range request
  const mp4 = 'https://mdn.github.io/shared-assets/videos/flower.mp4';
  const res3 = await fetch(`${BASE}/proxy?s=${encode({ url: mp4, headers: {} })}`, {
    headers: { Range: 'bytes=0-99' },
  });
  const part = Buffer.from(await res3.arrayBuffer());
  console.log('3. mp4 range:', res3.status, res3.headers.get('content-range'), 'bytes:', part.length);

  // 4. SSRF guard
  for (const bad of ['http://localhost:5000/api/health', 'https://127.0.0.1/x', 'https://192.168.1.1/x', 'ftp://example.com/x']) {
    const r = await fetch(`${BASE}/proxy?s=${encode({ url: bad, headers: {} })}`);
    console.log('4. ssrf', bad, '->', r.status, (await r.text()).slice(0, 90));
  }

  // 5. Invalid payload
  const r5 = await fetch(`${BASE}/proxy?s=notbase64json`);
  console.log('5. bad payload ->', r5.status);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
