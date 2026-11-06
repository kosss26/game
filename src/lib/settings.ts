import "server-only";
import { db } from "@/lib/supabase/server";

/**
 * Настройки приложения, которые меняются из студии без перезапуска.
 * Значение кэшируется на несколько секунд, чтобы не ходить в базу на каждый запрос.
 */
const FREE_KEY = "free_access";
const TTL_MS = 5_000;
let cache: { value: boolean; at: number } | null = null;

/** FREE_ACCESS=true в файле настроек включает бесплатный режим принудительно — студия его не выключит */
export function freeAccessForcedByEnv(): boolean {
  return process.env.FREE_ACCESS === "true";
}

/** Бесплатный режим для всех: все истории без ожидания и оплаты */
export async function isGlobalFree(): Promise<boolean> {
  if (freeAccessForcedByEnv()) return true;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = false;
  try {
    const supabase = await db();
    const { data } = await supabase.from("app_settings").select("value").eq("key", FREE_KEY).maybeSingle();
    value = !!(data?.value as { enabled?: boolean } | undefined)?.enabled;
  } catch {
    value = false;
  }
  cache = { value, at: Date.now() };
  return value;
}

export async function getFreeSetting(): Promise<{ enabled: boolean; forced: boolean; updatedAt: string | null }> {
  const supabase = await db();
  const { data } = await supabase.from("app_settings").select("value, updated_at").eq("key", FREE_KEY).maybeSingle();
  return {
    enabled: freeAccessForcedByEnv() || !!(data?.value as { enabled?: boolean } | undefined)?.enabled,
    forced: freeAccessForcedByEnv(),
    updatedAt: (data?.updated_at as string | undefined) || null,
  };
}

export async function writeGlobalFree(enabled: boolean): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: FREE_KEY, value: { enabled }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  cache = { value: enabled, at: Date.now() };
}
