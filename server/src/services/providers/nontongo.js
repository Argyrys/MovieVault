export default {
  id: 'nontongo',
  name: 'K-Drama',
  kind: 'embed',
  getStreams({ type, tmdbId, season, episode }) {
    const url =
      type === 'movie'
        ? `https://nontongo.win/embed/movie/${tmdbId}?autoplay=true`
        : `https://nontongo.win/embed/tv/${tmdbId}/${season}/${episode}?autoplay=true`;
    return [{ type: 'embed', url, quality: 'auto' }];
  },
};
