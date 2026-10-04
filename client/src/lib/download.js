const CONCURRENCY = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, opts = {}, tries = 6) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 && i < tries - 1) {
        const ra = Number(res.headers.get('retry-after')) || 0;
        await sleep(Math.min(Math.max(ra * 1000, 750 * 2 ** i), 15_000));
        continue;
      }
      return res;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastErr = err;
      if (i < tries - 1) await sleep(500 * 2 ** i);
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('Network error');
}

function absolutize(uri, baseUrl) {
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return null;
  }
}

function hexToIv(hex) {
  const clean = hex.length % 2 ? `0${hex}` : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function seqIv(seq) {
  const out = new Uint8Array(16);
  let n = BigInt(seq);
  for (let i = 15; i >= 8 && n > 0n; i--) {
    out[i] = Number(n & 255n);
    n >>= 8n;
  }
  return out;
}

function parseRange(str, prevEnd) {
  const m = /^(\d+)(?:@(\d+))?$/.exec(String(str).trim());
  if (!m) return null;
  const length = Number(m[1]);
  const offset = m[2] !== undefined ? Number(m[2]) : prevEnd;
  if (!Number.isFinite(length) || !Number.isFinite(offset)) return null;
  return { length, offset, end: offset + length };
}

export function parseVariants(text, baseUrl) {
  const out = [];
  let pending = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const bw = /BANDWIDTH=(\d+)/.exec(line);
      const res = /RESOLUTION=\d+x(\d+)/.exec(line);
      pending = { bandwidth: bw ? Number(bw[1]) : 0, height: res ? Number(res[1]) : 0 };
    } else if (line && !line.startsWith('#') && pending) {
      const url = absolutize(line, baseUrl);
      if (url) out.push({ ...pending, url });
      pending = null;
    }
  }
  return out;
}

export function parseMediaPlaylist(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const segments = [];
  let map = null;
  let key = null;
  let unsupportedKey = false;
  let mediaSequence = 0;
  let pendingRange = null;
  const prevRange = { end: 0, url: null };
  const hasEnd = /#EXT-X-ENDLIST/.test(text);
  const vod = hasEnd || /#EXT-X-PLAYLIST-TYPE:VOD/.test(text);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      mediaSequence = Number(line.split(':')[1]) || 0;
    } else if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = line.slice(line.indexOf(':') + 1);
      const method = (/METHOD=([^,]+)/.exec(attrs) || [])[1] || '';
      if (method === 'AES-128') {
        const uri = (/URI="([^"]+)"/.exec(attrs) || [])[1];
        const ivHex = (/IV=(0x[0-9a-fA-F]+)/.exec(attrs) || [])[1];
        const keyUri = uri ? absolutize(uri, baseUrl) : null;
        if (!keyUri) unsupportedKey = true;
        key = { uri: keyUri, iv: ivHex ? hexToIv(ivHex.slice(2)) : null };
      } else if (method && method !== 'NONE') {
        unsupportedKey = true;
        key = null;
      } else {
        key = null;
      }
    } else if (line.startsWith('#EXT-X-MAP:')) {
      const uri = (/URI="([^"]+)"/.exec(line) || [])[1];
      const br = (/BYTERANGE="([^"]+)"/.exec(line) || [])[1];
      const url = uri ? absolutize(uri, baseUrl) : null;
      let range = null;
      if (br) {
        const p = parseRange(br, 0);
        if (p) range = { length: p.length, offset: p.offset };
      }
      if (url) map = { url, range };
    } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
      pendingRange = line.slice(line.indexOf(':') + 1);
    } else if (!line.startsWith('#')) {
      const url = absolutize(line, baseUrl);
      if (!url) continue;
      let range = null;
      if (pendingRange) {
        const p = parseRange(pendingRange, prevRange.url === url ? prevRange.end : 0);
        if (p) {
          range = { length: p.length, offset: p.offset };
          prevRange.end = p.end;
          prevRange.url = url;
        }
        pendingRange = null;
      }
      segments.push({ url, range, seq: mediaSequence + segments.length, key });
    }
  }

  return { segments, map, unsupportedKey, vod };
}

function pickVariant(variants, targetHeight) {
  const sorted = [...variants].sort((a, b) => b.bandwidth - a.bandwidth);
  if (targetHeight) {
    const near = sorted
      .filter((v) => v.height && Math.abs(v.height - targetHeight) <= 60)
      .sort((a, b) => Math.abs(a.height - targetHeight) - Math.abs(b.height - targetHeight));
    if (near.length) return near[0];
  }
  return sorted[0];
}

async function fetchOk(url, signal) {
  const res = await fetchRetry(url, { signal });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  return res;
}

async function getSegmentBytes(seg, signal, keyCache) {
  const headers = seg.range
    ? { range: `bytes=${seg.range.offset}-${seg.range.offset + seg.range.length - 1}` }
    : undefined;
  const res = await fetchRetry(seg.url, { headers, signal });
  if (!res.ok) throw new Error(`Segment fetch failed (HTTP ${res.status})`);
  let buf = await res.arrayBuffer();

  if (seg.key?.uri) {
    let keyPromise = keyCache.get(seg.key.uri);
    if (!keyPromise) {
      keyPromise = (async () => {
        const kr = await fetchRetry(seg.key.uri, { signal });
        if (!kr.ok) throw new Error(`Stream key fetch failed (HTTP ${kr.status})`);
        const raw = await kr.arrayBuffer();
        return crypto.subtle.importKey('raw', raw, 'AES-CBC', false, ['decrypt']);
      })();
      keyCache.set(seg.key.uri, keyPromise);
    }
    const cryptoKey = await keyPromise;
    const iv = seg.key.iv || seqIv(seg.seq);
    try {
      buf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, buf);
    } catch {
      throw new Error('Stream decryption failed');
    }
  }
  return new Uint8Array(buf);
}

function saveBlob(chunks, type, filename) {
  const blob = new Blob(chunks, { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function sanitizeBase(name) {
  const cleaned = String(name || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'movievault-download';
}

export async function downloadSource({ sourceUrl, isHls, filenameBase, qualityHeight, onProgress, signal }) {
  const report = (p) => {
    try {
      onProgress?.(p);
    } catch {
      /* ignore */
    }
  };
  const base = sanitizeBase(filenameBase);
  const baseUrl = new URL(sourceUrl, location.href).toString();

  if (!isHls) {
    report({ phase: 'fetch', pct: 0 });
    const res = await fetchOk(sourceUrl, signal);
    const ct = res.headers.get('content-type') || '';
    const total = Number(res.headers.get('content-length')) || 0;
    const ext = ct.includes('webm') ? 'webm' : ct.includes('quicktime') ? 'mov' : 'mp4';
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      if (total) report({ phase: 'fetch', pct: Math.min(99, Math.round((got / total) * 100)) });
    }
    const filename = `${base}.${ext}`;
    saveBlob(chunks, ct.startsWith('video/') ? ct : 'application/octet-stream', filename);
    report({ phase: 'done', pct: 100 });
    return { filename };
  }

  report({ phase: 'plan', pct: 0 });
  const masterText = await (await fetchOk(baseUrl, signal)).text();
  let mediaText = masterText;
  let mediaUrl = baseUrl;
  if (masterText.includes('#EXT-X-STREAM-INF')) {
    const variants = parseVariants(masterText, baseUrl);
    if (!variants.length) throw new Error('No downloadable stream variants found');
    const chosen = pickVariant(variants, qualityHeight);
    mediaUrl = chosen.url;
    mediaText = await (await fetchOk(chosen.url, signal)).text();
  }

  const plan = parseMediaPlaylist(mediaText, mediaUrl);
  if (plan.unsupportedKey) throw new Error('This stream uses unsupported encryption');
  if (!plan.segments.length) throw new Error('No downloadable segments found');
  if (!plan.vod) throw new Error('Live streams cannot be downloaded');

  const isMp4 = Boolean(plan.map) && plan.segments.some((s) => /\.m4s(\?|$)/i.test(s.url));
  const filename = `${base}.${isMp4 ? 'mp4' : 'ts'}`;
  const keyCache = new Map();
  const chunks = [];
  const total = plan.segments.length + (plan.map ? 1 : 0);
  let doneCount = 0;

  if (plan.map) {
    chunks.push(await getSegmentBytes(plan.map, signal, keyCache));
    doneCount += 1;
    report({ phase: 'fetch', pct: Math.round((doneCount / total) * 100) });
  }

  for (let i = 0; i < plan.segments.length; i += CONCURRENCY) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = plan.segments.slice(i, i + CONCURRENCY);
    const parts = await Promise.all(batch.map((seg) => getSegmentBytes(seg, signal, keyCache)));
    for (const part of parts) chunks.push(part);
    doneCount += parts.length;
    report({ phase: 'fetch', pct: Math.min(99, Math.round((doneCount / total) * 100)) });
  }

  saveBlob(chunks, 'application/octet-stream', filename);
  report({ phase: 'done', pct: 100 });
  return { filename };
}
