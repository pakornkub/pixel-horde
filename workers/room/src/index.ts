// Cloudflare Worker + one Durable Object per co-op room (PartyServer). Built in ticket 41.
export default {
  async fetch(): Promise<Response> {
    return new Response('pixel-horde room worker: not implemented yet', { status: 501 });
  },
};
