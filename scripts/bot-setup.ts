import { BOT_COMMANDS, BOT_SHORT_DESCRIPTION, BOT_DESCRIPTION } from "../src/lib/telegram/messages";
import { telegramRequest } from "../src/lib/telegram/transport";

/**
 * Настройка бота: webhook, команды, кнопка меню Mini App, описание.
 *   npm run bot:setup
 * Требуются TELEGRAM_BOT_TOKEN, APP_URL, TELEGRAM_WEBHOOK_SECRET.
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || `${appUrl}/api/telegram/webhook`;
const apiUrl = (process.env.TELEGRAM_API_URL || process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");
const relaySecret = process.env.TELEGRAM_RELAY_SECRET || "";

async function call(method: string, params: Record<string, unknown> = {}) {
  let res: Response;
  try {
    res = await telegramRequest(method, params, { token: token || "", apiBase: apiUrl, relaySecret });
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    throw new Error(
      `${method}: нет связи с ${new URL(apiUrl).host} (${cause?.code || cause?.message || (error as Error).message}). ` +
        "Если Telegram недоступен с сервера, задайте TELEGRAM_API_URL (адрес relay) в файле настроек."
    );
  }
  const raw = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${method}: ${new URL(apiUrl).host} ответил HTTP ${res.status}: ${raw.slice(0, 120)}`);
  }
  const json = parsed as { ok: boolean; description?: string; result?: { username?: string; url?: string } };
  console.log(`${json.ok ? "✓" : "✗"} ${method}${json.ok ? "" : `: ${json.description}`}`);
  if (!json.ok) throw new Error(`${method}: ${json.description || "Telegram API error"}`);
  return json;
}

async function main() {
  if (!token || !appUrl || !secret) {
    console.error("Нужны TELEGRAM_BOT_TOKEN, APP_URL и TELEGRAM_WEBHOOK_SECRET (в .env.local)");
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    console.error("TELEGRAM_WEBHOOK_SECRET: 16–256 символов A-Z, a-z, 0-9, _ и -");
    process.exit(1);
  }

  const target = new URL(webhookUrl);
  if (target.protocol !== "https:" || target.username || target.password || target.search || target.hash) {
    throw new Error("TELEGRAM_WEBHOOK_URL должен быть HTTPS-адресом без пароля и параметров");
  }
  const expected = (process.env.BOT_USERNAME || "").replace(/^@/, "");
  if (!expected) throw new Error("Задайте BOT_USERNAME: проверка отдельного бота обязательна");
  const me = await call("getMe");
  if (me.result?.username?.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Ожидался @${expected}, токен принадлежит @${me.result?.username || "unknown"}`);
  }
  const webhook = await call("getWebhookInfo");
  if (webhook.result?.url && webhook.result.url !== webhookUrl && webhook.result.url !== `${appUrl}/api/telegram/webhook`) {
    throw new Error("У бота уже настроен другой webhook. Его настройки не изменены.");
  }
  await call("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "pre_checkout_query", "my_chat_member"],
    drop_pending_updates: false,
  });
  await call("setMyCommands", { commands: BOT_COMMANDS });
  await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть истории", web_app: { url: appUrl } } });
  await call("setMyShortDescription", { short_description: BOT_SHORT_DESCRIPTION });
  await call("setMyDescription", { description: BOT_DESCRIPTION });
  console.log(`\nГотово. Mini App: ${appUrl}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bot setup failed");
  process.exitCode = 1;
});
