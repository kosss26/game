// Run against workerd, not a Node fetch mock. See deploy/HOSTKEY.md for setup.
const assert = require('node:assert/strict');
const path = require('node:path');
const { Miniflare } = require(process.env.MINIFLARE_MODULE || 'miniflare');
(async () => {
  let redirect = false;
  const seen = [];
  const mf = new Miniflare({
    modules: true,
    compatibilityDate: '2025-11-01',
    scriptPath: path.resolve(__dirname, '../deploy/cloudflare-relay.mjs'),
    bindings: {
      BOT_ID: '111', RELAY_SECRET: 'old-key', WEBHOOK_SECRET: 'old-hook', ORIGIN_WEBHOOK: 'https://old.invalid/webhook',
      STORIES_BOT_ID: '222', STORIES_RELAY_SECRET: 'new-key', STORIES_WEBHOOK_SECRET: 'new-hook', STORIES_ORIGIN_WEBHOOK: 'https://stories.invalid/webhook',
    },
    outboundService: async request => {
      seen.push({ url: request.url, relayHeader: request.headers.get('X-Relay-Secret'), hookHeader: request.headers.get('X-Telegram-Bot-Api-Secret-Token'), body: await request.text() });
      return redirect ? new Response(null, {status: 302, headers: {Location: 'https://untrusted.invalid/'}}) : Response.json({ok: true});
    },
  });
  let cases = 0;
  try {
    for (const [id, key] of [['111', 'old-key'], ['222', 'new-key']]) {
      const response = await mf.dispatchFetch(`https://relay.invalid/bot${id}:fixture/getMe`, {method: 'POST', headers: {'X-Relay-Secret': key, 'Content-Type': 'application/json', 'Content-Length': '2'}, body: '{}'});
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {ok: true});
      assert.equal(seen.at(-1).url, `https://api.telegram.org/bot${id}:fixture/getMe`);
      assert.equal(seen.at(-1).body, '{}');
      assert.equal(seen.at(-1).relayHeader, null);
      cases++;
    }
    for (const [route, secret, origin] of [['/webhook', 'old-hook', 'https://old.invalid/webhook'], ['/stories/webhook', 'new-hook', 'https://stories.invalid/webhook']]) {
      const response = await mf.dispatchFetch('https://relay.invalid' + route, {method: 'POST', headers: {'X-Telegram-Bot-Api-Secret-Token': secret}, body: '{}'});
      assert.equal(response.status, 200);
      assert.equal(seen.at(-1).url, origin);
      assert.equal(seen.at(-1).hookHeader, secret);
      cases++;
    }
    for (const [route, headers] of [['/bot111:fixture/getMe', {'X-Relay-Secret': 'new-key'}], ['/bot222:fixture/getMe', {'X-Relay-Secret': 'old-key'}], ['/webhook', {'X-Telegram-Bot-Api-Secret-Token': 'new-hook'}], ['/stories/webhook', {'X-Telegram-Bot-Api-Secret-Token': 'old-hook'}]]) {
      const count = seen.length;
      const response = await mf.dispatchFetch('https://relay.invalid' + route, {method: 'POST', headers, body: '{}'});
      assert.equal(response.status, 403);
      assert.equal(seen.length, count);
      cases++;
    }
    redirect = true;
    for (const [route, headers] of [['/bot111:fixture/getMe', {'X-Relay-Secret': 'old-key'}], ['/bot222:fixture/getMe', {'X-Relay-Secret': 'new-key'}], ['/webhook', {'X-Telegram-Bot-Api-Secret-Token': 'old-hook'}], ['/stories/webhook', {'X-Telegram-Bot-Api-Secret-Token': 'new-hook'}]]) {
      const count = seen.length;
      const response = await mf.dispatchFetch('https://relay.invalid' + route, {method: 'POST', headers, body: '{}'});
      assert.equal(response.status, 502);
      assert.equal(seen.length, count + 1);
      assert.equal(await response.text(), 'upstream redirect rejected');
      cases++;
    }
    console.log(`workerd: ${cases} cases passed (both bots, both webhooks, isolated secrets, rejected redirects)`);
  } finally {
    await mf.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
