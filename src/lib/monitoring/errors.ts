import "server-only";
import { db } from "@/lib/supabase/server";
import { normalizeError, type RawError } from "./normalize";

/** Одну и ту же ошибку пишем в базу не чаще раза в 10 секунд на процесс */
const THROTTLE_MS = 10_000;
const recent = new Map<string, number>();
const KEEP_DAYS = 14;

export interface ErrorRow {
  source: string;
  fingerprint: string;
  message: string;
  detail: Record<string, string>;
  count: number;
  first_at: string;
  last_at: string;
}

/** Записать ошибку в журнал. Никогда не бросает: журнал не должен ронять приложение. */
export async function recordError(raw: RawError): Promise<void> {
  try {
    const e = normalizeError(raw);
    if (!e) return;
    const now = Date.now();
    if ((recent.get(e.fingerprint) || 0) > now - THROTTLE_MS) return;
    recent.set(e.fingerprint, now);
    if (recent.size > 500) recent.clear();
    const supabase = await db();
    const at = new Date(now).toISOString();
    const { data } = await supabase.from("error_events").select("count").eq("fingerprint", e.fingerprint).maybeSingle();
    if (data) {
      await supabase.from("error_events").update({ count: Number(data.count || 0) + 1, last_at: at, message: e.message, detail: e.detail }).eq("fingerprint", e.fingerprint);
    } else {
      const { error } = await supabase.from("error_events").insert({ source: e.source, fingerprint: e.fingerprint, message: e.message, detail: e.detail, count: 1, first_at: at, last_at: at });
      // Параллельная запись той же ошибки — просто увеличим счётчик
      if (error) await supabase.from("error_events").update({ last_at: at }).eq("fingerprint", e.fingerprint);
    }
  } catch (err) {
    console.error("[errors] не удалось записать ошибку", err);
  }
}

/** Ошибки, случавшиеся за последние `minutes` минут (сначала свежие) */
export async function recentErrors(minutes: number, limit = 20): Promise<ErrorRow[]> {
  const supabase = await db();
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data } = await supabase.from("error_events").select("*").gte("last_at", since).order("last_at", { ascending: false }).limit(limit);
  return (data || []) as ErrorRow[];
}

/** Удалить записи старше двух недель */
export async function pruneErrors(): Promise<void> {
  try {
    const supabase = await db();
    await supabase.from("error_events").delete().lt("last_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  } catch {
    /* не критично */
  }
}
