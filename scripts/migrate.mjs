/**
 * Применяет supabase/schema.sql к DATABASE_URL. Схема идемпотентна —
 * безопасно запускать при каждом старте. Без зависимостей, кроме pg.
 *   node scripts/migrate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = process.env.SCHEMA_PATH || path.join(here, "..", "supabase", "schema.sql");

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL не задан — пропуск");
  process.exit(0);
}

const client = new pg.Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_STRICT !== "false" } : undefined,
});

// База в docker может подниматься дольше приложения
for (let attempt = 1; ; attempt++) {
  try {
    await client.connect();
    break;
  } catch (e) {
    if (attempt >= 30) {
      console.error("[migrate] не удалось подключиться:", e.message);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

try {
  await client.query("SELECT pg_advisory_lock(727001)");
  await client.query("SET client_min_messages TO WARNING");
  await client.query(fs.readFileSync(schemaPath, "utf8"));
  console.log("[migrate] схема применена");
} catch (e) {
  console.error("[migrate] ошибка:", e.message);
  process.exitCode = 1;
} finally {
  await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
  await client.end();
}
