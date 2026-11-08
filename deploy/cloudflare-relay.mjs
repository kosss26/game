// Two isolated bot routes. Existing Battleship binding names and /webhook stay valid.
// New bindings: STORIES_BOT_ID, STORIES_ORIGIN_WEBHOOK (Variables),
// STORIES_RELAY_SECRET, STORIES_WEBHOOK_SECRET (Secrets). Never paste bot tokens here.
export default {
  // Мониторинг «Полночи»: Triggers → Cron Triggers → «*/5 * * * *». Настройка — deploy/HOSTKEY.md
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env, { now: event.scheduledTime }));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p === '/stories/monitor-test') {
      if (!env.MONITOR_SECRET || req.headers.get('X-Monitor-Secret') !== env.MONITOR_SECRET) return new Response('forbidden', { status: 403 });
      const result = await runMonitor(env, { now: Date.now(), force: true });
      return new Response(JSON.stringify(result, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
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
        method: 'POST', redirect: 'manual',
        body: await req.arrayBuffer(),
        headers: {
          'Content-Type': req.headers.get('Content-Type') || 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': incoming.secret,
        },
      });
      if (r.status >= 300 && r.status < 400) return new Response('upstream redirect rejected', { status: 502 });
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
        method: req.method, headers: h, redirect: 'manual',
        body: hasBody ? await req.arrayBuffer() : undefined,
      });
      if (r.status >= 300 && r.status < 400) return new Response('upstream redirect rejected', { status: 502 });
      const oh = new Headers();
      const ct = r.headers.get('content-type');
      if (ct) oh.set('content-type', ct);
      return new Response(r.body, { status: r.status, headers: oh });
    }
    return new Response('not found', { status: 404 });
  },
};

// ---------------------------------------------------------------------------
// Мониторинг. Переменные: MONITOR_URL (https://домен/api/monitor), ALERT_CHAT_ID;
// секреты: MONITOR_SECRET, ALERT_BOT_TOKEN (отдельный бот для оповещений, не бот историй).
// Необязательно: KV-привязка MONITOR_STATE — тогда оповещения без повторов и с «восстановлено».
// ---------------------------------------------------------------------------
const DOWN_CONFIRM = 2;           // «сайт не отвечает» — только после двух неудачных проверок подряд
const REMIND_MS = 60 * 60_000;    // напоминание о неустранённой проблеме — раз в час
const ERROR_QUIET_MS = 6 * 3600_000; // одна и та же ошибка — не чаще раза в 6 часов

export async function fetchReport(env, fetchImpl = fetch) {
  const windowMin = Number(env.MONITOR_WINDOW || 5);
  try {
    const r = await fetchImpl(`${env.MONITOR_URL}?window=${windowMin}`, {
      headers: { Authorization: `Bearer ${env.MONITOR_SECRET}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (r.status === 401 || r.status === 404) return { reachable: true, misconfigured: `сервер ответил ${r.status}: проверьте MONITOR_SECRET на сервере и в Cloudflare` };
    if (!r.ok) return { reachable: false, reason: `HTTP ${r.status}` };
    return { reachable: true, data: await r.json() };
  } catch (e) {
    return { reachable: false, reason: e && e.name === 'TimeoutError' ? 'нет ответа за 15 с' : String(e && e.message || e).slice(0, 200) };
  }
}

/** Список текущих проблем: [{ key, text }] */
export function describeProblems(report) {
  if (!report.reachable) return [{ key: 'down', text: `Сайт не отвечает (${report.reason})` }];
  if (report.misconfigured) return [{ key: 'config', text: `Мониторинг не настроен: ${report.misconfigured}` }];
  const c = (report.data && report.data.checks) || {};
  const out = [];
  if (c.db && !c.db.ok) out.push({ key: 'db', text: `База данных недоступна: ${c.db.error || 'ошибка'}` });
  if (c.telegram && !c.telegram.ok) out.push({ key: 'telegram', text: `Сервер не достучался до Telegram через посредника: ${c.telegram.error || 'ошибка'}` });
  const w = c.webhook;
  if (w && !w.ok && c.telegram && c.telegram.ok) {
    if (w.error) out.push({ key: 'webhook', text: `Вебхук бота: ${w.error}` });
    else if (w.lastError) out.push({ key: 'webhook', text: `Telegram не может доставить сообщения боту: ${w.lastError}` });
    else out.push({ key: 'webhook', text: `Бот не успевает: ${w.pending} необработанных сообщений` });
  }
  return out;
}

/** Решение, что отправить, с учётом прошлого состояния. Чистая функция — покрыта тестами. */
export function decide(report, prev, now, opts = {}) {
  const state = { problems: { ...((prev && prev.problems) || {}) }, fails: (prev && prev.fails) || 0, lastAlert: (prev && prev.lastAlert) || 0, errors: { ...((prev && prev.errors) || {}) } };
  state.fails = report.reachable ? 0 : state.fails + 1;
  let problems = describeProblems(report);
  if (!report.reachable && state.fails < DOWN_CONFIRM && !state.problems.down) problems = []; // одиночный сбой сети — ждём следующую проверку
  const keys = new Set(problems.map(p => p.key));
  const fresh = problems.filter(p => !state.problems[p.key]);
  const resolved = Object.entries(state.problems).filter(([k]) => !keys.has(k)).filter(() => report.reachable);
  const lines = [];
  if (fresh.length) lines.push('🔴 Полночь: проблема', ...fresh.map(p => `• ${p.text}`));
  else if (problems.length && (opts.force || now - state.lastAlert >= REMIND_MS)) lines.push('🔴 Полночь: проблема не устранена', ...problems.map(p => `• ${p.text} (с ${hm(state.problems[p.key] && state.problems[p.key].since || now)})`));
  for (const [k, v] of resolved) lines.push(`✅ Восстановлено: ${v.text} — длилось ${Math.max(1, Math.round((now - v.since) / 60_000))} мин`);
  for (const p of problems) if (!state.problems[p.key]) state.problems[p.key] = { since: now, text: p.text };
  for (const [k] of resolved) delete state.problems[k];

  const top = (report.data && report.data.errors && report.data.errors.top) || [];
  const newErrors = top.filter(e => opts.force || !state.errors[e.fingerprint] || now - state.errors[e.fingerprint] > ERROR_QUIET_MS);
  if (newErrors.length) {
    lines.push(`⚠️ Ошибки за ${report.data.errors.windowMinutes} мин: ${report.data.errors.total}`);
    for (const e of newErrors.slice(0, 3)) lines.push(`• [${e.source === 'client' ? 'у игрока' : 'сервер'}] ${e.message} ×${e.count}${e.where ? ` — ${e.where}` : ''}`);
    for (const e of newErrors) state.errors[e.fingerprint] = now;
  }
  for (const [fp, t] of Object.entries(state.errors)) if (now - t > ERROR_QUIET_MS) delete state.errors[fp];
  if (opts.force && !lines.length) lines.push(`✅ Полночь: всё работает${report.data && report.data.checks && report.data.checks.telegram ? ` (Telegram ${report.data.checks.telegram.ms} мс)` : ''}`);
  if (lines.length) state.lastAlert = now;
  return { message: lines.length ? lines.join('\n').slice(0, 3900) : null, state };
}

function hm(ts) {
  const d = new Date(ts + 3 * 3600_000); // время в Москве
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} МСК`;
}

async function runMonitor(env, { now, force = false }) {
  if (!env.MONITOR_URL || !env.MONITOR_SECRET || !env.ALERT_BOT_TOKEN || !env.ALERT_CHAT_ID) return { skipped: 'не заданы MONITOR_URL / MONITOR_SECRET / ALERT_BOT_TOKEN / ALERT_CHAT_ID' };
  const kv = env.MONITOR_STATE;
  const prev = kv ? JSON.parse((await kv.get('state')) || 'null') : null;
  const report = await fetchReport(env);
  let { message, state } = decide(report, prev, now, { force });
  // Без KV состояние не сохраняется: напоминаем о проблемах дважды в час, а не каждые 5 минут
  if (!kv && !force && message && !/Ошибки за/.test(message)) {
    const minute = new Date(now).getUTCMinutes();
    if (minute % 30 >= 5) message = null;
  }
  let sent = false;
  if (message) {
    const r = await fetch(`https://api.telegram.org/bot${env.ALERT_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.ALERT_CHAT_ID, text: message, disable_web_page_preview: true }),
    });
    sent = r.ok;
  }
  if (kv) await kv.put('state', JSON.stringify(state));
  return { ok: !!report.data && report.data.ok, sent, message };
}

