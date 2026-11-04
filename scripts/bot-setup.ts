/**
 * Настройка бота: webhook, команды, кнопка меню Mini App, описание.
 *   npm run bot:setup
 * Требуются TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_APP_URL, TELEGRAM_WEBHOOK_SECRET.
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

async function call(method: string, params: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  console.log(`${json.ok ? "✓" : "✗"} ${method}${json.ok ? "" : `: ${json.description}`}`);
  return json;
}

async function main() {
  if (!token || !appUrl || !secret) {
    console.error("Нужны TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_APP_URL и TELEGRAM_WEBHOOK_SECRET (в .env.local)");
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    console.error("TELEGRAM_WEBHOOK_SECRET: 16–256 символов A-Z, a-z, 0-9, _ и -");
    process.exit(1);
  }

  await call("setWebhook", {
    url: `${appUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "pre_checkout_query", "my_chat_member"],
    drop_pending_updates: false,
  });
  await call("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть истории" },
      { command: "paysupport", description: "Поддержка по оплатам" },
      { command: "terms", description: "Условия использования" },
    ],
  });
  await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Истории", web_app: { url: appUrl } } });
  await call("setMyShortDescription", { short_description: "Истории, которые происходят в переписке. Каждую ночь — новая глава." });
  await call("setMyDescription", {
    description:
      "Полночь — интерактивные истории в формате чата.\n\nВ 03:12 вам напишет незнакомка. От ваших ответов зависит, доживёт ли она до утра.\n\nНажмите «Истории», чтобы начать.",
  });
  console.log(`\nГотово. Mini App: ${appUrl}`);
}

main();
