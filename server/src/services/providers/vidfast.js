export default {
  id: 'vidfast',
  name: 'VidFast',
  kind: 'embed',
  getStreams({ type, tmdbId, season, episode }) {
    const url =
      type === 'movie'
        ? `https://vidfast.pro/movie/${tmdbId}?autoPlay=true`
        : `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}?autoPlay=true`;
    return [{ type: 'embed', url, quality: 'auto' }];
  },
};
