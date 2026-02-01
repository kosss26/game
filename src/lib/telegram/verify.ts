import crypto from "crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  [key: string]: unknown;
}

/**
 * Verify Telegram WebApp initData using HMAC-SHA256
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramWebAppData(initData: string): TelegramInitData | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return null;
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    
    if (!hash) {
      console.error("No hash in initData");
      return null;
    }

    // Remove hash from params for verification
    urlParams.delete("hash");

    // Sort parameters alphabetically and create data-check-string
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Create secret key: HMAC_SHA256(bot_token, "WebAppData")
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Calculate expected hash: HMAC_SHA256(data_check_string, secret_key)
    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (hash !== expectedHash) {
      console.error("Hash verification failed");
      return null;
    }

    // Check auth_date is not too old (allow 24 hours for development, 1 hour for production)
    const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
    const maxAge = process.env.NODE_ENV === "development" ? 86400 : 3600;
    const now = Math.floor(Date.now() / 1000);
    
    if (now - authDate > maxAge) {
      console.error("Auth date is too old");
      return null;
    }

    // Parse user data
    const userString = urlParams.get("user");
    const user = userString ? JSON.parse(userString) as TelegramUser : undefined;

    return {
      query_id: urlParams.get("query_id") || undefined,
      user,
      auth_date: authDate,
      hash,
    };
  } catch (error) {
    console.error("Error verifying Telegram initData:", error);
    return null;
  }
}

/**
 * Parse initData without verification (for client-side use)
 */
export function parseTelegramInitData(initData: string): Partial<TelegramInitData> {
  try {
    const urlParams = new URLSearchParams(initData);
    const userString = urlParams.get("user");
    const user = userString ? JSON.parse(userString) as TelegramUser : undefined;

    return {
      query_id: urlParams.get("query_id") || undefined,
      user,
      auth_date: parseInt(urlParams.get("auth_date") || "0", 10),
      hash: urlParams.get("hash") || undefined,
    };
  } catch {
    return {};
  }
}
