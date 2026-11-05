import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../deploy/cloudflare-relay.mjs';
const env = { BOT_ID:'111', RELAY_SECRET:'old-relay', WEBHOOK_SECRET:'old-webhook', ORIGIN_WEBHOOK:'https://old.invalid/webhook', STORIES_BOT_ID:'222', STORIES_RELAY_SECRET:'new-relay', STORIES_WEBHOOK_SECRET:'new-webhook', STORIES_ORIGIN_WEBHOOK:'https://stories.invalid/api/telegram/webhook' };
const originalFetch=globalThis.fetch;
async function route(path, headers={}, options={}) {
 return worker.fetch(new Request('https://relay.invalid'+path,{method:'POST',body:'{"fixture":true}',headers,...options}),env);
}
test('each bot keeps its own outgoing secret, token and body',async()=>{
 const calls=[]; globalThis.fetch=async(url,init)=>{calls.push({url,init});return new Response('{"ok":true}',{headers:{'content-type':'application/json'}})};
 try {
  for(const [id,secret] of [['111','old-relay'],['222','new-relay']]) {
   const r=await route(`/bot${id}:fixture/getMe`,{'X-Relay-Secret':secret,'Content-Type':'application/json'});
   assert.equal(r.status,200);const call=calls.at(-1);
   assert.equal(call.url,`https://api.telegram.org/bot${id}:fixture/getMe`);
   assert.equal(call.init.headers.get('X-Relay-Secret'),null);
   assert.equal(new TextDecoder().decode(call.init.body),'{"fixture":true}');
  }
  const n=calls.length;
  for(const [id,secret] of [['111','new-relay'],['222','old-relay']]) assert.equal((await route(`/bot${id}:fixture/getMe`,{'X-Relay-Secret':secret})).status,403);
  assert.equal(calls.length,n);
 } finally {globalThis.fetch=originalFetch}
});
test('old and new webhooks verify independently and forward to their own origins',async()=>{
 const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,init});return new Response('ok')};
 try {
  for(const [path,secret,origin] of [['/webhook','old-webhook',env.ORIGIN_WEBHOOK],['/stories/webhook','new-webhook',env.STORIES_ORIGIN_WEBHOOK]]) {
   assert.equal((await route(path,{'X-Telegram-Bot-Api-Secret-Token':secret})).status,200);
   assert.equal(calls.at(-1).url,origin);
   assert.equal(calls.at(-1).init.headers['X-Telegram-Bot-Api-Secret-Token'],secret);
  }
  const n=calls.length;
  assert.equal((await route('/webhook',{'X-Telegram-Bot-Api-Secret-Token':'new-webhook'})).status,403);
  assert.equal((await route('/stories/webhook',{'X-Telegram-Bot-Api-Secret-Token':'old-webhook'})).status,403);
  assert.equal((await route('/stories/webhook',{}, {method:'GET',body:undefined})).status,405);
  assert.equal(calls.length,n);
 } finally {globalThis.fetch=originalFetch}
});
test('missing new bindings and duplicate bot IDs cannot change old bot authorization',async()=>{
 globalThis.fetch=async()=>new Response('ok');
 try {
  const req=()=>new Request('https://relay.invalid/bot111:fixture/getMe',{headers:{'X-Relay-Secret':'old-relay'}});
  assert.equal((await worker.fetch(req(),{BOT_ID:env.BOT_ID,RELAY_SECRET:env.RELAY_SECRET})).status,200);
  assert.equal((await worker.fetch(req(),{...env,STORIES_BOT_ID:'111'})).status,200);
  assert.equal((await worker.fetch(new Request('https://relay.invalid/bot111:fixture/getMe',{headers:{'X-Relay-Secret':'new-relay'}}),{...env,STORIES_BOT_ID:'111'})).status,403);
  assert.equal((await route('/bot333:fixture/getMe',{'X-Relay-Secret':'new-relay'})).status,404);
 } finally {globalThis.fetch=originalFetch}
});
