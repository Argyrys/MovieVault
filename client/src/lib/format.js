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

const LANG_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', hi: 'Hindi',
  ru: 'Russian', ar: 'Arabic', tr: 'Turkish', nl: 'Dutch', sv: 'Swedish',
  no: 'Norwegian', da: 'Danish', fi: 'Finnish', pl: 'Polish', cs: 'Czech',
  el: 'Greek', he: 'Hebrew', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  ms: 'Malay', uk: 'Ukrainian', ro: 'Romanian', hu: 'Hungarian', bg: 'Bulgarian',
  sr: 'Serbian', hr: 'Croatian', sk: 'Slovak', sl: 'Slovenian', lt: 'Lithuanian',
  lv: 'Latvian', et: 'Estonian', fa: 'Persian', ur: 'Urdu', bn: 'Bengali',
  ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', mr: 'Marathi',
  pa: 'Punjabi', sw: 'Swahili', af: 'Afrikaans', ca: 'Catalan', eu: 'Basque',
  gl: 'Galician', is: 'Icelandic', ga: 'Irish', cy: 'Welsh', sq: 'Albanian',
  mk: 'Macedonian', hy: 'Armenian', ka: 'Georgian', az: 'Azerbaijani',
  kk: 'Kazakh', uz: 'Uzbek', my: 'Burmese',
  km: 'Khmer', lo: 'Lao', mn: 'Mongolian', am: 'Amharic', so: 'Somali',
  'zh-cn': 'Chinese (Simplified)', 'zh-tw': 'Chinese (Traditional)',
  'pt-br': 'Portuguese (Brazil)', 'en-us': 'English', 'es-419': 'Spanish (LATAM)',
};

export function langName(code) {
  if (!code) return '';
  const key = String(code).toLowerCase();
  return LANG_NAMES[key] || LANG_NAMES[key.split('-')[0]] || code.toUpperCase();
}
