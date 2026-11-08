// node --test deploy/cloudflare-relay.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, describeProblems, fetchReport } from './cloudflare-relay.mjs';

const T0 = Date.UTC(2026, 10, 8, 12, 0);
const MIN = 60_000;
const healthy = { reachable: true, data: { ok: true, checks: { db: { ok: true }, telegram: { ok: true, ms: 120 }, webhook: { ok: true, pending: 0 } }, errors: { windowMinutes: 5, total: 0, top: [] } } };
const dbDown = { reachable: true, data: { ok: false, checks: { db: { ok: false, error: 'connection refused' }, telegram: { ok: true }, webhook: { ok: true } }, errors: { windowMinutes: 5, total: 0, top: [] } } };
const down = { reachable: false, reason: 'HTTP 502' };

test('всё в порядке — молчим', () => {
  assert.equal(decide(healthy, null, T0).message, null);
});

test('одиночный сбой сети не будит, второй подряд — будит', () => {
  const a = decide(down, null, T0);
  assert.equal(a.message, null);
  const b = decide(down, a.state, T0 + 5 * MIN);
  assert.match(b.message, /Сайт не отвечает/);
});

test('проблема: сразу, потом тишина, через час напоминание, затем «восстановлено»', () => {
  const a = decide(dbDown, null, T0);
  assert.match(a.message, /База данных недоступна/);
  const b = decide(dbDown, a.state, T0 + 5 * MIN);
  assert.equal(b.message, null);
  const c = decide(dbDown, b.state, T0 + 61 * MIN);
  assert.match(c.message, /не устранена/);
  const d = decide(healthy, c.state, T0 + 70 * MIN);
  assert.match(d.message, /Восстановлено: База данных недоступна.*длилось 70 мин/);
  assert.deepEqual(d.state.problems, {});
});

test('пока сайт недоступен, прошлые проблемы не считаются решёнными', () => {
  const a = decide(dbDown, null, T0);
  const b = decide(down, a.state, T0 + 5 * MIN);
  assert.ok(!/Восстановлено/.test(b.message || ''));
});

test('ошибки: сообщаем один раз на отпечаток в 6 часов', () => {
  const withErr = { ...healthy, data: { ...healthy.data, errors: { windowMinutes: 5, total: 3, top: [{ fingerprint: 'f1', source: 'client', message: 'TypeError: x', count: 3, where: '/play/1' }] } } };
  const a = decide(withErr, null, T0);
  assert.match(a.message, /Ошибки за 5 мин: 3[\s\S]*у игрока.*TypeError: x ×3 — \/play\/1/);
  assert.equal(decide(withErr, a.state, T0 + 5 * MIN).message, null);
  assert.match(decide(withErr, a.state, T0 + 7 * 3600_000).message, /TypeError/);
});

test('проверка вручную всегда отвечает', () => {
  assert.match(decide(healthy, null, T0, { force: true }).message, /всё работает \(Telegram 120 мс\)/);
});

test('вебхук: ошибка доставки и очередь', () => {
  const r = (webhook) => describeProblems({ reachable: true, data: { checks: { db: { ok: true }, telegram: { ok: true }, webhook } } });
  assert.match(r({ ok: false, lastError: 'Wrong response from the webhook: 502' })[0].text, /не может доставить.*502/);
  assert.match(r({ ok: false, pending: 120 })[0].text, /120 необработанных/);
});

test('сервер отвечает 401 — понятная подсказка про секрет', async () => {
  const rep = await fetchReport({ MONITOR_URL: 'https://x/api/monitor', MONITOR_SECRET: 's' }, async () => new Response('', { status: 401 }));
  assert.match(describeProblems(rep)[0].text, /MONITOR_SECRET/);
});
