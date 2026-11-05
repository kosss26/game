import "server-only";
import crypto from "crypto";

/**
 * Чтение переменной в рантайме. Динамический доступ не даёт Next.js «вшить»
 * значение при сборке — один Docker-образ работает с любым .env.
 * Поддерживаются и старые имена NEXT_PUBLIC_*.
 */
function env(name: string): string {
  const e = process.env as Record<string, string | undefined>;
  return e[name] || e[`NEXT_PUBLIC_${name}`] || "";
}

/** Серверная конфигурация из переменных окружения */
export const config = {
  supabaseUrl: env("SUPABASE_URL"),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  /** Адрес Bot API (можно указать свой relay/прокси, если api.telegram.org недоступен с сервера) */
  get telegramApiUrl() {
    return (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/$/, "");
  },
  botUsername: env("BOT_USERNAME").replace(/^@/, ""),
  appShortName: env("APP_SHORT_NAME"),
  appUrl: env("APP_URL").replace(/\/$/, ""),
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  cronSecret: process.env.CRON_SECRET || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(/[,\s]+/)
    .map(s => parseInt(s, 10))
    .filter(n => Number.isFinite(n)),
  allowWebGuests: process.env.ALLOW_WEB_GUESTS === "true" || process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",
  prices: {
    skipDay: parseInt(process.env.PRICE_SKIP_DAY_STARS || "15", 10),
    seasonPass: parseInt(process.env.PRICE_SEASON_PASS_STARS || "99", 10),
  },
  referralBonus: parseInt(process.env.REFERRAL_BONUS_SKIPS || "1", 10),
  /**
   * Бесплатный режим: все главы открываются сразу, без ожидания и оплаты.
   * Сейчас включён по умолчанию; выключить — FREE_ACCESS=false в файле настроек.
   */
  freeAccess: process.env.FREE_ACCESS !== "false",
  defaultWaitHours: parseFloat(process.env.DEFAULT_WAIT_HOURS || "12"),
};

export type DbKind = "postgres" | "supabase" | "local";

/**
 * Источник данных. Приоритет: DATA_SOURCE (явно) → DATABASE_URL (свой Postgres)
 * → Supabase → локальная демо-база.
 */
export function dbKind(): DbKind {
  const forced = process.env.DATA_SOURCE;
  if (forced === "local" || forced === "postgres" || forced === "supabase") return forced;
  if (process.env.DATABASE_URL) return "postgres";
  if (config.supabaseUrl && config.supabaseServiceKey) return "supabase";
  return "local";
}

/** Используется ли локальная демо-база */
export function isLocalDb(): boolean {
  return dbKind() === "local";
}

let cachedSecret: Buffer | null = null;

/** Секрет для подписи сессий */
export function sessionSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.length >= 16) {
    cachedSecret = crypto.createHash("sha256").update(explicit).digest();
  } else if (config.botToken) {
    cachedSecret = crypto.createHash("sha256").update(`session:${config.botToken}`).digest();
  } else if (!config.isProduction) {
    cachedSecret = crypto.createHash("sha256").update("dev-only-session-secret").digest();
  } else {
    throw new Error("SESSION_SECRET или TELEGRAM_BOT_TOKEN должны быть заданы в production");
  }
  return cachedSecret;
}
