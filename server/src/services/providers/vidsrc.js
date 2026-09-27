export default {
  id: 'vidsrc',
  name: 'VidSrc',
  kind: 'embed',
  getStreams({ type, tmdbId, season, episode }) {
    const url =
      type === 'movie'
        ? `https://vidsrc.cc/v3/embed/movie/${tmdbId}?autoPlay=false`
        : `https://vidsrc.cc/v3/embed/tv/${tmdbId}/${season}/${episode}?autoPlay=false`;
    return [{ type: 'embed', url, quality: 'auto' }];
  },
};
