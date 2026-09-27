export default {
  id: 'vidlink',
  name: 'VidLink',
  kind: 'embed',
  getStreams({ type, tmdbId, season, episode }) {
    const url =
      type === 'movie'
        ? `https://vidlink.pro/movie/${tmdbId}?autoplay=true`
        : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?autoplay=true`;
    return [{ type: 'embed', url, quality: 'auto' }];
  },
};
