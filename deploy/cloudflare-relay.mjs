// Two isolated bot routes. Existing Battleship binding names and /webhook stay valid.
// New bindings: STORIES_BOT_ID, STORIES_ORIGIN_WEBHOOK (Variables),
// STORIES_RELAY_SECRET, STORIES_WEBHOOK_SECRET (Secrets). Never paste bot tokens here.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    let incoming;
    if (p === '/webhook') incoming = { secret: env.WEBHOOK_SECRET, origin: env.ORIGIN_WEBHOOK };
    if (p === '/stories/webhook') incoming = { secret: env.STORIES_WEBHOOK_SECRET, origin: env.STORIES_ORIGIN_WEBHOOK };
    if (incoming) {
      if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
      if (!incoming.secret || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== incoming.secret) {
        return new Response('forbidden', { status: 403 });
      }
      if (!incoming.origin) return new Response('webhook not configured', { status: 503 });
      const origin = new URL(incoming.origin);
      if (origin.protocol !== 'https:' || origin.username || origin.password) return new Response('invalid origin', { status: 503 });
      const r = await fetch(origin.toString(), {
        method: 'POST', redirect: 'error',
        body: await req.arrayBuffer(),
        headers: {
          'Content-Type': req.headers.get('Content-Type') || 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': incoming.secret,
        },
      });
      return new Response(await r.text(), { status: r.status });
    }
    const oldBot = env.BOT_ID && p.startsWith('/bot' + env.BOT_ID + ':');
    const storiesBot = !oldBot && env.STORIES_BOT_ID && p.startsWith('/bot' + env.STORIES_BOT_ID + ':');
    if ((oldBot || storiesBot) && !p.includes('..')) {
      const secret = oldBot ? env.RELAY_SECRET : env.STORIES_RELAY_SECRET;
      if (!secret || req.headers.get('X-Relay-Secret') !== secret) return new Response('forbidden', { status: 403 });
      const h = new Headers();
      for (const k of ['content-type', 'accept', 'content-length']) {
        const v = req.headers.get(k);
        if (v) h.set(k, v);
      }
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const r = await fetch('https://api.telegram.org' + p + url.search, {
        method: req.method, headers: h, redirect: 'error',
        body: hasBody ? await req.arrayBuffer() : undefined,
      });
      const oh = new Headers();
      const ct = r.headers.get('content-type');
      if (ct) oh.set('content-type', ct);
      return new Response(r.body, { status: r.status, headers: oh });
    }
    return new Response('not found', { status: 404 });
  },
};
