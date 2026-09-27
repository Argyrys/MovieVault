import net from 'node:net';

export function encodeProxy(url, headers = {}) {
  const payload = JSON.stringify({ url, headers });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeProxy(s) {
  if (!s || s.length > 4096) return null;
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
    if (typeof parsed?.url !== 'string') return null;
    return { url: parsed.url, headers: parsed.headers && typeof parsed.headers === 'object' ? parsed.headers : {} };
  } catch {
    return null;
  }
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    return false;
  }
  return false;
}

export function isSafeUpstream(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'only https upstreams allowed' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'private host' };
  }
  if (net.isIP(host) && isPrivateIp(host)) return { ok: false, reason: 'private address' };
  return { ok: true, url: url.toString() };
}

export function proxiedUrl(target, headers) {
  return `/api/stream/proxy?s=${encodeProxy(target, headers)}`;
}
