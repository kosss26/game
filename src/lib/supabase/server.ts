import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, dbKind } from "@/lib/config";
import { createLocalClient } from "@/lib/db/local";
import { createPostgresClient } from "@/lib/db/postgres";

let client: SupabaseClient | null = null;

/**
 * Серверный клиент БД. В зависимости от окружения:
 *  - DATABASE_URL — собственный PostgreSQL (рекомендуется для своего сервера);
 *  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — Supabase;
 *  - иначе — локальная демо-база .data/local-db.json (только разработка).
 * Все варианты имеют одинаковый интерфейс запросов.
 */
export async function createAdminSupabaseClient(): Promise<SupabaseClient> {
  if (client) return client;
  const kind = dbKind();
  if (kind === "postgres") {
    client = createPostgresClient() as unknown as SupabaseClient;
  } else if (kind === "supabase") {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    if (config.isProduction && process.env.DATA_SOURCE !== "local") {
      throw new Error("База данных не настроена: задайте DATABASE_URL (или переменные Supabase)");
    }
    client = createLocalClient() as unknown as SupabaseClient;
  }
  return client;
}

/** Синоним для читаемости */
export const db = createAdminSupabaseClient;
