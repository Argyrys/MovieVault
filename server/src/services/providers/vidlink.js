export default {
  id: 'vidlink',
  name: 'VidLink',
  kind: 'embed',
  getStreams({ type, tmdbId, season, episode }) {
    const url =
      type === 'movie'
        ? `https://vidlink.pro/movie/${tmdbId}`
        : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;
    return [{ type: 'embed', url, quality: 'auto' }];
  },
};
