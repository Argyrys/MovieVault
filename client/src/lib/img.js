const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#16161a"/>' +
      '<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#3d3d46" ' +
      'font-family="Arial, sans-serif" font-weight="700" font-size="42">MV</text></svg>'
  );

export function onImgError(e) {
  const el = e.currentTarget;
  if (el.dataset.fallback) return;
  el.dataset.fallback = '1';
  el.src = FALLBACK;
}
