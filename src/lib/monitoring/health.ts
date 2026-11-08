import "server-only";
import { db } from "@/lib/supabase/server";
import { callBot } from "@/lib/telegram/bot";
import { config } from "@/lib/config";
import { recentErrors, pruneErrors } from "./errors";

export interface MonitorReport {
  ok: boolean;
  checkedAt: string;
  version: string | null;
  checks: {
    db: { ok: boolean; ms: number; error?: string };
    telegram: { ok: boolean; ms: number; error?: string };
    webhook: { ok: boolean; pending?: number; lastError?: string; lastErrorAt?: string; error?: string };
  };
  errors: { windowMinutes: number; total: number; top: Array<{ source: string; message: string; count: number; lastAt: string; fingerprint: string; where?: string }> };
}

const TIMEOUT_MS = 8_000;
/** Ошибка доставки вебхука считается свежей, если ей меньше 15 минут */
const WEBHOOK_ERROR_FRESH_S = 15 * 60;
const PENDING_LIMIT = 50;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}: нет ответа за ${TIMEOUT_MS / 1000} с`)), TIMEOUT_MS))]);
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { ms: Date.now() - start, value };
  } catch (e) {
    return { ms: Date.now() - start, error: msg(e) };
  }
}

type WebhookInfo = { url?: string; pending_update_count?: number; last_error_date?: number; last_error_message?: string };

/** Полная проверка: база, путь до Telegram через посредника, доставка вебхука, свежие ошибки */
export async function monitorReport(windowMinutes: number): Promise<MonitorReport> {
  const dbCheck = await timed(() => withTimeout((async () => {
    const supabase = await db();
    const { error } = await supabase.from("stories").select("id").limit(1);
    if (error) throw new Error(error.message);
  })(), "база"));

  const tg = config.botToken
    ? await timed(() => withTimeout(callBot<WebhookInfo>("getWebhookInfo"), "Telegram"))
    : { ms: 0, error: "TELEGRAM_BOT_TOKEN не задан" };

  const info = tg.value;
  const now = Math.floor(Date.now() / 1000);
  const freshError = info?.last_error_date && now - info.last_error_date < WEBHOOK_ERROR_FRESH_S ? info.last_error_message || "ошибка доставки" : undefined;
  const webhook: MonitorReport["checks"]["webhook"] = !info
    ? { ok: false, error: "нет данных: Telegram недоступен" }
    : !info.url
      ? { ok: false, error: "вебхук не установлен", pending: info.pending_update_count }
      : {
        ok: !freshError && (info.pending_update_count || 0) < PENDING_LIMIT,
        pending: info.pending_update_count || 0,
        ...(freshError ? { lastError: freshError, lastErrorAt: new Date(info.last_error_date! * 1000).toISOString() } : {}),
      };

  let errors: MonitorReport["errors"] = { windowMinutes, total: 0, top: [] };
  if (!dbCheck.error) {
    const rows = await recentErrors(windowMinutes).catch(() => []);
    errors = {
      windowMinutes,
      total: rows.reduce((n, r) => n + (r.count || 1), 0),
      top: rows.slice(0, 5).map(r => ({ source: r.source, message: r.message, count: r.count, lastAt: r.last_at, fingerprint: r.fingerprint, where: r.detail?.route || r.detail?.url })),
    };
    void pruneErrors();
  }

  const checks: MonitorReport["checks"] = {
    db: { ok: !dbCheck.error, ms: dbCheck.ms, ...(dbCheck.error ? { error: dbCheck.error } : {}) },
    telegram: { ok: !tg.error, ms: tg.ms, ...(tg.error ? { error: tg.error } : {}) },
    webhook,
  };
  return {
    ok: checks.db.ok && checks.telegram.ok && checks.webhook.ok,
    checkedAt: new Date().toISOString(),
    version: process.env.APP_VERSION || null,
    checks,
    errors,
  };
}
