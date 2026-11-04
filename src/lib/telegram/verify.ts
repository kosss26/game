import "server-only";
import crypto from "crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
  allows_write_to_pm?: boolean;
}

export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  start_param?: string;
  auth_date: number;
  hash: string;
}

/** Максимальный возраст initData (сек). Telegram выдаёт свежие данные при каждом открытии. */
const MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Проверка Telegram WebApp initData (HMAC-SHA256)
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramWebAppData(
  initData: string,
  botToken: string | undefined = process.env.TELEGRAM_BOT_TOKEN,
  now: number = Date.now()
): TelegramInitData | null {
  if (!botToken || !initData || initData.length > 8192) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest();
    const given = Buffer.from(hash, "hex");
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

    const authDate = parseInt(params.get("auth_date") || "0", 10);
    if (!authDate || now / 1000 - authDate > MAX_AGE_SECONDS) return null;

    const userRaw = params.get("user");
    const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : undefined;
    if (user && (typeof user.id !== "number" || !user.first_name)) return null;

    return {
      query_id: params.get("query_id") || undefined,
      user,
      start_param: params.get("start_param") || undefined,
      auth_date: authDate,
      hash,
    };
  } catch {
    return null;
  }
}
