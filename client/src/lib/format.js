export function formatRuntime(minutes) {
  if (!minutes && minutes !== 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function formatEpisodeRuntime(minutes) {
  if (!minutes) return '';
  return `${minutes} min`;
}

export function mediaLabel(type) {
  return type === 'tv' ? 'Series' : 'Movie';
}

export function scoreBadge(vote) {
  const n = Number(vote) || 0;
  return n > 0 ? n.toFixed(1) : '—';
}

export function clamp(text, max = 220) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
