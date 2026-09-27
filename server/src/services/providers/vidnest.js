export default {
  id: 'vidnest',
  name: 'VidNest',
  kind: 'embed',
  getStreams({ type, tmdbId, season, episode }) {
    const url =
      type === 'movie'
        ? `https://vidnest.fun/movie/${tmdbId}`
        : `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`;
    return [{ type: 'embed', url, quality: 'auto' }];
  },
};
