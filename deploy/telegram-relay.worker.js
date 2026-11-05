// Cloudflare Worker: relay to api.telegram.org for ONE bot only.
// Put your bot's numeric ID (the part of the token before ":") into BOT_ID.
// Requests for any other bot get 404, so the relay can't be used as an open proxy.
const BOT_ID = "PASTE_BOT_ID";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/bot(\d+):[A-Za-z0-9_-]+\/[A-Za-z]+$/);
    if (!m || m[1] !== BOT_ID) return new Response("not found", { status: 404 });
    const headers = new Headers();
    const type = request.headers.get("content-type");
    if (type) headers.set("content-type", type);
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    return fetch("https://api.telegram.org" + url.pathname + url.search, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
  },
};
