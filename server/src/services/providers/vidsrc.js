// vidsrc.cc is currently returning 522 (connection timed out) for all titles.
// vidsrc.to / vidsrc.me are also unreliable. Keep the module registered so the
// admin panel still lists it, but return no servers until the upstream recovers.
// VidLink, VidFast, VidNest and AutoEmbed cover this provider's slot.
export default {
  id: 'vidsrc',
  name: 'VidSrc',
  kind: 'embed',
  getStreams() {
    return [];
  },
};
