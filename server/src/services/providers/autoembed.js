export default {
  id: 'autoembed',
  name: 'AutoEmbed',
  kind: 'embed',
  getStreams({ type, tmdbId, season, episode }) {
    const url =
      type === 'movie'
        ? `https://autoembed.co/movie/tmdb/${tmdbId}`
        : `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`;
    return [{ type: 'embed', url, quality: 'auto' }];
  },
};
