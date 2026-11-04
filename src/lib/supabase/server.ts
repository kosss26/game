import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isLocalDb } from "@/lib/config";
import { createLocalClient } from "@/lib/db/local";

let client: SupabaseClient | null = null;

/**
 * Серверный клиент БД с правами service role.
 * Без настроек Supabase используется локальная демо-база (.data/local-db.json).
 */
export async function createAdminSupabaseClient(): Promise<SupabaseClient> {
  if (isLocalDb()) {
    if (config.isProduction && process.env.DATA_SOURCE !== "local") {
      throw new Error("Supabase не настроен: задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
    }
    return createLocalClient() as unknown as SupabaseClient;
  }
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Синоним для читаемости */
export const db = createAdminSupabaseClient;
