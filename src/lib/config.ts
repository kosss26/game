import "server-only";
import crypto from "crypto";

/** Серверная конфигурация из переменных окружения */
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  botUsername: (process.env.NEXT_PUBLIC_BOT_USERNAME || "").replace(/^@/, ""),
  appShortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, ""),
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
  defaultWaitHours: parseFloat(process.env.DEFAULT_WAIT_HOURS || "12"),
};

/** Используется ли локальная демо-база вместо Supabase */
export function isLocalDb(): boolean {
  return !config.supabaseUrl || !config.supabaseServiceKey || process.env.DATA_SOURCE === "local";
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
